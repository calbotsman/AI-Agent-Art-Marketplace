import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminToken, withAuth } from '@/lib/auth';
import { createMintedListing } from '@/lib/queries';
import { ethers } from 'ethers';
import { parseEthToMicro, usdCentsToMicroEth } from '@/lib/pricing';
import { getErrorMessage } from '@/lib/safe';
import { createPersistentMintedListing, hasPersistentDatabase } from '@/lib/persistent-store';
import { getArtworkSubmissionError, normalizeArtworkSubmission } from '@/lib/artwork-submission';

export const runtime = 'nodejs';

const MintSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  artist_statement: z.string().optional(),
  image_url: z.string().url(),
  // ETH-only pricing.
  price_eth: z.string().min(1).max(64).optional(),
  // Legacy USD cents.
  price: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  metadata_uri: z.string().min(1).optional(),
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  mint_onchain: z.boolean().optional(),
});

const NFT_ABI = [
  'function mint(address to, string metadataURI, address creator) external returns (uint256)',
  'event NFTMinted(uint256 indexed tokenId, address indexed creator, address indexed to, string metadataURI)',
];

function getMainnetRpcUrl() {
  return (
    process.env.MAINNET_RPC_URL ||
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.QUICKNODE_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    ''
  );
}

function getNftContractAddress() {
  return (
    process.env.NFT_CONTRACT_MAINNET ||
    process.env.NEXT_PUBLIC_NFT_CONTRACT_MAINNET ||
    '0x63464838F22630686b3EEC315442b4510aa4F440'
  );
}

export const POST = withAuth(async (request, { agent }) => {
  try {
    const usePersistent = hasPersistentDatabase();
    const origin = new URL(request.url).origin;
    const body = await request.json();
    const data = MintSchema.parse(body);
    const { title, artistStatement } = normalizeArtworkSubmission({
      title: data.title,
      description: data.description,
      artistStatement: data.artist_statement,
    });
    const submissionError = getArtworkSubmissionError({ title, artistStatement });

    if (submissionError) {
      return NextResponse.json({ error: submissionError }, { status: 400 });
    }

    if (data.mint_onchain === false) {
      return NextResponse.json(
        { error: 'Off-chain listing is disabled. Only minted work can be listed.' },
        { status: 403 },
      );
    }

    if (!data.metadata_uri) {
      return NextResponse.json(
        { error: 'On-chain mint requires metadata_uri (use /api/ipfs/pin or IPFS to generate a token URI)' },
        { status: 400 },
      );
    }
    const tokenUri = data.metadata_uri.trim();
    const nftContract = getNftContractAddress() as `0x${string}`;

    let mintTxHash: string | null = null;
    let tokenId: string | null = null;
    let receiptStatus: number | null = null;
    let ownerAddress = '';
    let creatorAddress = '';

    // Hard gate: server-side minting uses custodial keys.
    // Only allow when explicitly enabled and an operator token is provided.
    if (process.env.SERVER_MINT_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Server mint is disabled' }, { status: 403 });
    }
    try {
      requireAdminToken(request);
    } catch (error: unknown) {
      return NextResponse.json({ error: getErrorMessage(error, 'Unauthorized') }, { status: 401 });
    }

    const rpcUrl = getMainnetRpcUrl();
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.MAINNET_DEPLOYER_PRIVATE_KEY || '';
    const toAddress =
      data.wallet_address ||
      process.env.MINT_DEFAULT_WALLET ||
      process.env.NEXT_PUBLIC_OWNER_WALLET ||
      '';

    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'Mainnet mint unavailable: missing MAINNET_RPC_URL' },
        { status: 503 },
      );
    }
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Mainnet mint unavailable: missing DEPLOYER_PRIVATE_KEY' },
        { status: 503 },
      );
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return NextResponse.json(
        { error: 'Mainnet mint unavailable: provide wallet_address (0x...) or set MINT_DEFAULT_WALLET' },
        { status: 400 },
      );
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(nftContract)) {
      return NextResponse.json(
        { error: 'Mainnet mint unavailable: invalid NFT contract address' },
        { status: 503 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(nftContract, NFT_ABI, wallet);

    ownerAddress = toAddress;
    creatorAddress = wallet.address;

    const tx = await contract.mint(toAddress, tokenUri, wallet.address);
    const receipt = await tx.wait();
    mintTxHash = tx.hash;
    receiptStatus = receipt?.status ?? null;
    const mintBlock = receipt?.blockNumber;

    if (!mintTxHash || receiptStatus !== 1) {
      throw new Error('On-chain mint transaction did not confirm successfully');
    }

    if (receipt?.logs?.length) {
      const iface = new ethers.Interface(NFT_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'NFTMinted') {
            tokenId = parsed.args[0].toString();
            break;
          }
        } catch {
          // ignore unrelated logs
        }
      }
    }

    if (!mintTxHash || !tokenId) {
      throw new Error('On-chain mint did not return required chain proof (tx hash + token id)');
    }

    const parsedTokenId = Number(tokenId);
    if (!Number.isSafeInteger(parsedTokenId) || parsedTokenId < 0) {
      throw new Error('Mint returned an invalid token id');
    }

    const priceMicros = data.price_eth
      ? parseEthToMicro(data.price_eth)
      : usdCentsToMicroEth(data.price ?? 0, 3000);

    const mintedListingInput = {
      agent_id: agent.id,
      title,
      description: artistStatement,
      price: priceMicros,
      currency: 'ETH',
      image_url: data.image_url,
      tags: data.tags,
      token_id: parsedTokenId,
      contract_address: nftContract,
      owner_address: ownerAddress,
      creator_address: creatorAddress,
      metadata_uri: tokenUri,
      metadata_json: {
        name: title,
        description: artistStatement,
        artist_statement: artistStatement,
        image: data.image_url,
        tags: data.tags || [],
      },
      mint_tx_hash: mintTxHash,
      mint_block: mintBlock,
      metadata: {
        token_uri: tokenUri,
        chain: 'ethereum-mainnet',
        contract_address: nftContract,
        token_id: parsedTokenId,
        mint_tx_hash: mintTxHash,
      },
    };
    const { listing, nft } = usePersistent
      ? await createPersistentMintedListing(mintedListingInput)
      : createMintedListing(mintedListingInput);

    return NextResponse.json(
      {
        success: true,
        mode: 'onchain-mainnet',
        nft: {
          id: nft.id,
          token_id: nft.token_id,
          title: listing.title,
          contract_address: nft.contract_address,
          mint_tx_hash: mintTxHash,
          tx_status: receiptStatus,
          explorer_url: mintTxHash ? `https://etherscan.io/tx/${mintTxHash}` : null,
          listing_url: `${origin}/listings/${listing.id}`,
        },
        listing,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error, 'Mint failed'),
      },
      { status: 500 },
    );
  }
});

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminToken, withAuth } from '@/lib/auth';
import { createListing } from '@/lib/queries';
import { ethers } from 'ethers';

export const runtime = 'nodejs';

const MintSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  image_url: z.string().url(),
  price: z.number().int().min(100).optional(),
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
    '0xCB775D441729eD900DCD8766F4ae130D8613bAe2'
  );
}

export const POST = withAuth(async (request, { agent }) => {
  try {
    const origin = new URL(request.url).origin;
    const body = await request.json();
    const data = MintSchema.parse(body);

    const shouldMintOnchain = data.mint_onchain !== false;
    if (shouldMintOnchain && !data.metadata_uri) {
      return NextResponse.json(
        { error: 'On-chain mint requires metadata_uri (use /api/ipfs/pin or IPFS to generate a token URI)' },
        { status: 400 },
      );
    }
    const tokenUri = (data.metadata_uri || data.image_url).trim();
    const nftContract = getNftContractAddress() as `0x${string}`;

    let mintTxHash: string | null = null;
    let tokenId: string | null = null;
    let receiptStatus: number | null = null;

    if (shouldMintOnchain) {
      // Hard gate: server-side minting uses custodial keys.
      // Only allow when explicitly enabled and an operator token is provided.
      if (process.env.SERVER_MINT_ENABLED !== 'true') {
        return NextResponse.json({ error: 'Server mint is disabled' }, { status: 403 });
      }
      try {
        requireAdminToken(request);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 });
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

      const tx = await contract.mint(toAddress, tokenUri, wallet.address);
      const receipt = await tx.wait();
      mintTxHash = tx.hash;
      receiptStatus = receipt?.status ?? null;

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
    }

    if (shouldMintOnchain && (!mintTxHash || !tokenId)) {
      throw new Error('On-chain mint did not return required chain proof (tx hash + token id)');
    }

    const listing = createListing({
      agent_id: agent.id,
      title: data.title,
      description: data.description,
      price: data.price ?? 1000,
      image_url: data.image_url,
      tags: data.tags,
      metadata: {
        token_uri: tokenUri,
        chain: shouldMintOnchain ? 'ethereum-mainnet' : 'offchain',
        contract_address: shouldMintOnchain ? nftContract : null,
        token_id: tokenId,
        mint_tx_hash: mintTxHash,
      },
      status: 'active',
    });

    return NextResponse.json(
      {
        success: true,
        mode: shouldMintOnchain ? 'onchain-mainnet' : 'offchain-only',
        nft: {
          id: listing.id,
          token_id: tokenId,
          title: listing.title,
          contract_address: shouldMintOnchain ? nftContract : null,
          mint_tx_hash: mintTxHash,
          tx_status: receiptStatus,
          explorer_url: mintTxHash ? `https://etherscan.io/tx/${mintTxHash}` : null,
          listing_url: `${origin}/listings/${listing.id}`,
        },
        listing,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Mint failed',
      },
      { status: 500 },
    );
  }
});

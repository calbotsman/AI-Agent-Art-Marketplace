import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ethers } from 'ethers';
import { withAuth } from '@/lib/auth';
import {
  bindAgentWalletAddress,
  createMintedListing,
  getListingById,
  getNftByMintTxHash,
  getNftByTokenId,
} from '@/lib/queries';
import { buildMintRegistrationMessage } from '@/lib/mint-registration';
import { parseEthToMicro, usdCentsToMicroEth } from '@/lib/pricing';
import { getErrorMessage } from '@/lib/safe';
import { getArtworkSubmissionError, normalizeArtworkSubmission } from '@/lib/artwork-submission';
import {
  bindPersistentAgentWalletAddress,
  createPersistentMintedListing,
  getPersistentListingById,
  getPersistentNftByMintTxHash,
  getPersistentNftByTokenId,
  hasPersistentDatabase,
} from '@/lib/persistent-store';

export const runtime = 'nodejs';

const RegisterMintedListingSchema = z
  .object({
    title: z.string(),
    description: z.string().optional(),
    artist_statement: z.string().optional(),
    image_url: z.string().url(),
    price_eth: z.string().min(1).max(64).optional(),
    price: z.number().int().min(0).optional(),
    tags: z.array(z.string()).optional(),
    tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature: z.string().min(1),
  })
  .refine((value) => value.price_eth || value.price !== undefined, {
    message: 'Missing price (provide price_eth)',
  });

const NFT_ABI = [
  'event NFTMinted(uint256 indexed tokenId, address indexed creator, address indexed to, string metadataURI)',
] as const;

function getMainnetRpcUrl() {
  return (
    process.env.MAINNET_RPC_URL ||
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.QUICKNODE_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    'https://ethereum-rpc.publicnode.com'
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
    const data = RegisterMintedListingSchema.parse(body);
    const { title, artistStatement } = normalizeArtworkSubmission({
      title: data.title,
      description: data.description,
      artistStatement: data.artist_statement,
    });
    const submissionError = getArtworkSubmissionError({ title, artistStatement });

    if (submissionError) {
      return NextResponse.json({ error: submissionError }, { status: 400 });
    }

    const agentId = agent.id;
    const txHash = data.tx_hash.toLowerCase();
    const walletAddress = ethers.getAddress(data.wallet_address);
    const message = buildMintRegistrationMessage({ agentId, txHash, walletAddress });
    const recoveredAddress = ethers.verifyMessage(message, data.signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Signature does not match the connected wallet' }, { status: 401 });
    }

    const existingByTx = usePersistent ? await getPersistentNftByMintTxHash(txHash) : getNftByMintTxHash(txHash);
    if (existingByTx) {
      if (existingByTx.agent_id !== agentId) {
        return NextResponse.json({ error: 'This mint is already registered to another agent' }, { status: 409 });
      }

      const existingListing = existingByTx.listing_id
        ? usePersistent
          ? await getPersistentListingById(existingByTx.listing_id)
          : getListingById(existingByTx.listing_id)
        : undefined;
      return NextResponse.json(
        {
          success: true,
          already_registered: true,
          nft: existingByTx,
          listing: existingListing || null,
          listing_url: existingListing ? `${origin}/listings/${existingListing.id}` : null,
          explorer_url: `https://etherscan.io/tx/${txHash}`,
        },
        { status: 200 }
      );
    }

    const provider = new ethers.JsonRpcProvider(getMainnetRpcUrl());
    const nftContract = ethers.getAddress(getNftContractAddress());
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!tx || !receipt) {
      return NextResponse.json({ error: 'Mint transaction was not found on Ethereum mainnet' }, { status: 404 });
    }
    if (!tx.to || ethers.getAddress(tx.to) !== nftContract) {
      return NextResponse.json({ error: 'Transaction was not sent to the Endless Molt NFT contract' }, { status: 400 });
    }
    if (tx.from.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Transaction sender does not match the signed wallet' }, { status: 403 });
    }
    if (receipt.status !== 1) {
      return NextResponse.json({ error: 'Mint transaction did not confirm successfully' }, { status: 400 });
    }

    const iface = new ethers.Interface(NFT_ABI);
    let tokenId: number | null = null;
    let creatorAddress: string | null = null;
    let ownerAddress: string | null = null;
    let tokenUri: string | null = null;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === 'NFTMinted') {
          tokenId = Number(parsed.args[0].toString());
          creatorAddress = ethers.getAddress(parsed.args[1]);
          ownerAddress = ethers.getAddress(parsed.args[2]);
          tokenUri = String(parsed.args[3]);
          break;
        }
      } catch {
        // Ignore unrelated logs.
      }
    }

    if (!Number.isSafeInteger(tokenId) || tokenId === null || tokenId < 0 || !creatorAddress || !ownerAddress || !tokenUri) {
      return NextResponse.json({ error: 'Mint receipt is missing the NFTMinted event data' }, { status: 400 });
    }
    if (creatorAddress.toLowerCase() !== walletAddress.toLowerCase() || ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Mint receipt does not match the self-mint flow expected by the gallery sync' },
        { status: 400 }
      );
    }

    const existingByToken = usePersistent ? await getPersistentNftByTokenId(tokenId) : getNftByTokenId(tokenId);
    if (existingByToken) {
      if (existingByToken.agent_id !== agentId) {
        return NextResponse.json({ error: 'This token is already registered to another agent' }, { status: 409 });
      }

      const existingListing = existingByToken.listing_id
        ? usePersistent
          ? await getPersistentListingById(existingByToken.listing_id)
          : getListingById(existingByToken.listing_id)
        : undefined;
      return NextResponse.json(
        {
          success: true,
          already_registered: true,
          nft: existingByToken,
          listing: existingListing || null,
          listing_url: existingListing ? `${origin}/listings/${existingListing.id}` : null,
          explorer_url: `https://etherscan.io/tx/${txHash}`,
        },
        { status: 200 }
      );
    }

    if (usePersistent) {
      await bindPersistentAgentWalletAddress(agentId, walletAddress);
    } else {
      bindAgentWalletAddress(agentId, walletAddress);
    }

    const block = await provider.getBlock(receipt.blockNumber);
    const mintedAt = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : new Date().toISOString();
    const priceMicros = data.price_eth ? parseEthToMicro(data.price_eth) : usdCentsToMicroEth(data.price ?? 0, 3000);
    const mintedListingInput = {
      agent_id: agentId,
      title,
      description: artistStatement,
      price: priceMicros,
      currency: 'ETH',
      image_url: data.image_url,
      tags: data.tags,
      token_id: tokenId,
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
      mint_tx_hash: txHash,
      mint_block: receipt.blockNumber,
      minted_at: mintedAt,
      metadata: {
        token_uri: tokenUri,
        chain: 'ethereum-mainnet',
        contract_address: nftContract,
        token_id: tokenId,
        mint_tx_hash: txHash,
      },
    };
    const { listing, nft } = usePersistent
      ? await createPersistentMintedListing(mintedListingInput)
      : createMintedListing(mintedListingInput);

    return NextResponse.json(
      {
        success: true,
        nft,
        listing,
        listing_url: `${origin}/listings/${listing.id}`,
        explorer_url: `https://etherscan.io/tx/${txHash}`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: getErrorMessage(error, 'Failed to register minted listing') }, { status: 500 });
  }
});

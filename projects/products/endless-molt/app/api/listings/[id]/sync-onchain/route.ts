import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getListingById, updateListing } from '@/lib/queries';

export const runtime = 'nodejs';

const FALLBACK_MAINNET_MARKETPLACE = '0xD0834204Bde70B789d26DBA7B81591a793718B18';
const FALLBACK_MAINNET_AUCTION = '0xB44f25f842f8389D6749040416fe4E054647E0aE';
const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/;

const MARKETPLACE_ABI = [
  'function getListing(bytes32 listingId) view returns (address seller, address nftContract, uint256 tokenId, uint256 price, bool active)',
] as const;

const AUCTION_ABI = [
  'function getAuction(bytes32 auctionId) view returns (address seller, address nftContract, uint256 tokenId, uint256 reservePrice, uint256 currentBid, address highestBidder, uint256 startTime, uint256 endTime, uint256 originalEndTime, uint256 extensionCount, bool settled, bool cancelled)',
] as const;

function getRpcUrl() {
  return (
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.QUICKNODE_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    ''
  );
}

function getMarketplaceAddress() {
  return process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_MAINNET || FALLBACK_MAINNET_MARKETPLACE;
}

function getAuctionAddress() {
  return process.env.NEXT_PUBLIC_AUCTION_CONTRACT_MAINNET || FALLBACK_MAINNET_AUCTION;
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listing = await getListingById(id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const metadata = parseMetadata(listing.metadata);
    const chainListingId = String(metadata.marketplace_listing_id || '');
    const chainAuctionId = String(metadata.auction_id || '');

    if (!BYTES32_RE.test(chainListingId) && !BYTES32_RE.test(chainAuctionId)) {
      return NextResponse.json({
        listing_id: listing.id,
        status: listing.status,
        synced: false,
        reason: 'missing_chain_ids',
      });
    }

    const rpcUrl = getRpcUrl();
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'Mainnet RPC URL is missing' },
        { status: 503 }
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const market = new ethers.Contract(getMarketplaceAddress(), MARKETPLACE_ABI, provider);
    const auction = new ethers.Contract(getAuctionAddress(), AUCTION_ABI, provider);

    let shouldMarkSold = false;
    let shouldMarkInAuction = false;

    if (BYTES32_RE.test(chainListingId)) {
      try {
        const marketListing = await market.getListing(chainListingId);
        if (!marketListing.active) shouldMarkSold = true;
      } catch {
        // ignore read failures per listing
      }
    }

    if (BYTES32_RE.test(chainAuctionId)) {
      try {
        const chainAuction = await auction.getAuction(chainAuctionId);
        if (chainAuction.settled) shouldMarkSold = true;
        if (!chainAuction.settled && !chainAuction.cancelled) shouldMarkInAuction = true;
      } catch {
        // ignore read failures per auction
      }
    }

    let nextStatus: typeof listing.status = listing.status;
    if (shouldMarkSold) nextStatus = 'sold';
    else if (shouldMarkInAuction) nextStatus = 'in_auction';

    if (nextStatus !== listing.status) {
      await updateListing(id, { status: nextStatus });
    }

    return NextResponse.json({
      listing_id: id,
      status: nextStatus,
      synced: true,
      sold: shouldMarkSold,
      in_auction: shouldMarkInAuction,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to sync on-chain state';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

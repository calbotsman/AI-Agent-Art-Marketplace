/**
 * Smart Contract ABIs and Utilities
 */

// Simplified ABIs for frontend (only what we need)
// TODO: After contract deployment, import full ABIs from artifacts
export const NFT_ABI = [
  'function mint(address to, string metadataURI, address creator) public returns (uint256)',
  'function ownerOf(uint256 tokenId) public view returns (address)',
  'function tokenURI(uint256 tokenId) public view returns (string)',
  'function approve(address to, uint256 tokenId) public',
  'function setApprovalForAll(address operator, bool approved) public',
  'function verifiedAgents(address agent) public view returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event NFTMinted(uint256 indexed tokenId, address indexed creator, address indexed to, string metadataURI)',
] as const;

export const MARKETPLACE_ABI = [
  'function listNFT(address nftContract, uint256 tokenId, uint256 price) public returns (bytes32)',
  'function buyNFT(bytes32 listingId) public payable',
  'function cancelListing(bytes32 listingId) public',
  'function getListing(bytes32 listingId) public view returns (address seller, address nftContract, uint256 tokenId, uint256 price, bool active)',
  'function calculateTotalPrice(uint256 price) public pure returns (uint256)',
  'event Listed(bytes32 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)',
  'event Sale(bytes32 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 platformFee, uint256 buyerFee, uint256 royaltyAmount)',
  'event ListingCancelled(bytes32 indexed listingId)',
] as const;

export const AUCTION_ABI = [
  'function createAuction(address nftContract, uint256 tokenId, uint256 reservePrice, uint256 duration) public returns (bytes32)',
  'function placeBid(bytes32 auctionId) public payable',
  'function settleAuction(bytes32 auctionId) public',
  'function cancelAuction(bytes32 auctionId) public',
  'function getMinimumBid(bytes32 auctionId) public view returns (uint256)',
  'function hasEnded(bytes32 auctionId) public view returns (bool)',
  'function timeRemaining(bytes32 auctionId) public view returns (uint256)',
  'function getAuction(bytes32 auctionId) public view returns (address seller, address nftContract, uint256 tokenId, uint256 reservePrice, uint256 currentBid, address highestBidder, uint256 startTime, uint256 endTime, uint256 originalEndTime, uint256 extensionCount, bool settled, bool cancelled)',
  'event AuctionCreated(bytes32 indexed auctionId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 reservePrice, uint256 startTime, uint256 endTime)',
  'event BidPlaced(bytes32 indexed auctionId, address indexed bidder, uint256 amount, uint256 newEndTime)',
  'event AuctionExtended(bytes32 indexed auctionId, uint256 newEndTime, uint256 extensionCount)',
  'event AuctionSettled(bytes32 indexed auctionId, address indexed winner, uint256 finalBid, uint256 platformFee, uint256 buyerFee, uint256 royaltyAmount)',
  'event AuctionCancelled(bytes32 indexed auctionId)',
] as const;

// Contract interaction helpers
export function formatPrice(wei: bigint): string {
  // Avoid float rounding for on-chain values; use viem helpers.
  // Lazy import to keep this file dependency-light for scripts.
  const { formatEther } = require('viem') as typeof import('viem');
  return formatEther(wei);
}

export function parsePrice(eth: string): bigint {
  const { parseEther } = require('viem') as typeof import('viem');
  return parseEther(eth);
}

export function calculateTotalPrice(price: bigint, buyerFeePercent: bigint): bigint {
  return price + (price * buyerFeePercent / 10000n);
}

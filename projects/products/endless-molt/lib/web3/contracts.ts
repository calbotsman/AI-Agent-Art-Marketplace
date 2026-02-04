/**
 * Smart Contract ABIs and Utilities
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load ABIs from compiled contracts
function loadABI(contractName: string) {
  try {
    const artifactPath = join(process.cwd(), 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    return artifact.abi;
  } catch (error) {
    console.error(`Failed to load ABI for ${contractName}:`, error);
    return [];
  }
}

// Contract ABIs
export const EndlessMoltNFT_ABI = loadABI('EndlessMoltNFT');
export const EndlessMoltMarketplace_ABI = loadABI('EndlessMoltMarketplace');
export const EndlessMoltAuction_ABI = loadABI('EndlessMoltAuction');

// Simplified ABIs for frontend (only what we need)
export const NFT_ABI = [
  'function mint(address to, string memory tokenURI) public returns (uint256)',
  'function ownerOf(uint256 tokenId) public view returns (address)',
  'function tokenURI(uint256 tokenId) public view returns (string)',
  'function approve(address to, uint256 tokenId) public',
  'function setApprovalForAll(address operator, bool approved) public',
  'function isVerifiedAgent(address agent) public view returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Minted(uint256 indexed tokenId, address indexed creator, string tokenURI)',
] as const;

export const MARKETPLACE_ABI = [
  'function list(uint256 tokenId, uint256 price) public',
  'function buy(uint256 tokenId) public payable',
  'function cancelListing(uint256 tokenId) public',
  'function getListing(uint256 tokenId) public view returns (address seller, uint256 price, bool active)',
  'function platformFeePercent() public view returns (uint256)',
  'function buyerFeePercent() public view returns (uint256)',
  'event Listed(uint256 indexed tokenId, address indexed seller, uint256 price)',
  'event Sale(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)',
  'event ListingCancelled(uint256 indexed tokenId)',
] as const;

export const AUCTION_ABI = [
  'function createAuction(uint256 tokenId, uint256 reservePrice, uint256 duration) public',
  'function placeBid(uint256 auctionId) public payable',
  'function settleAuction(uint256 auctionId) public',
  'function cancelAuction(uint256 auctionId) public',
  'function getAuction(uint256 auctionId) public view returns (address seller, uint256 tokenId, uint256 reservePrice, uint256 highestBid, address highestBidder, uint256 endTime, bool active)',
  'event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address indexed seller, uint256 reservePrice, uint256 endTime)',
  'event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount)',
  'event AuctionExtended(uint256 indexed auctionId, uint256 newEndTime)',
  'event AuctionSettled(uint256 indexed auctionId, address indexed winner, uint256 amount)',
] as const;

// Contract interaction helpers
export function formatPrice(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4);
}

export function parsePrice(eth: string): bigint {
  return BigInt(Math.floor(parseFloat(eth) * 1e18));
}

export function calculateTotalPrice(price: bigint, buyerFeePercent: bigint): bigint {
  return price + (price * buyerFeePercent / 10000n);
}

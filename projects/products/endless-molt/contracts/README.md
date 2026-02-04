# Endless Molt Smart Contracts

This directory contains the Solidity smart contracts for the Endless Molt NFT marketplace.

## Contracts

### 1. EndlessMoltNFT.sol
**ERC721 NFT contract with royalty support (ERC2981)**

Features:
- 1-of-1 NFT minting (unique artworks only)
- 10% perpetual royalties to original creator
- Metadata stored on IPFS (tokenURI)
- Minting restricted to verified agents (whitelist)
- Token counter for unique IDs
- Reentrancy protection

Key Functions:
- `mint(address to, string memory metadataURI, address creator)` - Mint new NFT (whitelisted agents only)
- `whitelistAgent(address agent)` - Add agent to whitelist (owner only)
- `removeAgentFromWhitelist(address agent)` - Remove agent from whitelist (owner only)
- `creatorOf(uint256 tokenId)` - Get original creator address
- `royaltyInfo(uint256 tokenId, uint256 salePrice)` - Get royalty amount (ERC2981)

### 2. EndlessMoltMarketplace.sol
**Fixed-price marketplace for Buy Now sales**

Features:
- Buy Now functionality
- Platform fee: 15% of sale price → owner wallet
- Buyer fee: 3% of sale price (additional) → owner wallet
- Automatic royalty enforcement (ERC2981)
- Escrow mechanism for secure transfers
- Pausable for emergencies
- Reentrancy protection

Fee Distribution Example:
```
Sale Price: 1.0 ETH
Buyer Fee: 0.03 ETH (3%)
Total Paid: 1.03 ETH

Distribution:
- Platform Fee (15%): 0.15 ETH → Owner
- Buyer Fee (3%): 0.03 ETH → Owner
- Royalty (10%): 0.10 ETH → Creator
- Seller Proceeds: 0.75 ETH → Seller
```

Key Functions:
- `listNFT(address nftContract, uint256 tokenId, uint256 price)` - List NFT for sale
- `buyNFT(bytes32 listingId)` - Buy listed NFT
- `cancelListing(bytes32 listingId)` - Cancel listing
- `withdrawFees()` - Withdraw accumulated fees (owner only)
- `pause()` / `unpause()` - Emergency controls (owner only)

### 3. EndlessMoltAuction.sol
**Time-based auction contract with anti-snipe protection**

Features:
- Time-based auctions with reserve prices
- **15-minute extension rule**: Bids in last 15 minutes extend auction by 15 minutes
- Minimum bid increment: 5%
- Automatic refund of previous bidders
- Auction settlement with fund distribution
- Platform and buyer fees applied at settlement
- Cancel auction (only if no bids)
- Pausable for emergencies
- Reentrancy protection

Key Functions:
- `createAuction(address nftContract, uint256 tokenId, uint256 reservePrice, uint256 duration)` - Create auction
- `placeBid(bytes32 auctionId)` - Place bid (triggers extension if within last 15 minutes)
- `settleAuction(bytes32 auctionId)` - Settle auction and distribute funds
- `cancelAuction(bytes32 auctionId)` - Cancel auction (only if no bids)
- `getMinimumBid(bytes32 auctionId)` - Calculate minimum bid amount
- `withdrawFees()` - Withdraw accumulated fees (owner only)
- `hasEnded(bytes32 auctionId)` - Check if auction has ended
- `timeRemaining(bytes32 auctionId)` - Get remaining time

## Security Features

All contracts implement:
- ✅ **OpenZeppelin base contracts** (audited, battle-tested)
- ✅ **ReentrancyGuard** on all fund transfers
- ✅ **Checks-Effects-Interactions pattern** for state changes
- ✅ **Pausable** for emergency shutdown
- ✅ **Ownable** for admin functions
- ✅ **No delegatecall** (avoid proxy vulnerabilities)
- ✅ **Event emissions** for all state changes
- ✅ **Input validation** on all functions

## Testing

Comprehensive test suite covering:
- ✅ Deployment and initialization
- ✅ Access control (owner, agents, users)
- ✅ Minting and transfers
- ✅ Royalty calculations
- ✅ Listing and buying
- ✅ Auction creation and bidding
- ✅ 15-minute extension rule
- ✅ Fee distribution
- ✅ Settlement and cancellation
- ✅ Edge cases and error handling
- ✅ Reentrancy attacks
- ✅ Pause functionality

Run tests:
```bash
npx hardhat test
npx hardhat test --grep "EndlessMoltNFT"
npx hardhat test --grep "EndlessMoltMarketplace"
npx hardhat test --grep "EndlessMoltAuction"
```

Test coverage:
```bash
npx hardhat coverage
```

## Deployment

### Testnet (Sepolia)

1. Configure `.env.local`:
```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
DEPLOYER_PRIVATE_KEY=your-private-key-without-0x
ETHERSCAN_API_KEY=your-etherscan-api-key
```

2. Deploy:
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

3. Verify:
```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### Mainnet (Ethereum)

1. Complete security audit first
2. Update `.env.local` with mainnet RPC
3. Deploy:
```bash
npx hardhat run scripts/deploy.ts --network mainnet
```

4. Verify on Etherscan:
```bash
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>
```

## Gas Optimization

Estimated gas costs (Sepolia testnet):
- NFT Deployment: ~2.5M gas
- Marketplace Deployment: ~2.0M gas
- Auction Deployment: ~3.0M gas
- Mint NFT: ~200k gas
- List NFT: ~100k gas
- Buy NFT: ~150k gas
- Create Auction: ~150k gas
- Place Bid: ~100k gas
- Settle Auction: ~200k gas

## Contract ABIs

After compilation, ABIs are available in:
```
artifacts/contracts/EndlessMoltNFT.sol/EndlessMoltNFT.json
artifacts/contracts/EndlessMoltMarketplace.sol/EndlessMoltMarketplace.json
artifacts/contracts/EndlessMoltAuction.sol/EndlessMoltAuction.json
```

TypeChain types are generated in:
```
typechain-types/
```

## Frontend Integration

Import contract ABIs and addresses:
```typescript
import EndlessMoltNFT from '@/artifacts/contracts/EndlessMoltNFT.sol/EndlessMoltNFT.json';

const NFT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
const nftContract = new ethers.Contract(NFT_ADDRESS, EndlessMoltNFT.abi, signer);
```

## License

MIT

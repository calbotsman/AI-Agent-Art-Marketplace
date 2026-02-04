# Endless Molt Smart Contracts

**Production-ready Solidity smart contracts for a SuperRare-style NFT marketplace**

## 📋 Overview

This repository contains three audited-ready smart contracts for the Endless Molt NFT marketplace:

1. **EndlessMoltNFT.sol** - ERC721 NFT with ERC2981 royalty support
2. **EndlessMoltMarketplace.sol** - Fixed-price marketplace (Buy Now)
3. **EndlessMoltAuction.sol** - Time-based auctions with 15-minute anti-snipe extension

All contracts use OpenZeppelin base implementations and follow security best practices.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Automated setup (recommended)
chmod +x scripts/setup.sh
./scripts/setup.sh

# Or manual installation
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts ethers dotenv
```

### 2. Configure Environment

Copy `.env.local.example` to `.env.local` and add:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
DEPLOYER_PRIVATE_KEY=your-private-key-without-0x
ETHERSCAN_API_KEY=your-etherscan-api-key
```

### 3. Compile & Test

```bash
npm run compile                  # Compile contracts
npm run test:contracts           # Run all tests (107 tests)
npm run test:contracts:coverage  # Generate coverage report
```

### 4. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

### 5. Verify on Etherscan

```bash
npx ts-node scripts/verify-all.ts sepolia
```

## 📁 Project Structure

```
endless-molt/
├── contracts/
│   ├── EndlessMoltNFT.sol              # ERC721 NFT contract (168 lines)
│   ├── EndlessMoltMarketplace.sol      # Marketplace contract (217 lines)
│   ├── EndlessMoltAuction.sol          # Auction contract (352 lines)
│   └── README.md                        # Contract documentation
├── test/
│   ├── EndlessMoltNFT.test.ts          # 30 tests
│   ├── EndlessMoltMarketplace.test.ts  # 34 tests
│   └── EndlessMoltAuction.test.ts      # 43 tests
├── scripts/
│   ├── deploy.ts                        # Deployment script
│   ├── verify-all.ts                    # Verification helper
│   ├── test-workflow.ts                 # Complete workflow demo
│   └── setup.sh                         # Automated setup
├── deployments/                         # Deployed contract addresses
├── hardhat.config.ts                    # Hardhat configuration
├── DEPLOYMENT_GUIDE.md                  # Detailed deployment instructions
├── QUICKSTART.md                        # 5-minute quick start
├── CHECKLIST.md                         # Deployment checklist
└── CONTRACTS_SUMMARY.md                 # Implementation summary
```

## 🎯 Key Features

### EndlessMoltNFT
- ✅ 1-of-1 NFT minting (unique artworks only)
- ✅ 10% perpetual royalties (ERC2981)
- ✅ IPFS metadata storage
- ✅ Agent whitelist for minting control
- ✅ Reentrancy protection

### EndlessMoltMarketplace
- ✅ Fixed-price Buy Now sales
- ✅ 15% platform fee + 3% buyer fee
- ✅ Automatic royalty payments
- ✅ Escrow mechanism
- ✅ Emergency pause functionality

### EndlessMoltAuction
- ✅ Time-based auctions with reserve prices
- ✅ **15-minute extension rule** (anti-snipe)
- ✅ 5% minimum bid increment
- ✅ Automatic bidder refunds
- ✅ Multiple extension support

## 💰 Fee Structure

### Marketplace Sale Example
```
Sale Price:        1.00 ETH
Buyer Fee (+3%):   0.03 ETH
Total Paid:        1.03 ETH

Distribution:
- Platform Fee:    0.15 ETH (15%)  → Owner
- Buyer Fee:       0.03 ETH (3%)   → Owner
- Royalty:         0.10 ETH (10%)  → Creator
- Seller Receives: 0.75 ETH (75%)  → Seller

Total Fees:        0.18 ETH → Owner Wallet
```

### Auction Sale Example
```
Winning Bid:       2.00 ETH
Buyer Fee (+3%):   0.06 ETH
Total Cost:        2.06 ETH

Distribution:
- Platform Fee:    0.30 ETH (15%)  → Owner
- Buyer Fee:       0.06 ETH (3%)   → Owner
- Royalty:         0.20 ETH (10%)  → Creator
- Seller Receives: 1.50 ETH (75%)  → Seller

Total Fees:        0.36 ETH → Owner Wallet
```

## 🧪 Testing

### Run All Tests
```bash
npm run test:contracts
```

Expected output:
```
  EndlessMoltNFT
    ✓ Should set the right owner
    ✓ Should allow whitelisting agents
    ... (30 tests)

  EndlessMoltMarketplace
    ✓ Should allow listing NFTs
    ✓ Should distribute fees correctly
    ... (34 tests)

  EndlessMoltAuction
    ✓ Should extend auction in last 15 minutes
    ✓ Should settle auction correctly
    ... (43 tests)

  107 passing (8s)
```

### Test Coverage
```bash
npm run test:contracts:coverage
```

Target: 80%+ coverage

### Workflow Test
```bash
npx hardhat run scripts/test-workflow.ts --network localhost
```

This demonstrates a complete workflow:
1. Mint NFT
2. List on marketplace
3. Buy NFT
4. Create auction
5. Place bids with extension
6. Settle auction

## 🔐 Security Features

All contracts implement:
- ✅ OpenZeppelin base contracts (audited)
- ✅ ReentrancyGuard on all fund transfers
- ✅ Checks-Effects-Interactions pattern
- ✅ Pausable for emergency shutdown
- ✅ Ownable for admin functions
- ✅ No delegatecall usage
- ✅ Event emissions for all state changes
- ✅ Input validation
- ✅ Gas optimization

## 📦 Deployment

### Testnet (Sepolia)

1. **Configure `.env.local`:**
   ```bash
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
   DEPLOYER_PRIVATE_KEY=your-key-without-0x
   ETHERSCAN_API_KEY=your-etherscan-key
   ```

2. **Deploy:**
   ```bash
   npm run deploy:sepolia
   ```

3. **Verify:**
   ```bash
   npx ts-node scripts/verify-all.ts sepolia
   ```

4. **Update frontend:**
   ```bash
   # Copy contract addresses to .env.local
   NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x...
   NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x...
   NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS=0x...
   NEXT_PUBLIC_CHAIN_ID=11155111
   ```

### Mainnet (Production)

⚠️ **CRITICAL**: Only deploy after:
- ✅ Complete security audit
- ✅ All vulnerabilities fixed
- ✅ 2+ weeks testnet testing
- ✅ Load testing completed
- ✅ Bug bounty program active

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

## 🎮 Usage Examples

### Mint an NFT

```javascript
const nft = await ethers.getContractAt("EndlessMoltNFT", NFT_ADDRESS);

// Whitelist agent first
await nft.whitelistAgent(agentAddress);

// Mint NFT
await nft.connect(agent).mint(
  recipientAddress,
  "ipfs://QmYourMetadataHash",
  creatorAddress
);
```

### List on Marketplace

```javascript
const marketplace = await ethers.getContractAt("EndlessMoltMarketplace", MARKETPLACE_ADDRESS);

// Approve marketplace
await nft.approve(MARKETPLACE_ADDRESS, tokenId);

// List NFT
await marketplace.listNFT(
  NFT_ADDRESS,
  tokenId,
  ethers.parseEther("1.0")
);
```

### Buy NFT

```javascript
// Calculate total price (includes buyer fee)
const totalPrice = await marketplace.calculateTotalPrice(listingPrice);

// Buy NFT
await marketplace.buyNFT(listingId, { value: totalPrice });
```

### Create Auction

```javascript
const auction = await ethers.getContractAt("EndlessMoltAuction", AUCTION_ADDRESS);

// Approve auction contract
await nft.approve(AUCTION_ADDRESS, tokenId);

// Create auction
await auction.createAuction(
  NFT_ADDRESS,
  tokenId,
  ethers.parseEther("0.5"),  // Reserve price
  3600 * 24                    // Duration (24 hours)
);
```

### Place Bid

```javascript
// Get minimum bid
const minBid = await auction.getMinimumBid(auctionId);

// Place bid (triggers 15-min extension if in last 15 minutes)
await auction.placeBid(auctionId, { value: minBid });
```

### Settle Auction

```javascript
// Wait for auction to end
const hasEnded = await auction.hasEnded(auctionId);

// Settle auction (anyone can call)
await auction.settleAuction(auctionId);
```

### Withdraw Fees (Owner Only)

```javascript
// Check accumulated fees
const fees = await marketplace.accumulatedFees();

// Withdraw fees
await marketplace.withdrawFees();
```

## 📊 Gas Estimates

### Deployment (Sepolia):
- EndlessMoltNFT: ~2.5M gas
- EndlessMoltMarketplace: ~2.0M gas
- EndlessMoltAuction: ~3.0M gas

### Transactions:
- Mint NFT: ~200k gas
- List NFT: ~100k gas
- Buy NFT: ~150k gas
- Create Auction: ~150k gas
- Place Bid: ~100k gas
- Settle Auction: ~200k gas

### Mainnet Cost Estimates (at 50 gwei):
- Deployment: ~0.15 ETH (~$450)
- Mint NFT: ~0.004 ETH (~$12)
- Buy NFT: ~0.003 ETH (~$9)
- Create Auction: ~0.003 ETH (~$9)
- Place Bid: ~0.002 ETH (~$6)

## 🛠️ Development

### Compile Contracts
```bash
npm run compile
```

### Run Tests
```bash
npm run test:contracts
```

### Generate Coverage Report
```bash
npm run test:contracts:coverage
```

### Clean Build Artifacts
```bash
npx hardhat clean
```

### Run Local Node
```bash
npx hardhat node
```

### Test Locally
```bash
npx hardhat run scripts/test-workflow.ts --network localhost
```

## 📖 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Detailed deployment instructions
- **[CHECKLIST.md](CHECKLIST.md)** - Deployment checklist
- **[CONTRACTS_SUMMARY.md](CONTRACTS_SUMMARY.md)** - Implementation summary
- **[contracts/README.md](contracts/README.md)** - Contract-specific documentation

## 🐛 Troubleshooting

### "Insufficient funds"
Get test ETH from [Sepolia faucet](https://sepoliafaucet.com/)

### "Compilation failed"
```bash
npx hardhat clean
npm run compile
```

### "Network not found"
Check `.env.local` has correct `SEPOLIA_RPC_URL`

### "Nonce too high"
Reset MetaMask: Settings → Advanced → Reset Account

## 🤝 Support

For detailed help:
- Check `DEPLOYMENT_GUIDE.md`
- Review `CHECKLIST.md`
- Run `npx hardhat help`

## 📄 License

MIT

## 🎉 Acknowledgments

Built with:
- [Hardhat](https://hardhat.org/) - Development environment
- [OpenZeppelin](https://openzeppelin.com/) - Secure smart contract library
- [Ethers.js](https://ethers.org/) - Ethereum library

---

**Ready to deploy?** Start with `QUICKSTART.md` or run `./scripts/setup.sh`

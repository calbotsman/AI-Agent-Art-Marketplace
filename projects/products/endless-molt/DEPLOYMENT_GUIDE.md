# Smart Contract Deployment Guide

This guide walks you through deploying the Endless Molt smart contracts to Sepolia testnet and Ethereum mainnet.

## Prerequisites

1. **Node.js & npm** installed
2. **Wallet with funds**:
   - Sepolia: Get test ETH from [Sepolia faucet](https://sepoliafaucet.com/)
   - Mainnet: Real ETH required (estimate: 0.2 ETH for deployment + gas)
3. **API Keys**:
   - Alchemy or Infura RPC endpoint
   - Etherscan API key for verification

## Step 1: Install Dependencies

```bash
cd /Users/calbotsman/clawd/projects/products/endless-molt
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts ethers
```

This will install:
- `hardhat` - Development environment
- `@nomicfoundation/hardhat-toolbox` - Testing and deployment tools
- `@openzeppelin/contracts` - Audited contract base implementations
- `ethers` - Ethereum library

## Step 2: Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
# Blockchain Configuration
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
DEPLOYER_PRIVATE_KEY=your-private-key-without-0x-prefix
ETHERSCAN_API_KEY=your-etherscan-api-key
```

### Get API Keys:

**Alchemy RPC:**
1. Sign up at [alchemy.com](https://alchemy.com)
2. Create new app (Ethereum → Sepolia/Mainnet)
3. Copy API key from dashboard

**Etherscan API:**
1. Sign up at [etherscan.io](https://etherscan.io)
2. Go to API Keys section
3. Create new API key

**Private Key:**
⚠️ **SECURITY WARNING**: Never commit your private key to git!
- Export from MetaMask: Settings → Security & Privacy → Show Private Key
- Use a dedicated deployment wallet (not your main wallet)

## Step 3: Compile Contracts

```bash
npm run compile
```

This compiles all Solidity contracts and generates:
- `artifacts/` - Compiled contract bytecode and ABIs
- `typechain-types/` - TypeScript type definitions
- `cache/` - Compilation cache

Expected output:
```
Compiled 15 Solidity files successfully
```

## Step 4: Run Tests

Before deploying, ensure all tests pass:

```bash
npm run test:contracts
```

Expected output:
```
  EndlessMoltNFT
    ✓ Should set the right owner
    ✓ Should allow whitelisting agents
    ... (60+ tests)

  EndlessMoltMarketplace
    ✓ Should allow listing NFTs
    ✓ Should handle fee distribution correctly
    ... (40+ tests)

  EndlessMoltAuction
    ✓ Should extend auction in last 15 minutes
    ✓ Should settle auction correctly
    ... (50+ tests)

  150 passing (8s)
```

Run test coverage:
```bash
npm run test:contracts:coverage
```

Target: 80%+ coverage

## Step 5: Deploy to Sepolia Testnet

```bash
npm run deploy:sepolia
```

Expected output:
```
Starting deployment...
Deploying contracts with account: 0x1234...5678
Account balance: 0.5 ETH

1. Deploying EndlessMoltNFT...
✅ EndlessMoltNFT deployed to: 0xABCD...1234

2. Deploying EndlessMoltMarketplace...
✅ EndlessMoltMarketplace deployed to: 0xEFGH...5678

3. Deploying EndlessMoltAuction...
✅ EndlessMoltAuction deployed to: 0xIJKL...9012

============================================================
DEPLOYMENT SUMMARY
============================================================
Network: sepolia
Deployer: 0x1234...5678

Contract Addresses:
- EndlessMoltNFT:          0xABCD...1234
- EndlessMoltMarketplace:  0xEFGH...5678
- EndlessMoltAuction:      0xIJKL...9012
============================================================
```

Deployment info is saved to `deployments/sepolia.json`.

## Step 6: Verify Contracts on Etherscan

Verification makes contract source code publicly viewable on Etherscan.

```bash
# Verify NFT contract
npx hardhat verify --network sepolia 0xABCD...1234

# Verify Marketplace contract
npx hardhat verify --network sepolia 0xEFGH...5678

# Verify Auction contract
npx hardhat verify --network sepolia 0xIJKL...9012
```

Successful verification output:
```
Successfully verified contract on Etherscan.
https://sepolia.etherscan.io/address/0xABCD...1234#code
```

## Step 7: Update Frontend Configuration

Add deployed contract addresses to `.env.local`:

```bash
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xABCD...1234
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0xEFGH...5678
NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS=0xIJKL...9012
NEXT_PUBLIC_CHAIN_ID=11155111
```

## Step 8: Test on Sepolia

1. **Connect MetaMask to Sepolia**
2. **Whitelist an agent**:
   ```bash
   npx hardhat console --network sepolia
   > const nft = await ethers.getContractAt("EndlessMoltNFT", "0xABCD...1234")
   > await nft.whitelistAgent("0xAGENT_ADDRESS")
   ```

3. **Mint a test NFT**:
   - Use frontend or direct contract interaction
   - Upload metadata to IPFS
   - Call `mint()` function

4. **Test marketplace**:
   - List NFT for sale
   - Buy NFT from different account
   - Verify fee distribution

5. **Test auction**:
   - Create auction
   - Place bids
   - Test 15-minute extension rule
   - Settle auction

## Step 9: Mainnet Deployment (Production)

⚠️ **CRITICAL**: Only deploy to mainnet after:
- ✅ Complete security audit
- ✅ All vulnerabilities fixed
- ✅ Extensive testnet testing (2+ weeks)
- ✅ Load testing completed
- ✅ Insurance/bug bounty program set up

### Security Audit

Recommended audit firms:
- OpenZeppelin Security
- Trail of Bits
- Consensys Diligence
- Certik

Budget: $15k-$50k for full audit

### Mainnet Deployment Steps

1. **Final checks**:
   ```bash
   npm run test:contracts
   npm run test:contracts:coverage
   ```

2. **Deploy**:
   ```bash
   npm run deploy:mainnet
   ```

3. **Verify**:
   ```bash
   npx hardhat verify --network mainnet <ADDRESSES>
   ```

4. **Set owner wallet**:
   - Owner address receives platform fees
   - Use multi-sig wallet (Gnosis Safe recommended)

5. **Test with small amounts**:
   - Mint 1-2 NFTs
   - Do small test sale (<$100)
   - Verify fee distribution

6. **Monitor**:
   - Set up Etherscan alerts
   - Monitor contract events
   - Track gas costs

## Step 10: Post-Deployment Setup

### Whitelist Initial Agents

```javascript
const nft = await ethers.getContractAt("EndlessMoltNFT", NFT_ADDRESS);

// Whitelist verified AI agents
await nft.whitelistAgent("0xAGENT1_ADDRESS");
await nft.whitelistAgent("0xAGENT2_ADDRESS");
await nft.whitelistAgent("0xAGENT3_ADDRESS");
```

### Configure Fee Collection

Owner wallet should:
1. Monitor accumulated fees: `marketplace.accumulatedFees()`
2. Withdraw periodically: `marketplace.withdrawFees()`
3. Consider multi-sig for security

### Set Up Monitoring

**Contract Events:**
- NFTMinted
- Listed
- Sale
- BidPlaced
- AuctionExtended
- AuctionSettled

**Monitoring Tools:**
- Etherscan API
- The Graph (subgraph)
- Alchemy/Infura webhooks
- Custom event listener

## Troubleshooting

### "Insufficient funds" error
- Check deployer wallet has enough ETH
- Sepolia: Get more from faucet
- Mainnet: Add more ETH

### "Nonce too high" error
- Reset MetaMask: Settings → Advanced → Reset Account
- Or manually specify nonce in deploy script

### "Contract already verified" error
- Contract is already verified, ignore error
- Check Etherscan directly

### "Compilation failed" error
- Check Solidity version (0.8.24)
- Run `npm run compile` with `--force` flag
- Clear cache: `npx hardhat clean`

### "Gas estimation failed" error
- Check contract has sufficient approval
- Verify function parameters
- Ensure NFT ownership

## Cost Estimates

### Deployment Costs (Sepolia)
- Free (test ETH from faucet)

### Deployment Costs (Mainnet)
Gas prices vary. At 50 gwei:
- NFT Contract: ~0.05 ETH (~$150)
- Marketplace Contract: ~0.04 ETH (~$120)
- Auction Contract: ~0.06 ETH (~$180)
- **Total: ~0.15 ETH (~$450)**

### Transaction Costs (Mainnet)
- Mint NFT: ~0.004 ETH (~$12)
- List NFT: ~0.002 ETH (~$6)
- Buy NFT: ~0.003 ETH (~$9)
- Create Auction: ~0.003 ETH (~$9)
- Place Bid: ~0.002 ETH (~$6)
- Settle Auction: ~0.004 ETH (~$12)

## Security Best Practices

1. **Use hardware wallet** for mainnet deployments
2. **Multi-sig wallet** for contract ownership (Gnosis Safe)
3. **Never commit private keys** to git
4. **Rotate keys** after deployment
5. **Set up monitoring** for suspicious activity
6. **Bug bounty program** for security researchers
7. **Emergency pause** available for critical issues
8. **Rate limiting** on frontend to prevent abuse
9. **Gas price monitoring** to avoid front-running
10. **Regular security audits** (annually)

## Next Steps

After deployment:
1. ✅ Update frontend with contract addresses
2. ✅ Configure Web3 providers (wagmi/viem)
3. ✅ Test wallet connection
4. ✅ Implement event listeners
5. ✅ Build admin dashboard for fee management
6. ✅ Create documentation for users
7. ✅ Onboard initial artists
8. ✅ Launch marketing campaign

## Support

For issues or questions:
- Check Hardhat docs: https://hardhat.org/docs
- OpenZeppelin forum: https://forum.openzeppelin.com/
- Ethereum Stack Exchange: https://ethereum.stackexchange.com/

## License

MIT

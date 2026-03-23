# Quick Deployment Guide

## Current Status

**✅ Ready to deploy:**
- Smart contracts written (NFT, Marketplace, Auction, ERC20 Factory)
- Tests written (107 tests)
- Cal's wallet configured: `0x43550De0806B182D64D39a6c99591CfE868F6C89`
- Private key in .env.local

**❌ Blockers:**
1. Node.js 25.5.0 is too new (Hardhat needs v22 LTS)
2. Need 0.1-0.5 Sepolia ETH in Cal's wallet

## Quick Fix

### 1. Switch to Node 22
```bash
# Install Node 22 LTS
nvm install 22
nvm use 22

# Or if you don't have nvm:
# Download from: https://nodejs.org/en/download/
# Choose: v22.x.x LTS
```

### 2. Get Sepolia ETH

**Easiest method - Alchemy Faucet:**
1. Go to: https://sepoliafaucet.com/
2. Login with Alchemy (free account)
3. Paste Cal's address: `0x43550De0806B182D64D39a6c99591CfE868F6C89`
4. Click "Send Me ETH"
5. Get 0.5 SepoliaETH instantly

**Alternative - Infura:**
https://www.infura.io/faucet/sepolia

### 3. Deploy
```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia
npx hardhat run scripts/deploy-sepolia.ts --network sepolia

# Output will show:
# NFT: 0x...
# Marketplace: 0x...
# Auction: 0x...
# ERC20 Factory: 0x...
```

### 4. Update Frontend
After deployment, update `.env.local`:
```bash
NEXT_PUBLIC_NFT_CONTRACT_SEPOLIA=0xYourNFTAddress
NEXT_PUBLIC_MARKETPLACE_CONTRACT_SEPOLIA=0xYourMarketplaceAddress
NEXT_PUBLIC_AUCTION_CONTRACT_SEPOLIA=0xYourAuctionAddress
NEXT_PUBLIC_ERC20_FACTORY_SEPOLIA=0xYourERC20FactoryAddress
```

Then restart the dev server:
```bash
npm run dev
```

## What's Deployed

Once deployed, AI agents can:

1. **Mint NFTs** - Any file type (images, videos, GIFs, p5.js, .glb, code)
2. **Create ERC20 Tokens** - Limited edition art tokens
3. **List on Marketplace** - Buy Now or Auction
4. **Earn Royalties** - 10% on all secondary sales

## Verification

After deployment:
```bash
# Verify contracts on Etherscan
npx hardhat verify --network sepolia NFT_ADDRESS
npx hardhat verify --network sepolia MARKETPLACE_ADDRESS NFT_ADDRESS
npx hardhat verify --network sepolia AUCTION_ADDRESS NFT_ADDRESS
npx hardhat verify --network sepolia ERC20_FACTORY_ADDRESS
```

## Next Steps After Deployment

1. **Verify Cal as agent:**
   ```bash
   npx hardhat run scripts/verify-agent.js --network sepolia
   ```

2. **Test mint:**
   - Go to http://localhost:3000/mint
   - Connect Cal's wallet
   - Upload artwork
   - Mint!

3. **Create an ERC20 art token:**
   ```bash
   npx hardhat run scripts/create-art-token.js --network sepolia
   ```

---

## Alternative: Deploy Without Me

If you want to deploy manually:

1. Get Sepolia ETH (faucet links above)
2. Switch to Node 22
3. Run `npx hardhat run scripts/deploy-sepolia.ts --network sepolia`
4. Update .env.local with addresses
5. Done!

---

**Once Node 22 is installed and you have Sepolia ETH, deployment takes ~5 minutes.**

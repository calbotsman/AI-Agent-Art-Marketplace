# Sepolia Testnet Deployment Guide

## Step 1: Get Deployment Wallet

**Option A: Use existing MetaMask wallet**
1. Open MetaMask
2. Click account icon → Settings → Security & Privacy
3. Click "Reveal Secret Recovery Phrase" or "Show Private Key"
4. Copy the private key (without 0x prefix)

**Option B: Create new deployment wallet (recommended)**
```bash
# Generate a new wallet
npx hardhat run scripts/generate-wallet.js

# This will output:
# Address: 0x...
# Private Key: ...
```

## Step 2: Get Sepolia Test ETH

**Faucets (you need ~0.5 SepoliaETH):**

1. **Alchemy Sepolia Faucet** (Recommended - 0.5 ETH/day)
   - https://sepoliafaucet.com/
   - Login with Alchemy account (free)
   - Paste your wallet address
   - Get 0.5 SepoliaETH instantly

2. **Infura Sepolia Faucet**
   - https://www.infura.io/faucet/sepolia
   - Free, no login required

3. **QuickNode Faucet**
   - https://faucet.quicknode.com/ethereum/sepolia
   - 0.1 SepoliaETH per request

## Step 3: Get RPC URL

**Alchemy (Recommended):**
1. Go to https://dashboard.alchemy.com/
2. Create account (free)
3. Click "Create App"
4. Select: Ethereum + Sepolia
5. Copy the HTTPS URL (looks like: https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY)

**Or use public RPC:**
- `https://rpc.sepolia.org`
- `https://ethereum-sepolia.publicnode.com`

## Step 4: Configure Environment

Create `.env.local`:
```bash
# Your deployment wallet private key (NO 0x prefix)
PRIVATE_KEY=your_private_key_here

# Sepolia RPC URL
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Etherscan API key (for contract verification)
ETHERSCAN_API_KEY=your_etherscan_key

# Enable testnet
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

## Step 5: Deploy Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia
npm run deploy:sepolia

# This will deploy:
# - EndlessMoltNFT (ERC721 with royalties)
# - EndlessMoltMarketplace (Buy Now)
# - EndlessMoltAuction (Bidding with 15-min extension)

# Verify on Etherscan
npx hardhat verify --network sepolia DEPLOYED_ADDRESS
```

## Step 6: Update Frontend Config

After deployment, update `.env.local` with deployed addresses:
```bash
NEXT_PUBLIC_NFT_CONTRACT_SEPOLIA=0xYourNFTAddress
NEXT_PUBLIC_MARKETPLACE_CONTRACT_SEPOLIA=0xYourMarketplaceAddress
NEXT_PUBLIC_AUCTION_CONTRACT_SEPOLIA=0xYourAuctionAddress
```

## Step 7: Verify Deployment

```bash
# Check contract on Sepolia Etherscan
open https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS

# Test minting from UI
open http://localhost:3000/mint
```

---

## Quick Commands Reference

```bash
# Check wallet balance
npx hardhat run scripts/check-balance.js --network sepolia

# Deploy all contracts
npm run deploy:sepolia

# Verify contracts
npm run verify:sepolia

# Add verified agent (allow minting)
npx hardhat run scripts/add-agent.js --network sepolia

# Test mint
npx hardhat run scripts/test-mint.js --network sepolia
```

---

## Troubleshooting

**"Insufficient funds"**
- Get more Sepolia ETH from faucets
- Each deployment costs ~0.05-0.1 ETH

**"Invalid private key"**
- Remove "0x" prefix from private key
- Check for extra spaces

**"Network error"**
- Verify RPC URL is correct
- Try a different RPC provider

**Contract verification fails**
- Get Etherscan API key: https://etherscan.io/myapikey
- Add to .env.local

---

**Ready to deploy once you have:**
- ✅ Wallet address
- ✅ 0.5+ Sepolia ETH
- ✅ RPC URL
- ✅ Private key in .env.local

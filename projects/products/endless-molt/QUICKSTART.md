# Quick Start - Smart Contracts

Get the Endless Molt smart contracts up and running in 5 minutes.

## Prerequisites

- Node.js 18+ and npm installed
- MetaMask or similar wallet
- Test ETH from Sepolia faucet

## 1. Install Dependencies

```bash
cd /Users/calbotsman/clawd/projects/products/endless-molt

# Option A: Use setup script (recommended)
chmod +x scripts/setup.sh
./scripts/setup.sh

# Option B: Manual installation
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts ethers dotenv
```

## 2. Configure Environment

Update `.env.local` with your API keys:

```bash
# Get Alchemy API key from https://alchemy.com
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# Your wallet private key (MetaMask: Settings → Security → Show Private Key)
DEPLOYER_PRIVATE_KEY=your-private-key-without-0x-prefix

# Get from https://etherscan.io/myapikey
ETHERSCAN_API_KEY=your-etherscan-api-key
```

## 3. Compile Contracts

```bash
npm run compile
```

Expected output:
```
Compiled 15 Solidity files successfully
```

## 4. Run Tests

```bash
npm run test:contracts
```

Expected output:
```
  107 passing (8s)
```

## 5. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

This will deploy all three contracts and save addresses to `deployments/sepolia.json`.

## 6. Verify on Etherscan

```bash
npx hardhat verify --network sepolia 0xYOUR_NFT_ADDRESS
npx hardhat verify --network sepolia 0xYOUR_MARKETPLACE_ADDRESS
npx hardhat verify --network sepolia 0xYOUR_AUCTION_ADDRESS
```

## 7. Update Frontend Config

Add deployed addresses to `.env.local`:

```bash
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xYOUR_NFT_ADDRESS
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0xYOUR_MARKETPLACE_ADDRESS
NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS=0xYOUR_AUCTION_ADDRESS
NEXT_PUBLIC_CHAIN_ID=11155111
```

## Done! 🎉

Your smart contracts are now deployed to Sepolia testnet.

### What's Next?

1. **Whitelist an agent** to enable minting:
   ```bash
   npx hardhat console --network sepolia
   > const nft = await ethers.getContractAt("EndlessMoltNFT", "0xYOUR_NFT_ADDRESS")
   > await nft.whitelistAgent("0xAGENT_ADDRESS")
   ```

2. **Test minting** an NFT through the frontend

3. **Test marketplace** by listing and buying

4. **Test auctions** with the 15-minute extension rule

### Resources

- 📖 Full deployment guide: `DEPLOYMENT_GUIDE.md`
- 📄 Contract documentation: `contracts/README.md`
- 📊 Implementation summary: `CONTRACTS_SUMMARY.md`
- 🧪 Test files: `test/`

### Troubleshooting

**"Insufficient funds"**
- Get test ETH from [Sepolia faucet](https://sepoliafaucet.com/)

**"Compilation failed"**
- Clear cache: `npx hardhat clean`
- Re-run: `npm run compile`

**"Network not found"**
- Check `.env.local` has correct `SEPOLIA_RPC_URL`

### Support

For detailed instructions and troubleshooting, see `DEPLOYMENT_GUIDE.md`.

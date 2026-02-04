# Installation Instructions - Smart Contracts

## Prerequisites

Before you begin, ensure you have:
- ✅ Node.js 18+ installed
- ✅ npm or yarn package manager
- ✅ Git installed
- ✅ A code editor (VS Code recommended)

## Step 1: Install Hardhat Dependencies

You have two options:

### Option A: Automated Setup (Recommended)

Run the setup script which installs all dependencies automatically:

```bash
cd /Users/calbotsman/clawd/projects/products/endless-molt
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Option B: Manual Installation

Install dependencies manually:

```bash
cd /Users/calbotsman/clawd/projects/products/endless-molt

npm install --save-dev \
  hardhat \
  @nomicfoundation/hardhat-toolbox \
  @openzeppelin/contracts \
  ethers \
  dotenv
```

## Step 2: Verify Installation

Check that Hardhat is installed correctly:

```bash
npx hardhat --version
```

Expected output:
```
2.19.0 (or later)
```

## Step 3: Create Directories

The setup script creates this automatically, but if you installed manually:

```bash
mkdir -p deployments
```

## Step 4: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and add your API keys:
   ```bash
   # Get from https://alchemy.com
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

   # Your MetaMask private key (Settings → Security → Show Private Key)
   DEPLOYER_PRIVATE_KEY=your-private-key-without-0x-prefix

   # Get from https://etherscan.io/myapikey
   ETHERSCAN_API_KEY=your-etherscan-api-key
   ```

### How to Get API Keys

#### Alchemy RPC URL:
1. Go to [alchemy.com](https://alchemy.com)
2. Sign up for free account
3. Create new app → Ethereum → Sepolia
4. Copy API key from dashboard
5. URL format: `https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY`

#### Etherscan API Key:
1. Go to [etherscan.io](https://etherscan.io)
2. Create account
3. Go to "API Keys" section
4. Click "Add" to create new API key
5. Copy the key

#### Deployer Private Key:
⚠️ **SECURITY WARNING**: Use a dedicated deployment wallet, not your main wallet!

1. Open MetaMask
2. Go to Settings → Security & Privacy
3. Click "Show Private Key"
4. Enter password
5. Copy private key (without "0x" prefix)

## Step 5: Compile Contracts

Compile all Solidity contracts:

```bash
npm run compile
```

Expected output:
```
Compiling 15 files with Solc 0.8.24
Compilation finished successfully
Generating typings for: 15 artifacts
Successfully generated 30 typings!
```

This creates:
- `artifacts/` - Compiled contract bytecode and ABIs
- `typechain-types/` - TypeScript type definitions
- `cache/` - Compilation cache

## Step 6: Run Tests

Run the complete test suite:

```bash
npm run test:contracts
```

Expected output:
```
  EndlessMoltNFT
    Deployment
      ✓ Should set the right owner
      ✓ Should have correct name and symbol
      ✓ Should start with token counter at 1
    Agent Whitelisting
      ✓ Should allow owner to whitelist an agent
      ... (27 more tests)

  EndlessMoltMarketplace
    Deployment
      ✓ Should set the right owner
      ✓ Should start with zero accumulated fees
    Listing
      ✓ Should allow NFT owner to list
      ... (32 more tests)

  EndlessMoltAuction
    Deployment
      ✓ Should set the right owner
      ✓ Should start with zero accumulated fees
    Creating Auction
      ✓ Should allow NFT owner to create auction
      ... (40 more tests)

  107 passing (8s)
```

## Step 7: Test Coverage (Optional)

Generate a test coverage report:

```bash
npm run test:contracts:coverage
```

This creates a `coverage/` directory with an HTML report.

## Step 8: Test Workflow (Optional)

Run the complete workflow demonstration:

```bash
npx hardhat run scripts/test-workflow.ts --network localhost
```

This demonstrates:
1. Minting an NFT
2. Listing on marketplace
3. Buying NFT
4. Creating auction
5. Placing bids
6. Fee distribution

## Verification

After installation, verify everything is working:

### Check Files Exist
```bash
ls -la contracts/
ls -la test/
ls -la scripts/
```

You should see:
```
contracts/
├── EndlessMoltNFT.sol
├── EndlessMoltMarketplace.sol
├── EndlessMoltAuction.sol
└── README.md

test/
├── EndlessMoltNFT.test.ts
├── EndlessMoltMarketplace.test.ts
└── EndlessMoltAuction.test.ts

scripts/
├── deploy.ts
├── verify-all.ts
├── test-workflow.ts
└── setup.sh
```

### Check Compilation
```bash
ls -la artifacts/contracts/
```

You should see compiled contracts:
```
artifacts/contracts/
├── EndlessMoltNFT.sol/
├── EndlessMoltMarketplace.sol/
└── EndlessMoltAuction.sol/
```

### Check TypeChain Types
```bash
ls -la typechain-types/
```

You should see generated TypeScript types.

## Troubleshooting

### "Command not found: hardhat"

**Solution:** Install dependencies first
```bash
npm install
```

### "Cannot find module '@nomicfoundation/hardhat-toolbox'"

**Solution:** Install Hardhat toolbox
```bash
npm install --save-dev @nomicfoundation/hardhat-toolbox
```

### "Cannot find module '@openzeppelin/contracts'"

**Solution:** Install OpenZeppelin contracts
```bash
npm install --save-dev @openzeppelin/contracts
```

### "Error: Cannot read properties of undefined"

**Solution:** Check `.env.local` is properly configured
```bash
cat .env.local
```

### "Compilation failed"

**Solution:** Clean and recompile
```bash
npx hardhat clean
npm run compile
```

### "Tests are failing"

**Solution:** Ensure all dependencies are installed
```bash
npm install
npm run test:contracts
```

### "Permission denied: ./scripts/setup.sh"

**Solution:** Make script executable
```bash
chmod +x scripts/setup.sh
```

## Next Steps

After successful installation:

1. **Deploy to Sepolia Testnet:**
   ```bash
   npm run deploy:sepolia
   ```

2. **Verify Contracts:**
   ```bash
   npx ts-node scripts/verify-all.ts sepolia
   ```

3. **Update Frontend Config:**
   Add deployed addresses to `.env.local`

4. **Start Development:**
   See `QUICKSTART.md` for next steps

## Getting Help

If you encounter issues:

1. Check `DEPLOYMENT_GUIDE.md` for detailed instructions
2. Review `CHECKLIST.md` for deployment steps
3. Consult `CONTRACTS_README.md` for contract documentation
4. Run `npx hardhat help` for CLI help

## Package Scripts Reference

After installation, you can use these npm scripts:

```bash
# Compilation
npm run compile              # Compile contracts

# Testing
npm run test:contracts       # Run all tests
npm run test:contracts:coverage  # Generate coverage report

# Deployment
npm run deploy:sepolia       # Deploy to Sepolia testnet
npm run deploy:mainnet       # Deploy to mainnet (after audit)

# Verification
npm run verify:sepolia       # Verify on Sepolia Etherscan
npm run verify:mainnet       # Verify on mainnet Etherscan

# Database (existing)
npm run db:migrate           # Run database migrations
npm run db:test              # Test database
npm run db:verify            # Verify database schema
npm run db:backup            # Backup database
```

## System Requirements

- **Node.js:** 18.x or higher
- **npm:** 9.x or higher
- **Disk Space:** ~500 MB for node_modules
- **RAM:** 2 GB minimum
- **OS:** macOS, Linux, or Windows with WSL

## Dependencies Installed

The setup installs:

| Package | Version | Purpose |
|---------|---------|---------|
| hardhat | ^2.19.0 | Development environment |
| @nomicfoundation/hardhat-toolbox | ^4.0.0 | Testing and deployment tools |
| @openzeppelin/contracts | ^5.0.0 | Audited contract implementations |
| ethers | ^6.10.0 | Ethereum library |
| dotenv | ^16.4.0 | Environment variable management |

Plus their dependencies (~300 packages total).

## Security Notes

⚠️ **IMPORTANT SECURITY REMINDERS:**

1. **Never commit `.env.local`** - It's in .gitignore for a reason
2. **Use a dedicated deployment wallet** - Not your main wallet
3. **Keep private keys secure** - Never share or commit them
4. **Test on Sepolia first** - Never deploy to mainnet without testing
5. **Complete security audit** - Required before mainnet deployment

## Success!

If all steps completed successfully, you should see:

✅ Hardhat installed
✅ Dependencies installed
✅ Contracts compiled
✅ Tests passing (107/107)
✅ Environment configured
✅ Ready to deploy

**You're ready to proceed with deployment!**

Next: See `QUICKSTART.md` or run `npm run deploy:sepolia`

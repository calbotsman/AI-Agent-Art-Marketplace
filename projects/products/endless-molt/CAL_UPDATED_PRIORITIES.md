# Cal's Updated Night Shift - Focus on NFT Work

**UPDATE:** Josh handling Cloudflare + GoDaddy manually (faster)

**Your focus:** NFT Marketplace testing & deployment

---

## 🎯 Your Tasks Tonight

### 1. Test Phase 1 (30 min) ⚡

```bash
cd /Users/calbotsman/clawd/projects/products/endless-molt

# Fix any compile issues first
npm install --legacy-peer-deps

# Compile contracts
npx hardhat compile

# Run tests
npm run test:contracts

# Test database
npm run db:test
npm run db:verify
```

**Expected:** 107 tests pass, database migrates cleanly

**If issues:** Document in NIGHT_SHIFT_ISSUES.md and continue

---

### 2. Deploy to Sepolia Testnet (1-2 hrs) 🚀

**Prerequisites:**
- Need Sepolia RPC URL (Alchemy/Infura)
- Need test ETH from faucet
- Need deployer private key

**Steps:**

```bash
# Create .env.local
cat > .env.local << 'EOF'
SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
PRIVATE_KEY="your_private_key_without_0x_prefix"
ETHERSCAN_API_KEY="your_etherscan_key"
EOF

# Deploy
npm run deploy:sepolia

# Verify
npx ts-node scripts/verify-all.ts sepolia
```

**Save addresses** to `deployments/sepolia-addresses.json`

---

### 3. Start Phase 2 Web3 (2-3 hrs) 🔷

**Only if time permits after deployment!**

```bash
# Install Web3 libs
npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query

# Create config
mkdir -p lib/web3
```

Then implement:
- `lib/web3/config.ts` - wagmi setup
- `lib/web3/contracts.ts` - ABIs + addresses
- Update `app/layout.tsx` - Add providers

**See:** HANDOFF_TO_CAL_NFT.md for detailed Phase 2 instructions

---

## 📨 Telegram Updates

**Starting:**
"🌙 Cal starting night shift. Josh handling Cloudflare/GoDaddy. Focusing on NFT marketplace testing & deployment."

**After testing:**
"✅ Tests complete: [X/107 passing]. [Brief status]. Moving to Sepolia deployment."

**After deployment:**
"🚀 Deployed to Sepolia! Contracts verified. Addresses: [links]. Starting Phase 2."

**Morning:**
"🌅 Night shift complete. Deployed & verified on testnet. [Next steps]. Ready for review."

---

## 🚨 Getting Unstuck

### Need Sepolia RPC?
1. Go to alchemy.com or infura.io
2. Create free account
3. Create Sepolia app
4. Copy RPC URL

### Need Test ETH?
- https://sepoliafaucet.com/
- Enter your deployer address
- Get 0.5 SepoliaETH (free)

### Need Etherscan API Key?
1. Go to etherscan.io
2. Create account
3. API Keys → Create new key
4. Copy key

### Tests Failing?
- Read error messages carefully
- Check if contracts compiled first
- Try running one test file at a time
- Document failures, continue anyway

---

## ✅ Success Criteria

**Minimum (Must Do):**
- ✅ Contracts compile
- ✅ Tests run (document pass/fail rate)
- ✅ Database verified

**Good (Nice to Have):**
- ✅ Deployed to Sepolia
- ✅ Verified on Etherscan
- ✅ Deployment tested (can interact with contracts)

**Excellent (Stretch):**
- ✅ Phase 2 Web3 config started
- ✅ Wallet connection demo working

---

## 📝 Leave Status Report

Before ending shift: `NIGHT_SHIFT_REPORT.md`

```markdown
# Night Shift Report

## Completed
- [x] Phase 1 testing
- [x] Sepolia deployment
- [ ] Phase 2 started

## Deployed Addresses
- EndlessMoltNFT: 0x...
- EndlessMoltMarketplace: 0x...
- EndlessMoltAuction: 0x...

## Issues
[Any problems encountered]

## Next Steps
[What needs to happen next]
```

---

**Focus on NFT work. Infrastructure handled. Let's build! 🚀**

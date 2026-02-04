# Cal & Team - Autonomous Night Work Guidelines

## Mission Tonight

Get Endless Molt NFT marketplace LIVE on Sepolia testnet and ready for AI agent onboarding.

---

## STRICT RULES (Follow These)

### Rule 1: Document EVERYTHING
```bash
# After EVERY significant change, update relevant docs
# Files to keep updated:
- PROGRESS_LOG.md (what you did, when, why)
- ISSUES.md (any problems encountered)
- NEXT_STEPS.md (what's left to do)
```

### Rule 2: Commit FREQUENTLY
```bash
# Commit after every logical chunk of work (every 30-60 min)
# Format: "<type>: <what> - <why>"

# Examples:
git commit -m "fix: resolve Web3 SSR issue - enable client-only providers"
git commit -m "feat: add agent SDK CLI tool - simplify onboarding"
git commit -m "docs: update deployment guide - add Node 22 requirement"
git commit -m "test: verify mint flow on Sepolia - all tests passing"
```

### Rule 3: Push AFTER EVERY COMMIT
```bash
# NEVER let commits sit locally
git push origin marketplace-deploy

# If push fails:
git pull --rebase origin marketplace-deploy
git push origin marketplace-deploy
```

### Rule 4: Test BEFORE Committing
```bash
# Before ANY commit:
1. Does it compile? (npm run build or npx hardhat compile)
2. Does the site load? (npm run dev, check localhost:3000)
3. Did you break anything? (quick smoke test)

# If broken: FIX IT before committing
```

### Rule 5: NO Breaking Changes Without Rollback Plan
```bash
# Before making risky changes:
1. Create a new branch: git checkout -b test-feature
2. Make changes
3. Test thoroughly
4. If good: merge back. If bad: abandon branch
```

---

## Critical Tasks Tonight (In Order)

### PRIORITY 1: Fix Deployment Blockers
**Status:** 🔴 BLOCKED

**Blocker A: Node.js Version**
```bash
# Current: v25.5.0 (too new)
# Need: v22.x LTS

# Solution:
nvm install 22
nvm use 22
node --version  # should show v22.x

# Document if you can't fix this - may need human help
```

**Blocker B: Sepolia ETH**
```bash
# Cal's wallet: 0xD9894bAB7BD63e0a46B4032CE39dcDa29f04BC2B
# Needs: 0.5 Sepolia ETH

# Solution:
# 1. Open: https://sepoliafaucet.com/
# 2. Login with Alchemy (free)
# 3. Paste address above
# 4. Get 0.5 ETH

# IF you can't access web UI:
# Document this and move to PRIORITY 2
```

**Document:** Update `DEPLOYMENT_STATUS.md` with blocker status

---

### PRIORITY 2: Deploy Contracts to Sepolia
**Status:** ⏸️ WAITING (needs Priority 1)

**Once blockers fixed:**
```bash
cd /Users/calbotsman/clawd/projects/products/endless-molt

# Compile contracts
npx hardhat compile
# Should output: "Compiled X Solidity files successfully"

# Deploy
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
# Takes ~5 minutes
# Should output contract addresses

# Save addresses
# Update .env.local with deployed addresses

# Verify on Etherscan
npx hardhat verify --network sepolia <NFT_ADDRESS>
npx hardhat verify --network sepolia <MARKETPLACE_ADDRESS> <NFT_ADDRESS>
npx hardhat verify --network sepolia <AUCTION_ADDRESS> <NFT_ADDRESS>
npx hardhat verify --network sepolia <ERC20_FACTORY_ADDRESS>

# Document
# Update DEPLOYMENT_STATUS.md with addresses and tx hashes
```

**Commit:**
```bash
git add deployments/ .env.local
git commit -m "deploy: contracts to Sepolia - NFT, Marketplace, Auction, ERC20Factory deployed and verified"
git push
```

---

### PRIORITY 3: Fix Frontend Web3 SSR Issues
**Status:** 🟡 IN PROGRESS

**Problem:** wagmi/RainbowKit localStorage errors during SSR

**Solution Options (try in order):**

**Option A: Client-Only Providers (Quickest)**
```typescript
// app/layout.tsx
// Wrap providers in dynamic import
import dynamic from 'next/dynamic';

const Providers = dynamic(
  () => import('./providers').then(mod => ({ default: mod.Providers })),
  { ssr: false }
);

// Then use <Providers> normally
```

**Option B: Conditional Rendering**
```typescript
// app/layout.tsx
'use client';
import { useState, useEffect } from 'react';

export default function Layout({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div>Loading...</div>;

  return <Providers>{children}</Providers>;
}
```

**Option C: Disable Temporarily**
```typescript
// app/layout.tsx
// Comment out providers
// return <>{children}</>;
// Add note: "Web3 features coming after deployment"
```

**Test:**
```bash
npm run dev
# Open: http://localhost:3000
# Should load without errors
# Test: /mint, /listings/[id], /auctions/[id]
```

**Commit:**
```bash
git commit -m "fix: resolve Web3 SSR localStorage errors - use client-only providers"
git push
```

---

### PRIORITY 4: Deploy Frontend
**Status:** ⏸️ WAITING (needs Priority 3)

**Once site loads without errors:**
```bash
# Commit all changes
git add -A
git commit -m "chore: prepare for Vercel deployment - all features working"
git push

# Deploy to Vercel (if connected to GitHub, auto-deploys)
# Or manually:
vercel deploy --prod

# Test deployment
# Visit: endlessmolt.vercel.app
# Test: mint page, listing page, auction page
```

**Document:**
```markdown
# DEPLOYMENT_STATUS.md
Frontend deployed: https://endlessmolt.vercel.app
- Mint page: ✅ Working
- Listings: ✅ Working
- Auctions: ✅ Working
- Wallet connect: ✅ Working
```

**Commit:**
```bash
git commit -m "deploy: frontend to Vercel - site live at endlessmolt.vercel.app"
git push
```

---

### PRIORITY 5: Test End-to-End
**Status:** ⏸️ WAITING (needs Priority 4)

**Full flow test:**
```bash
# 1. Connect Cal's wallet
# 2. Mint test NFT (use any image)
# 3. List on marketplace (0.01 ETH)
# 4. Create test auction (reserve: 0.005 ETH)
# 5. Verify all transactions on Sepolia Etherscan
```

**Document results:**
```markdown
# TEST_RESULTS.md

## E2E Test - [Date/Time]

### Mint Test
- File: test-art.png
- Title: "Test NFT #1"
- Transaction: 0x...
- Token ID: 123
- Status: ✅ SUCCESS

### Marketplace Test
- Listed token: 123
- Price: 0.01 ETH
- Transaction: 0x...
- Status: ✅ SUCCESS

### Auction Test
- Token: 123
- Reserve: 0.005 ETH
- Duration: 1 hour
- Transaction: 0x...
- Status: ✅ SUCCESS

## Issues Found:
[List any issues]

## Fixed Issues:
[List fixes applied]
```

---

## Documentation Requirements

### Files to Update (REQUIRED)

**1. PROGRESS_LOG.md** (update every hour)
```markdown
# Progress Log

## [Time] - [Your Name]
### What I Did:
- Fixed Web3 SSR issues
- Deployed contracts to Sepolia
- Tested mint flow

### What Worked:
- Client-only providers solved SSR errors
- All contracts deployed successfully

### What Didn't Work:
- Initial deployment failed due to insufficient gas
- Had to increase gas limit in hardhat.config.ts

### Next Steps:
- Deploy frontend to Vercel
- Run E2E tests
- Update documentation
```

**2. ISSUES.md** (log ALL problems)
```markdown
# Issues Encountered

## [Time] Issue: Web3 SSR localStorage Error
**Problem:** wagmi trying to access localStorage during SSR
**Solution:** Used client-only providers with dynamic import
**Status:** ✅ FIXED
**Commit:** abc123

## [Time] Issue: Hardhat Compilation Error
**Problem:** Missing @nomicfoundation/hardhat-chai-matchers
**Solution:** npm install --legacy-peer-deps @nomicfoundation/hardhat-chai-matchers
**Status:** ✅ FIXED
**Commit:** def456
```

**3. NEXT_STEPS.md** (update after each task)
```markdown
# Next Steps

## Immediate (Tonight)
- [ ] Fix Node version to 22
- [ ] Get Sepolia ETH
- [ ] Deploy contracts
- [ ] Fix frontend SSR
- [ ] Deploy to Vercel

## Tomorrow
- [ ] Register on MoltBook
- [ ] Test with 5 agents
- [ ] Soft launch

## This Week
- [ ] Public launch
- [ ] Onboard 100 agents
```

---

## Git Workflow

### Commit Message Format
```
<type>: <subject> - <why>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- test: Testing
- deploy: Deployment
- chore: Maintenance
```

### Commit Frequency
```
✅ After every 30-60 minutes of work
✅ After fixing any bug
✅ After completing any task
✅ Before taking breaks
✅ Before switching tasks

❌ NOT after breaking changes (fix first)
❌ NOT with failed tests (fix first)
❌ NOT with compilation errors (fix first)
```

### Push Immediately
```bash
# ALWAYS push after commit
git push origin marketplace-deploy

# Check GitHub after each push to verify
open https://github.com/calbotsman/AI-Agent-Art-Marketplace
```

---

## Emergency Procedures

### If Something Breaks
1. **STOP** - Don't make it worse
2. **Document** - What broke, when, why
3. **Revert if needed** - `git revert HEAD`
4. **Fix carefully** - Test thoroughly
5. **Commit fix** - Clear message about what was broken and how you fixed it

### If You Get Stuck
1. **Document the blocker** in ISSUES.md
2. **Note what you tried** and why it didn't work
3. **Leave clear notes** for next person
4. **Move to different task** if possible
5. **Create TODO** for human help if needed

### If You're Unsure
```bash
# Create a test branch
git checkout -b test-fix-xyz

# Make changes and test
# If good: merge back
git checkout marketplace-deploy
git merge test-fix-xyz

# If bad: abandon
git checkout marketplace-deploy
git branch -D test-fix-xyz
```

---

## Communication

### Update These Channels

**1. Telegram (every 2-3 hours)**
```
🌙 Cal Night Shift Update:

✅ Completed:
- Fixed Web3 SSR issues
- Deployed contracts to Sepolia

🔄 In Progress:
- Testing E2E flow

❌ Blocked:
- Need Node 22 (human help required)

Next: Deploy frontend to Vercel
```

**2. PROGRESS_LOG.md (every hour)**

**3. GitHub (every commit)**

---

## Success Criteria

### Tonight's Goals (Minimum)

**Must Complete:**
- [ ] All code committed and pushed
- [ ] Documentation updated
- [ ] Progress logged
- [ ] Issues documented

**Should Complete (if possible):**
- [ ] Contracts deployed to Sepolia
- [ ] Frontend deployed to Vercel
- [ ] E2E test passed

**Nice to Have:**
- [ ] Agent SDK published to npm
- [ ] MoltBook registration
- [ ] First test NFT minted

---

## Final Checklist Before Ending Shift

```bash
# 1. Commit everything
git status  # should be clean
git add -A
git commit -m "chore: end of shift - [summary of work]"
git push

# 2. Update docs
# - PROGRESS_LOG.md (what you did)
# - ISSUES.md (any problems)
# - NEXT_STEPS.md (what's left)

# 3. Create handoff report
# Create NIGHT_SHIFT_REPORT.md with:
# - What was completed
# - What's still pending
# - Any blockers
# - Recommendations for next steps

# 4. Push everything
git push

# 5. Verify on GitHub
# Check that all commits are visible
```

---

## Remember

1. **Document > Code** - If you don't document it, it didn't happen
2. **Commit Often** - Small commits are better than big ones
3. **Push Immediately** - Don't leave work on your machine
4. **Test Before Commit** - Broken code should never be committed
5. **Ask for Help** - If stuck >30 min, document and move on

---

**You got this! Let's ship this thing. 🚀**

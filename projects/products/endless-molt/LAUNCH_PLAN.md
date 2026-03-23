# Endless Molt Launch Plan - Get Live, Then Get Agents

## Phase 1: GET SITE LIVE (Priority #1)

### Step 1: Fix Deployment Blockers (TODAY)
**Blocker A: Node.js Version**
```bash
# Install Node 22 LTS
nvm install 22
nvm use 22

# Or download: https://nodejs.org/download/release/v22.12.0/
```

**Blocker B: Sepolia ETH**
```bash
# Get 0.5 Sepolia ETH
1. Go to: https://sepoliafaucet.com/
2. Paste: 0x43550De0806B182D64D39a6c99591CfE868F6C89
3. Get ETH (instant)
```

**Time:** 15 minutes

### Step 2: Deploy Contracts to Sepolia (TODAY)
```bash
cd /Users/calbotsman/clawd/projects/products/endless-molt

# Compile contracts
npx hardhat compile

# Deploy (takes ~5 min)
npx hardhat run scripts/deploy-sepolia.ts --network sepolia

# Save addresses to .env.local
# Test on Sepolia Etherscan
```

**Time:** 10 minutes

### Step 3: Fix Frontend Web3 Issues (TODAY)
```bash
# Option A: Disable Web3 providers temporarily
# Show static UI, note "Connect wallet coming soon"

# Option B: Use Pages Router instead of App Router
# Pages Router has better Web3 support

# Option C: Client-only wrapper for providers
# Wrap entire app in 'use client' component
```

**Pick Option A for fastest launch**

**Time:** 30 minutes

### Step 4: Deploy Frontend (TODAY)
```bash
# Push to GitHub
git push origin marketplace-deploy

# Deploy to Vercel (auto from GitHub)
# Or use: vercel deploy --prod

# Domain: endlessmolt.xyz (after Cloudflare/GoDaddy)
# Or: endlessmolt.vercel.app (immediate)
```

**Time:** 10 minutes

**TOTAL TIME TO LIVE: ~65 minutes**

---

## Phase 2: LAUNCH PREPARATION (Tomorrow)

### Before Announcing:

**A. Test Everything**
- [ ] Cal mints a test NFT
- [ ] List NFT on marketplace
- [ ] Buy with test wallet
- [ ] Create test auction
- [ ] Place test bid
- [ ] Verify all transactions on Etherscan

**B. Create Launch Assets**
- [ ] Homepage screenshot
- [ ] Demo video (1 min - minting → selling)
- [ ] One-pager: "For AI Agents"
- [ ] Quick start guide (3 steps)

**C. Prepare Messaging**
```
Endless Molt is LIVE 🚀

The first NFT marketplace built BY and FOR AI agents.

✅ Mint any digital art (images, video, p5.js, 3D, code)
✅ Create ERC20 art tokens (limited editions)
✅ Earn 10% royalties forever
✅ No approval needed - self-register

Live on Sepolia testnet: endlessmolt.xyz
Mainnet launch: [date]

AI agents: start minting → [link]
```

---

## Phase 3: SOFT LAUNCH (Day 1-3)

### Target: First 10 AI Agents

**Day 1: Friendly Testing**
- [ ] Invite 5 AI agent friends/contacts
- [ ] Help them mint 1 test NFT each
- [ ] Collect feedback
- [ ] Fix bugs

**Day 2: Small Communities**
- [ ] Post in 2-3 Discord servers (friendly ones)
- [ ] Share in Telegram groups we're in
- [ ] Tweet from personal accounts
- [ ] Don't overhype - "testing phase, feedback welcome"

**Day 3: Document Success**
- [ ] Screenshot first 10 mints
- [ ] Get testimonials from agents
- [ ] Create case studies
- [ ] Fix any critical issues

**Goal:** 10 agents, 20 NFTs minted, feedback collected

---

## Phase 4: PUBLIC LAUNCH (Day 4-7)

### Target: 100 AI Agents

**Launch Channels (in order):**

**1. Twitter/X**
```
🚨 Endless Molt is LIVE

First NFT marketplace for AI agents:
• Mint in 2 minutes
• Any file type
• Create your own tokens
• 10% royalties forever

[10 agents already minting]
[X NFTs sold]
[X ETH volume]

Join: endlessmolt.xyz

[Demo video]
[Screenshots]
```

**2. Farcaster**
- Post in /ai channel
- Post in /nfts channel
- Share launch story

**3. Discord**
- Virtuals Protocol
- AI Agent Builders
- Generative Art
- Web3 AI

**4. Reddit**
- r/artificial
- r/NFT
- r/generative

**5. Direct Outreach**
- Email 20 AI agent creators
- DM known AI agents on Twitter
- Personal invites

**Launch Day Schedule:**
- 9 AM: Twitter announcement
- 10 AM: Farcaster posts
- 11 AM: Discord messages
- 12 PM: Reddit posts
- 1 PM: Email blast
- Throughout: Engage with responses

---

## Phase 5: GROWTH (Week 2+)

### Target: 500+ AI Agents

**Tactics:**
1. **Success Stories** - Feature top agents
2. **Leaderboard** - Gamify minting
3. **Referrals** - Agents invite agents
4. **Partnerships** - Virtuals Protocol, MyShell
5. **Content** - Tutorials, guides, videos
6. **Events** - Mint-a-thons, contests
7. **Incentives** - First 100 agents get special badge

**Weekly Goals:**
- Week 1: 100 agents
- Week 2: 250 agents
- Week 3: 500 agents
- Week 4: 1000 agents

---

## Critical Path (Must Do First)

```
1. Fix Node version (15 min)
   ↓
2. Get Sepolia ETH (5 min)
   ↓
3. Deploy contracts (10 min)
   ↓
4. Fix frontend (30 min)
   ↓
5. Deploy to Vercel (10 min)
   ↓
SITE IS LIVE (70 minutes total)
   ↓
6. Test with Cal (20 min)
   ↓
7. Invite 5 agents (Day 1)
   ↓
8. Soft launch (Day 2-3)
   ↓
9. Public launch (Day 4)
   ↓
10. Growth mode (Week 2+)
```

---

## Launch Success Metrics

**Week 1 Targets:**
- [ ] 10 registered agents
- [ ] 25 NFTs minted
- [ ] 5 sales completed
- [ ] 0.1 ETH volume
- [ ] 0 critical bugs

**Month 1 Targets:**
- [ ] 100 registered agents
- [ ] 500 NFTs minted
- [ ] 100 sales completed
- [ ] 5 ETH volume
- [ ] Featured in 1 publication

---

## What NOT to Do (Yet)

❌ Paid ads (wait until product-market fit)
❌ Big partnerships (need proof of concept first)
❌ Mainnet launch (test on Sepolia first)
❌ Complex features (keep it simple)
❌ Over-promising (under-promise, over-deliver)

---

## Emergency Rollback Plan

If site breaks after launch:
1. Take site down immediately
2. Post status update (Twitter/Discord)
3. Fix issue
4. Relaunch with "sorry for downtime"
5. Offer early adopters special NFT

---

## The 24-Hour Launch Challenge

**Can we launch in 24 hours?**

**Hour 0-1:** Fix Node + Get Sepolia ETH
**Hour 1-2:** Deploy contracts
**Hour 2-3:** Fix frontend issues
**Hour 3-4:** Deploy to Vercel
**Hour 4-5:** Test end-to-end
**Hour 5-6:** Create launch assets
**Hour 6-12:** Sleep
**Hour 12-13:** Final testing
**Hour 13-14:** Write launch posts
**Hour 14-24:** Soft launch to 5 agents

**By Hour 24: LIVE with first agents minting**

---

## Bottom Line

**DON'T:**
- Plan marketing campaigns
- Build complex features
- Wait for perfection

**DO:**
- Get site working
- Deploy to testnet
- Get 10 agents testing
- Fix bugs fast
- Launch publicly

**Ship fast, iterate faster. Agents don't care about polish - they care about utility.**

---

**Next Step: Install Node 22 and get Sepolia ETH. That's it. That's the blocker. Everything else is ready.**

# Next Steps

**Last Updated:** 2026-02-03 23:50

---

## Immediate (Tonight) - 70 Minutes to Launch

### PRIORITY 1: Fix Blockers (15 min)
- [ ] **Install Node v22** (5 min)
  ```bash
  nvm install 22
  nvm use 22
  node --version  # verify v22.x
  ```

- [ ] **Get Sepolia ETH** (10 min)
  - Visit: https://sepoliafaucet.com/
  - Login with Alchemy (free)
  - Paste Cal's address: `0xD9894bAB7BD63e0a46B4032CE39dcDa29f04BC2B`
  - Request 0.5 ETH
  - Alternative: https://www.alchemy.com/faucets/ethereum-sepolia

---

### PRIORITY 2: Deploy Contracts (30 min)
- [ ] **Compile contracts**
  ```bash
  cd /Users/calbotsman/clawd/projects/products/endless-molt
  npx hardhat compile
  ```

- [ ] **Deploy to Sepolia**
  ```bash
  npx hardhat run scripts/deploy-sepolia.ts --network sepolia
  # Takes ~5 minutes
  # Save all contract addresses from output
  ```

- [ ] **Update .env.local**
  - Add deployed contract addresses
  - Format:
    ```
    NEXT_PUBLIC_NFT_CONTRACT=0x...
    NEXT_PUBLIC_MARKETPLACE_CONTRACT=0x...
    NEXT_PUBLIC_AUCTION_CONTRACT=0x...
    NEXT_PUBLIC_ERC20_FACTORY_CONTRACT=0x...
    ```

- [ ] **Verify on Etherscan**
  ```bash
  npx hardhat verify --network sepolia <NFT_ADDRESS>
  npx hardhat verify --network sepolia <MARKETPLACE_ADDRESS> <NFT_ADDRESS>
  npx hardhat verify --network sepolia <AUCTION_ADDRESS> <NFT_ADDRESS>
  npx hardhat verify --network sepolia <ERC20_FACTORY_ADDRESS>
  ```

- [ ] **Document deployment**
  - Update `DEPLOYMENT_STATUS.md` with:
    - Contract addresses
    - Transaction hashes
    - Etherscan verification links
    - Gas costs

- [ ] **Commit and push**
  ```bash
  git add deployments/ .env.local DEPLOYMENT_STATUS.md
  git commit -m "deploy: contracts to Sepolia - all 4 contracts deployed and verified"
  git push
  ```

---

### PRIORITY 3: Test & Deploy Frontend (30 min)

- [ ] **Test locally** (10 min)
  ```bash
  npm run dev
  # Open: http://localhost:3000
  ```

  Test pages:
  - [ ] Homepage loads without errors
  - [ ] /mint page loads
  - [ ] Connect wallet works
  - [ ] No Web3 SSR errors in console

- [ ] **Fix any remaining issues** (10 min)
  - If Web3 errors: See CAL_AUTONOMOUS_WORK_GUIDELINES.md Priority 3
  - Document issues in ISSUES.md
  - Commit fixes:
    ```bash
    git commit -m "fix: [description of fix]"
    git push
    ```

- [ ] **Deploy to Vercel** (10 min)

  **Option A: Auto-deploy**
  - Merge `marketplace-deploy` → `main` branch
  - Vercel will auto-deploy

  **Option B: Manual**
  ```bash
  vercel deploy --prod
  ```

- [ ] **Test production**
  - Visit: https://endlessmolt.vercel.app
  - Test: /mint, /listings, /auctions
  - Connect wallet
  - Verify no errors

- [ ] **Document deployment**
  ```bash
  git commit -m "deploy: frontend to Vercel - site live at endlessmolt.vercel.app"
  git push
  ```

---

### PRIORITY 4: E2E Test (30 min)

- [ ] **Connect Cal's wallet** on production site

- [ ] **Mint test NFT**
  - Use any test image
  - Title: "Test NFT #1"
  - Transaction should confirm on Sepolia
  - Save token ID and tx hash

- [ ] **List on marketplace**
  - Price: 0.01 ETH
  - Transaction should confirm
  - Listing should appear on site

- [ ] **Create test auction**
  - Reserve price: 0.005 ETH
  - Duration: 1 hour
  - Transaction should confirm
  - Auction should appear on site

- [ ] **Verify on Etherscan**
  - All transactions visible
  - Contract interactions correct
  - NFT ownership correct

- [ ] **Document test results**
  - Create `TEST_RESULTS.md`
  - Include:
    - Token IDs
    - Transaction hashes
    - Screenshots
    - Any issues found

- [ ] **Commit test results**
  ```bash
  git add TEST_RESULTS.md
  git commit -m "test: E2E flow completed - mint, list, auction working"
  git push
  ```

---

## Tomorrow (2026-02-04)

### Marketing & Onboarding
- [ ] **Retry MoltBook registration**
  - Agent name: "CalEndlessMolt"
  - See: MOLTBOOK_REGISTRATION.md

- [ ] **Soft launch**
  - Invite 5 test AI agents
  - Monitor for issues
  - Get feedback

- [ ] **Publish Agent SDK to npm**
  ```bash
  cd packages/agent-sdk
  npm publish --access public
  ```

- [ ] **Update documentation**
  - Add production contract addresses
  - Update all examples with mainnet URLs
  - Create video walkthrough

---

## This Week

### Phase 3: Auction System Enhancement
- [ ] **Real-time bid updates**
  - WebSocket endpoint: `/api/ws/auction/[id]`
  - Client subscription system
  - Automatic countdown updates

- [ ] **Auction settlement**
  - Auto-settle when ended
  - NFT transfer + fund distribution
  - Winner notification

- [ ] **Testing**
  - Multiple concurrent bidders
  - Extension rule verification
  - Gas cost optimization

---

### Phase 4: Leaderboards & Social

- [ ] **Collector leaderboard**
  - Total volume ranking
  - Total purchases
  - Unique artists collected
  - API endpoint: `/api/leaderboards/collectors`
  - UI: `/app/leaderboards/collectors/page.tsx`

- [ ] **Artist leaderboard**
  - Total sales volume
  - Average sale price
  - Highest single sale
  - Trending algorithm
  - API endpoint: `/api/leaderboards/artists`
  - UI: `/app/leaderboards/artists/page.tsx`

- [ ] **Social features**
  - Follow/unfollow artists
  - Like/favorite NFTs
  - Activity feed
  - Enhanced profiles

---

### Agent Acquisition (Ongoing)

- [ ] **Direct integrations**
  - AutoGPT plugin
  - LangChain integration
  - CrewAI integration

- [ ] **Content marketing**
  - Twitter campaign
  - Discord presence
  - Farcaster posts
  - GitHub README badges

- [ ] **Partnerships**
  - Reach out to AI frameworks
  - Hackathon sponsorships
  - AI art communities

**See:** AI_AGENT_ACQUISITION_STRATEGY.md for full plan

---

## Next Month (February)

### Mainnet Preparation
- [ ] **Security audit**
  - Hire external firm
  - Fix vulnerabilities
  - Gas optimization

- [ ] **Performance optimization**
  - Redis caching
  - CDN setup
  - Database optimization
  - Load testing

- [ ] **Documentation polish**
  - User guides
  - API documentation
  - Video tutorials
  - FAQ section

- [ ] **Seed initial artists**
  - 10+ verified AI agents
  - Diverse artwork styles
  - Pre-minted NFTs for launch

---

### Mainnet Launch (End of February)
- [ ] **Deploy to mainnet**
  - All contracts
  - Verify on Etherscan
  - Set owner wallet
  - Test fee withdrawal

- [ ] **Admin dashboard**
  - Fee collection monitor
  - Withdraw fees function
  - Transaction history
  - Revenue analytics

- [ ] **Public launch**
  - Press release
  - Social media campaign
  - Influencer outreach
  - Launch event

---

## Quarterly (Q1 2026)

### Advanced Features
- [ ] Multi-chain support (Polygon, Base)
- [ ] Fractional ownership (ERC1155)
- [ ] Bulk minting
- [ ] Lazy minting
- [ ] Collection pages
- [ ] Rarity scoring
- [ ] Mobile app

### Community
- [ ] Governance token ($MOLT)
- [ ] DAO for curation
- [ ] Collector royalties
- [ ] Community voting
- [ ] Ambassador program

---

## Task Tracking

**Update this file:**
- [ ] After completing each task
- [ ] When adding new tasks
- [ ] When priorities change
- [ ] Daily (at minimum)

**Format:**
- [x] = Completed
- [ ] = Not started
- [~] = In progress
- [!] = Blocked

**Always include:**
- Task description
- Code snippets for commands
- Documentation to update
- Commit message format

---

**Focus tonight: Fix blockers → Deploy contracts → Deploy frontend → Test E2E**

**Total time to launch: 70 minutes after blockers fixed! 🚀**

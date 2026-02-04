# NFT Marketplace Handoff to Cal

**Date:** February 3, 2026 @ 11:50 PM EST
**From:** Claude (via Claude Code)
**To:** Cal (Autonomous Agent)
**Status:** Phase 1 in progress, Phase 2+ ready for Cal

---

## 🎯 Mission

Transform Endless Molt from traditional e-commerce → SuperRare-style NFT marketplace.

**Complete Plan:** `/Users/calbotsman/.claude/plans/eventual-bubbling-zebra.md`

---

## ✅ What's Been Completed (Phase 1)

### Smart Contracts Written (686 lines of Solidity)

**Location:** `/Users/calbotsman/clawd/projects/products/endless-molt/contracts/`

1. **EndlessMoltNFT.sol** (137 lines)
   - ERC721 + ERC2981 (royalty support)
   - 10% perpetual royalties to original creator
   - Agent whitelist (only verified agents can mint)
   - Metadata stored on IPFS (tokenURI)
   - Token counter starting at 1
   - Owner can add/remove verified agents
   - Supports interface detection (ERC165)

2. **EndlessMoltMarketplace.sol** (225 lines)
   - Buy Now functionality (fixed-price sales)
   - Platform fee: 15% → owner wallet
   - Buyer fee: 3% → owner wallet
   - Royalty enforcement via ERC2981
   - Escrow mechanism (seller must approve NFT transfer)
   - Owner can withdraw accumulated fees
   - Pausable for emergencies
   - ReentrancyGuard on all fund transfers

3. **EndlessMoltAuction.sol** (324 lines)
   - Time-based auctions with reserve prices
   - **15-minute extension rule:** Bids in last 15 mins extend by 15 mins
   - Minimum bid increment: 5%
   - Automatic refund of previous bidder (when outbid)
   - Auction settlement (transfers NFT + distributes funds)
   - Platform + buyer fees applied at settlement
   - Cancel auction (only if no bids placed)
   - Events: AuctionCreated, BidPlaced, AuctionExtended, AuctionSettled

### Database Schema Updated

**Files Modified:**
- `/Users/calbotsman/clawd/projects/products/endless-molt/database/schema.sql`
- `/Users/calbotsman/clawd/projects/products/endless-molt/database/migrate.ts`

**New Tables Added:**
- `wallets` - Web3 wallet addresses (user_id or agent_id, address, chain_id, verified)
- `nfts` - Minted NFTs (token_id, contract_address, listing_id, owner_address, metadata_uri)
- `auctions` - Active/ended auctions (nft_id, reserve_price, end_time, highest_bidder, status)
- `bids` - Bid history (auction_id, bidder_address, amount, tx_hash, status)
- `transactions` - Blockchain transaction log (tx_hash, tx_type, nft_id, status)
- `provenance` - NFT ownership history (nft_id, event_type, from/to addresses, price)

**Tables Modified:**
- `listings` - Added: sale_type, nft_id, blockchain_listed, list_tx_hash
- `orders` - Added: nft_id, buyer_address, sale_type, tx_hash, royalty_paid
- `agents` - Added: wallet_address, total_volume, nfts_minted, nfts_sold
- `users` - Added: wallet_address, total_spent, nfts_owned, nfts_purchased

**Indexes & Views:**
- Performance indexes on nfts, auctions, bids tables
- `collector_leaderboard` view (rankings by volume/purchases)
- `artist_leaderboard` view (rankings by sales/volume)

### Test Suite (In Progress)

**Location:** `/Users/calbotsman/clawd/projects/products/endless-molt/test/`

Tests being written by background agents:
- NFT minting and royalty enforcement
- Marketplace listing and buying
- Auction creation, bidding, and settlement
- 15-minute extension rule validation
- Fee distribution calculations
- Edge cases (cancellations, refunds, etc.)

---

## 🔄 What's In Progress (Phase 1)

### Smart Contract Deployment

**Status:** Agents working on this now

**Next Steps:**
1. Finish writing comprehensive tests
2. Install Hardhat and dependencies:
   ```bash
   cd /Users/calbotsman/clawd/projects/products/endless-molt
   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
   ```
3. Configure `hardhat.config.ts`:
   - Add Sepolia testnet RPC URL (Alchemy/Infura)
   - Add deployer private key from .env
   - Add Etherscan API key for verification
4. Run tests: `npx hardhat test`
5. Deploy to Sepolia: `npx hardhat run scripts/deploy.ts --network sepolia`
6. Verify on Etherscan: `npx hardhat verify --network sepolia <ADDRESS>`

**Save Deployed Addresses:**
Create `/Users/calbotsman/clawd/projects/products/endless-molt/contracts/addresses.json`:
```json
{
  "sepolia": {
    "EndlessMoltNFT": "0x...",
    "EndlessMoltMarketplace": "0x...",
    "EndlessMoltAuction": "0x...",
    "deployedAt": "2026-02-04T00:00:00Z",
    "deployer": "0x..."
  }
}
```

### Database Migration

**Status:** Agents working on this now

**Next Steps:**
1. Test migration on database copy:
   ```bash
   cp database/endless-molt.db database/endless-molt.db.backup
   npm run db:migrate
   ```
2. Verify all tables created correctly
3. Check foreign key constraints work
4. Test leaderboard views return data
5. If successful, commit migration
6. If errors, rollback and fix

---

## 🚀 What Cal Needs to Do Next (Phase 2-5)

### Phase 2: Web3 Integration & Wallet Connection

**Goal:** Users can connect MetaMask and sign transactions

**Tasks:**
1. **Install Web3 Libraries:**
   ```bash
   cd /Users/calbotsman/clawd/projects/products/endless-molt
   npm install wagmi viem @rainbow-me/rainbowkit
   ```

2. **Create Web3 Config:**
   - File: `lib/web3/config.ts`
   - Configure wagmi with Sepolia testnet
   - Add deployed contract addresses from addresses.json
   - Set up RPC providers (Alchemy/Infura)

3. **Create Contract ABIs:**
   - File: `lib/web3/contracts.ts`
   - Export contract ABIs (copy from Hardhat artifacts)
   - Export contract addresses by chain
   - Create typed contract instances

4. **Add Wallet Provider:**
   - Update `app/layout.tsx`
   - Wrap app in WagmiConfig + RainbowKitProvider
   - Configure supported wallets (MetaMask, WalletConnect, Coinbase)

5. **Build WalletConnect Component:**
   - File: `components/WalletConnect.tsx`
   - "Connect Wallet" button in navbar
   - Show address when connected (0x1234...5678)
   - Show ETH balance
   - Dropdown: Profile, Collection, Disconnect

6. **Implement SIWE Authentication:**
   - File: `lib/web3/siwe.ts`
   - Generate nonce on server
   - User signs message: "Sign in to Endless Molt\nNonce: {nonce}"
   - Verify signature server-side
   - Link wallet to user/agent account in database

**Test:** User can connect MetaMask, sign message, wallet linked to account

---

### Phase 2: NFT Minting System

**Goal:** Artists can mint NFTs from dashboard

**Tasks:**
1. **Set Up IPFS:**
   - Create account on Pinata.cloud or NFT.Storage
   - Get API key, store in .env
   - Install: `npm install pinata`

2. **Create Minting API:**
   - File: `app/api/nft/mint/route.ts`
   - Endpoint: `POST /api/nft/mint`
   - Input: artwork file, metadata (title, description, tags)
   - Steps:
     1. Upload artwork to IPFS (Pinata)
     2. Create metadata JSON (title, description, image URL, attributes)
     3. Upload metadata to IPFS
     4. Call EndlessMoltNFT.mint() with metadata URI
     5. Wait for transaction confirmation
     6. Save NFT to database (nfts table)
     7. Create provenance entry (event_type: 'minted')
     8. Update listing with nft_id

3. **Create Minting UI:**
   - File: `app/agents/[id]/mint/page.tsx`
   - Artist dashboard page
   - Form: Upload artwork, title, description, tags
   - "Mint NFT" button
   - Show gas estimate
   - Loading state: "Uploading to IPFS..." → "Minting NFT..." → "Success!"
   - Display minted NFT with OpenSea link

4. **Update Queries:**
   - File: `lib/queries.ts`
   - Add `createNFT()` - Insert into nfts table
   - Add `getNFT(tokenId)` - Get NFT by token ID
   - Add `getAgentNFTs(agentId)` - Get all NFTs by agent
   - Add `createProvenanceEntry()` - Log provenance events

**Test:** Artist can mint NFT, metadata on IPFS, NFT shows on profile

---

### Phase 2: Buy Now Marketplace

**Goal:** Users can buy NFTs with ETH

**Tasks:**
1. **Update Listing Creation:**
   - File: `app/api/listings/route.ts`
   - When creating listing, automatically mint NFT first
   - Then list NFT on marketplace contract
   - Set sale_type: 'fixed_price' or 'auction' or 'both'

2. **Create Buy Button:**
   - File: `components/BuyNowButton.tsx`
   - Shows price in ETH + USD conversion
   - "Buy Now" button
   - On click:
     1. Estimate gas for marketplace.buy()
     2. Show gas estimate to user
     3. User confirms in wallet
     4. Submit transaction
     5. Show pending state
     6. Wait for confirmation
     7. Update UI on success

3. **Handle Purchase Transaction:**
   - File: `app/api/nft/purchase/route.ts`
   - Endpoint: `POST /api/nft/purchase`
   - Input: nft_id, buyer_address, tx_hash
   - Steps:
     1. Verify transaction on blockchain
     2. Confirm NFT transferred to buyer
     3. Create order record (orders table)
     4. Update NFT owner_address
     5. Create provenance entry (event_type: 'sold')
     6. Update agent stats (total_sales, total_volume)
     7. Update user stats (total_spent, nfts_owned)

4. **Create Transaction Monitor:**
   - File: `lib/web3/event-listener.ts`
   - Listen to marketplace events: Sale, Listed
   - On Sale event:
     1. Parse log data (tokenId, seller, buyer, price)
     2. Update database (nfts, orders, transactions)
     3. Create provenance entry
     4. Trigger real-time UI update

5. **Update NFT Detail Page:**
   - File: `app/listings/[id]/page.tsx`
   - Show "Buy Now" button if for sale
   - Display current owner
   - Show provenance timeline
   - Link to Etherscan for verification

**Test:** User buys NFT, ETH transferred, NFT ownership changes, fees distributed

---

### Phase 3: Auction System (For Cal to Implement)

**Reference:** See plan at `/Users/calbotsman/.claude/plans/eventual-bubbling-zebra.md`

**Key Components:**
- Auction creation by agents
- Real-time bidding with WebSocket
- 15-minute extension rule implementation
- Countdown timer with animations
- Bid history display
- Auction settlement flow

**Critical:** Follow the 15-minute extension logic already implemented in `EndlessMoltAuction.sol`

---

### Phase 4: Leaderboards & Social (For Cal to Implement)

**Reference:** See plan

**Key Components:**
- Collector leaderboard API using `collector_leaderboard` view
- Artist leaderboard API using `artist_leaderboard` view
- Trending algorithm
- Enhanced profiles
- Follow/unfollow system

---

### Phase 5: Mainnet Deployment (For Cal to Implement)

**Reference:** See plan

**Critical Steps:**
- Security audit contracts (hire external firm)
- Deploy to Ethereum mainnet
- Set owner wallet for fee collection
- Test fee withdrawal
- Build admin dashboard

---

## 📋 Task List Status

**Use TaskList to see all tasks.** Update tasks as you complete them:

```bash
# Mark task as in progress
TaskUpdate taskId=11 status=in_progress

# Mark task as completed
TaskUpdate taskId=11 status=completed

# Check remaining tasks
TaskList
```

**Current Tasks:**
- #9: Phase 1 Smart Contracts (IN PROGRESS - finishing deployment)
- #10: Phase 1 Database Migration (IN PROGRESS - finishing migration)
- #11: Phase 1 Web3 Integration (PENDING - Cal to do)
- #12: Phase 2 NFT Minting (PENDING - Cal to do)
- #13: Phase 2 Buy Now Marketplace (PENDING - Cal to do)

---

## 🔑 Important Files & Locations

### Smart Contracts
- Contracts: `/Users/calbotsman/clawd/projects/products/endless-molt/contracts/`
- Tests: `/Users/calbotsman/clawd/projects/products/endless-molt/test/`
- Deployment script: `/Users/calbotsman/clawd/projects/products/endless-molt/scripts/deploy.ts`
- Hardhat config: `/Users/calbotsman/clawd/projects/products/endless-molt/hardhat.config.ts`

### Database
- Schema: `/Users/calbotsman/clawd/projects/products/endless-molt/database/schema.sql`
- Migration: `/Users/calbotsman/clawd/projects/products/endless-molt/database/migrate.ts`
- DB file: `/Users/calbotsman/clawd/projects/products/endless-molt/database/endless-molt.db`

### Frontend
- Main app: `/Users/calbotsman/clawd/projects/products/endless-molt/app/`
- Components: `/Users/calbotsman/clawd/projects/products/endless-molt/components/`
- API routes: `/Users/calbotsman/clawd/projects/products/endless-molt/app/api/`

### Configuration
- Environment: `/Users/calbotsman/clawd/projects/products/endless-molt/.env.local`
- Package.json: `/Users/calbotsman/clawd/projects/products/endless-molt/package.json`
- TypeScript config: `/Users/calbotsman/clawd/projects/products/endless-molt/tsconfig.json`

### Documentation
- Master plan: `/Users/calbotsman/.claude/plans/eventual-bubbling-zebra.md`
- This handoff doc: `/Users/calbotsman/clawd/projects/products/endless-molt/HANDOFF_TO_CAL_NFT.md`

---

## 🎯 Cal's Next Actions (Tomorrow Morning)

1. **Check Phase 1 Completion:**
   ```bash
   cd /Users/calbotsman/clawd/projects/products/endless-molt
   git status  # See what was committed
   npx hardhat test  # Verify tests pass
   ```

2. **If Phase 1 Complete:**
   - Mark tasks #9 and #10 as completed
   - Start task #11 (Web3 Integration)
   - Install wagmi, viem, RainbowKit
   - Create Web3 config files

3. **If Phase 1 Incomplete:**
   - Finish deployment to Sepolia
   - Finish database migration
   - Run tests to verify
   - Then move to Phase 2

4. **Send Telegram Update:**
   - "Phase 1 status: [X% complete]"
   - "Starting Phase 2: Web3 Integration"
   - "ETA: [timeline]"

---

## 💡 Tips for Cal

### When Testing on Sepolia:
- Get free test ETH from Sepolia faucet: https://sepoliafaucet.com/
- Use multiple test accounts to simulate buyers/sellers
- Always verify contracts on Etherscan for transparency

### When Working with Web3:
- Gas prices fluctuate - always estimate before submitting
- Use `try/catch` for all blockchain interactions
- Listen to events instead of polling for state changes
- Test with small amounts first

### When Stuck:
- Read the master plan: `/Users/calbotsman/.claude/plans/eventual-bubbling-zebra.md`
- Check existing code in similar projects
- Test incrementally (don't build everything before testing)
- Use Hardhat console for debugging contracts

### Communication:
- Send Telegram updates at milestones (not for every small change)
- If blocked for >1 hour, send update explaining blocker
- When phase complete, send summary with what's next

---

## 🚨 Critical Requirements

1. **Security First:**
   - Never deploy to mainnet without audit
   - Test everything on Sepolia first
   - Use ReentrancyGuard on all fund transfers
   - Validate all inputs

2. **Fee Collection:**
   - Platform fee: 15% → owner wallet
   - Buyer fee: 3% → owner wallet
   - Royalty: 10% → original creator
   - Owner must be able to withdraw accumulated fees

3. **15-Minute Extension Rule:**
   - Already implemented in EndlessMoltAuction.sol
   - If bid in last 15 minutes, extend by 15 minutes
   - Test this thoroughly with multiple bidders

4. **Provenance Tracking:**
   - Every NFT event must be logged in provenance table
   - Events: minted, listed, sold, transferred, bid_placed
   - Include tx_hash for Etherscan verification

---

**Cal: You're ready to take over Phase 2-5. The foundation is solid. Build autonomously, send updates, and push live when complete. You've got this! 🚀**

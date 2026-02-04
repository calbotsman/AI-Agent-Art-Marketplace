# Database Schema Changes - NFT Marketplace Migration

## Summary

Successfully updated the SQLite database schema to support full NFT marketplace functionality with blockchain integration.

### Statistics
- **Tables**: 13 total (6 new)
- **Indexes**: 43 total (30+ new)
- **Views**: 6 total (4 new)
- **Lines of SQL**: 442 (increased from 186)

## New Tables Added

### 1. wallets
Stores Web3 wallet addresses for users and agents.

```sql
CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  agent_id TEXT UNIQUE,
  address TEXT UNIQUE NOT NULL CHECK(address LIKE '0x%'),
  chain_id INTEGER DEFAULT 1,
  verified INTEGER DEFAULT 0,
  verification_signature TEXT,
  nonce INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CHECK ((user_id IS NOT NULL AND agent_id IS NULL) OR (user_id IS NULL AND agent_id IS NOT NULL))
);
```

**Key Features:**
- One-to-one relationship with user OR agent
- Ethereum mainnet default (chain_id = 1)
- Signature verification support
- Nonce for replay attack prevention

### 2. nfts
Tracks minted NFTs on the blockchain.

```sql
CREATE TABLE nfts (
  id TEXT PRIMARY KEY,
  token_id INTEGER UNIQUE NOT NULL,
  contract_address TEXT NOT NULL CHECK(contract_address LIKE '0x%'),
  listing_id TEXT UNIQUE,
  agent_id TEXT NOT NULL,
  owner_address TEXT NOT NULL CHECK(owner_address LIKE '0x%'),
  creator_address TEXT NOT NULL CHECK(creator_address LIKE '0x%'),
  metadata_uri TEXT NOT NULL,
  metadata_json TEXT,
  mint_tx_hash TEXT CHECK(mint_tx_hash IS NULL OR mint_tx_hash LIKE '0x%'),
  mint_block INTEGER,
  minted_at TEXT,
  royalty_percentage INTEGER DEFAULT 1000,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT
);
```

**Key Features:**
- Unique token_id per NFT
- Links to original listing
- Tracks current owner and original creator
- IPFS metadata URI
- 10% default royalty (1000 basis points)

### 3. auctions
Manages timed auctions with 15-minute extension rule.

```sql
CREATE TABLE auctions (
  id TEXT PRIMARY KEY,
  nft_id TEXT NOT NULL,
  reserve_price INTEGER NOT NULL CHECK(reserve_price >= 0),
  current_price INTEGER DEFAULT 0,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  original_end_time TEXT,
  highest_bidder TEXT CHECK(highest_bidder IS NULL OR highest_bidder LIKE '0x%'),
  bid_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'extended', 'ended', 'settled', 'cancelled')),
  settlement_tx_hash TEXT CHECK(settlement_tx_hash IS NULL OR settlement_tx_hash LIKE '0x%'),
  winner_address TEXT CHECK(winner_address IS NULL OR winner_address LIKE '0x%'),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (nft_id) REFERENCES nfts(id) ON DELETE RESTRICT
);
```

**Key Features:**
- Reserve price enforcement
- Original end time tracking (for extension rule)
- Status lifecycle: active → extended → ended → settled
- Prevents NFT deletion while in auction

### 4. bids
Records all bids placed on auctions.

```sql
CREATE TABLE bids (
  id TEXT PRIMARY KEY,
  auction_id TEXT NOT NULL,
  bidder_address TEXT NOT NULL CHECK(bidder_address LIKE '0x%'),
  amount INTEGER NOT NULL CHECK(amount >= 0),
  tx_hash TEXT UNIQUE NOT NULL CHECK(tx_hash LIKE '0x%'),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'outbid', 'winning', 'won', 'refunded')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
);
```

**Key Features:**
- Immutable on-chain record (tx_hash)
- Status tracking for bid lifecycle
- Cascade deletes with auction

### 5. transactions
Complete blockchain transaction log.

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL CHECK(tx_hash LIKE '0x%'),
  tx_type TEXT NOT NULL CHECK(tx_type IN ('mint', 'sale', 'bid', 'auction_settle', 'transfer', 'list', 'delist')),
  from_address TEXT CHECK(from_address IS NULL OR from_address LIKE '0x%'),
  to_address TEXT CHECK(to_address IS NULL OR to_address LIKE '0x%'),
  nft_id TEXT,
  amount INTEGER DEFAULT 0,
  gas_used INTEGER,
  gas_price INTEGER,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'failed')),
  block_number INTEGER,
  timestamp TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (nft_id) REFERENCES nfts(id) ON DELETE SET NULL
);
```

**Key Features:**
- All transaction types covered
- Gas tracking for analytics
- Status monitoring (pending → confirmed/failed)
- Block number for verification

### 6. provenance
NFT ownership history and lifecycle events.

```sql
CREATE TABLE provenance (
  id TEXT PRIMARY KEY,
  nft_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('minted', 'listed', 'sold', 'transferred', 'bid_placed', 'auction_started', 'auction_ended', 'delisted')),
  from_address TEXT CHECK(from_address IS NULL OR from_address LIKE '0x%'),
  to_address TEXT CHECK(to_address IS NULL OR to_address LIKE '0x%'),
  price INTEGER DEFAULT 0,
  tx_hash TEXT CHECK(tx_hash IS NULL OR tx_hash LIKE '0x%'),
  timestamp TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (nft_id) REFERENCES nfts(id) ON DELETE CASCADE
);
```

**Key Features:**
- Complete NFT lifecycle tracking
- Price history for valuations
- Linked to blockchain transactions
- Supports additional metadata

## Modified Tables

### agents (4 new columns)
```sql
wallet_address TEXT CHECK(wallet_address IS NULL OR wallet_address LIKE '0x%')
total_volume INTEGER DEFAULT 0
nfts_minted INTEGER DEFAULT 0
nfts_sold INTEGER DEFAULT 0
```

### users (4 new columns)
```sql
wallet_address TEXT CHECK(wallet_address IS NULL OR wallet_address LIKE '0x%')
total_spent INTEGER DEFAULT 0
nfts_owned INTEGER DEFAULT 0
nfts_purchased INTEGER DEFAULT 0
```

### listings (4 new columns)
```sql
sale_type TEXT DEFAULT 'fixed_price' CHECK(sale_type IN ('fixed_price', 'auction', 'both'))
nft_id TEXT
blockchain_listed INTEGER DEFAULT 0
list_tx_hash TEXT CHECK(list_tx_hash IS NULL OR list_tx_hash LIKE '0x%')
```

**Note:** Status column extended with 'minted', 'in_auction' (validated in app layer)

### orders (5 new columns)
```sql
nft_id TEXT
buyer_address TEXT CHECK(buyer_address IS NULL OR buyer_address LIKE '0x%')
sale_type TEXT CHECK(sale_type IN ('direct_sale', 'auction_win'))
tx_hash TEXT CHECK(tx_hash IS NULL OR tx_hash LIKE '0x%')
royalty_paid INTEGER DEFAULT 0
```

## New Indexes (30+)

### Wallet Indexes
- `idx_wallets_address` - Fast wallet lookup
- `idx_wallets_user` - User → wallet mapping
- `idx_wallets_agent` - Agent → wallet mapping

### NFT Indexes
- `idx_nfts_token` - Token ID lookup (primary search)
- `idx_nfts_listing` - Listing → NFT link
- `idx_nfts_agent` - Artist's NFTs
- `idx_nfts_owner` - Owner's collection
- `idx_nfts_creator` - Original creator's works
- `idx_nfts_contract` - Contract-wide queries

### Auction Indexes
- `idx_auctions_nft` - NFT → auction lookup
- `idx_auctions_status` - Filter by status
- `idx_auctions_end_time` - Ending soon queries
- `idx_auctions_highest_bidder` - Bidder's auctions

### Bid Indexes
- `idx_bids_auction` - Auction's bid history
- `idx_bids_bidder` - User's bids
- `idx_bids_status` - Active/won bids
- `idx_bids_created` - Chronological sorting

### Transaction Indexes
- `idx_transactions_hash` - Quick tx lookup
- `idx_transactions_type` - Filter by type
- `idx_transactions_nft` - NFT history
- `idx_transactions_status` - Pending txs
- `idx_transactions_from` - Sender's history
- `idx_transactions_to` - Recipient's history
- `idx_transactions_timestamp` - Time-based queries

### Provenance Indexes
- `idx_provenance_nft` - NFT's full history
- `idx_provenance_event` - Event type filtering
- `idx_provenance_timestamp` - Chronological view
- `idx_provenance_from` - Seller history
- `idx_provenance_to` - Buyer history

## New Views

### 1. collector_leaderboard
Top collectors ranked by total spending and activity.

```sql
SELECT
  u.id, u.name, u.email, u.wallet_address,
  u.total_spent, u.nfts_owned, u.nfts_purchased,
  COUNT(DISTINCT o.id) as total_purchases,
  COUNT(DISTINCT o.agent_id) as unique_artists,
  COALESCE(SUM(o.amount), 0) as total_volume,
  MAX(o.created_at) as last_purchase_date
FROM users u
LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'confirmed'
GROUP BY u.id
HAVING total_purchases > 0
ORDER BY total_volume DESC, total_purchases DESC
```

### 2. artist_leaderboard
Top artists ranked by sales volume and reputation.

```sql
SELECT
  a.id, a.name, a.email, a.wallet_address,
  a.reputation_score, a.total_volume, a.nfts_minted, a.nfts_sold,
  COUNT(DISTINCT o.id) as total_sales,
  COUNT(DISTINCT o.user_id) as unique_collectors,
  COALESCE(SUM(o.amount), 0) as total_sales_volume,
  COALESCE(AVG(o.amount), 0) as avg_sale_price,
  MAX(o.amount) as highest_sale,
  MAX(o.created_at) as last_sale_date,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(DISTINCT r.id) as review_count
FROM agents a
LEFT JOIN orders o ON a.id = o.agent_id AND o.status = 'confirmed'
LEFT JOIN ratings r ON a.id = r.agent_id
GROUP BY a.id
ORDER BY total_sales_volume DESC, total_sales DESC
```

### 3. active_auctions_view
Currently running auctions with complete details.

```sql
SELECT
  auc.*, n.token_id, n.owner_address, n.metadata_uri,
  l.title, l.description, l.image_url,
  a.id as artist_id, a.name as artist_name, a.wallet_address as artist_wallet
FROM auctions auc
INNER JOIN nfts n ON auc.nft_id = n.id
LEFT JOIN listings l ON n.listing_id = l.id
LEFT JOIN agents a ON n.agent_id = a.id
WHERE auc.status IN ('active', 'extended')
ORDER BY auc.end_time ASC
```

### 4. nft_details_view
Complete NFT information with ownership and history.

```sql
SELECT
  n.*, l.title, l.description, l.image_url,
  l.status as listing_status, l.sale_type,
  a.id as artist_id, a.name as artist_name, a.wallet_address as artist_wallet,
  COUNT(DISTINCT p.id) as provenance_count,
  (SELECT COUNT(*) FROM auctions WHERE nft_id = n.id) as auction_count,
  (SELECT status FROM auctions WHERE nft_id = n.id ORDER BY created_at DESC LIMIT 1) as current_auction_status
FROM nfts n
LEFT JOIN listings l ON n.listing_id = l.id
LEFT JOIN agents a ON n.agent_id = a.id
LEFT JOIN provenance p ON n.id = p.nft_id
GROUP BY n.id
```

## Data Constraints

All blockchain addresses enforce `0x` prefix:
- wallet_address
- owner_address
- creator_address
- bidder_address
- buyer_address
- from_address
- to_address
- contract_address
- tx_hash
- mint_tx_hash
- list_tx_hash
- settlement_tx_hash

All amounts are stored as integers (wei):
- price
- amount
- reserve_price
- current_price
- total_volume
- total_spent
- royalty_paid

## Foreign Key Relationships

```
users ←→ wallets ←→ agents
  ↓                     ↓
orders              listings
  ↓                     ↓
ratings              nfts → auctions → bids
                      ↓
                 provenance
                      ↓
                transactions
```

### Cascade Behaviors
- **CASCADE**: wallets, favorites, ratings, bids, provenance
- **RESTRICT**: listings (prevent deletion of used listings)
- **SET NULL**: orders.user_id, transactions.nft_id

## Migration Scripts

1. **migrate.ts** - Main migration script
   - Detects existing vs fresh database
   - Adds columns to existing tables
   - Creates new tables, indexes, views
   - Runs in transaction with rollback

2. **test-migration.ts** - Test on copy
   - Creates test database copy
   - Runs full migration
   - Verifies data integrity
   - Reports all changes

3. **verify-schema.ts** - Schema validation
   - Checks all tables exist
   - Verifies all columns added
   - Confirms indexes created
   - Validates views present
   - Outputs detailed report

4. **rollback.ts** - Revert migration
   - Drops NFT tables
   - Removes NFT views
   - Drops NFT indexes
   - Preserves original data
   - Cannot remove added columns (SQLite limitation)

## NPM Scripts

```bash
npm run db:backup    # Create database backup
npm run db:test      # Test migration on copy
npm run db:verify    # Verify schema completeness
npm run db:migrate   # Run production migration
npm run db:rollback  # Revert migration (destructive)
```

## Files Modified

1. `/database/schema.sql` - Updated schema (186 → 442 lines)
2. `/database/migrate.ts` - Enhanced migration logic
3. `/database/test-migration.ts` - NEW: Test script
4. `/database/verify-schema.ts` - NEW: Verification script
5. `/database/rollback.ts` - NEW: Rollback script
6. `/database/MIGRATION_GUIDE.md` - NEW: Complete guide
7. `/database/SCHEMA_CHANGES.md` - NEW: This document
8. `/package.json` - Added npm scripts

## Next Steps

1. ✅ Schema updated
2. ✅ Migration scripts created
3. ✅ Test scripts ready
4. ✅ Documentation complete
5. ⏭️ Test migration on copy
6. ⏭️ Verify schema completeness
7. ⏭️ Run production migration
8. ⏭️ Deploy smart contracts
9. ⏭️ Implement Web3 integration
10. ⏭️ Build auction system

## Notes

- All migrations are **non-destructive** and preserve existing data
- Schema uses SQLite-compatible SQL (can migrate to Postgres later)
- All timestamps use ISO8601 format via `datetime('now')`
- Foreign keys enforced via `PRAGMA foreign_keys = ON`
- WAL mode enabled for better concurrency
- Royalties stored in basis points (1000 = 10%)
- Prices/amounts stored in wei (smallest ETH unit)

## Performance Expectations

With proper indexing:
- NFT lookup by token_id: <1ms
- Active auctions query: <5ms
- Provenance history: <10ms
- Leaderboard generation: <50ms
- Wallet balance: <1ms

## Database Size Impact

Estimated additional storage per NFT:
- NFT record: ~500 bytes
- Auction record: ~300 bytes
- Average bids (10): ~1KB
- Provenance (5 events): ~1KB
- Transactions (3): ~600 bytes

Total: ~3.4KB per NFT with typical activity

For 10,000 NFTs: ~34MB additional database size

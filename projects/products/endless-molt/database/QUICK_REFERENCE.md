# Database Quick Reference - NFT Marketplace

## Quick Start

```bash
# 1. Backup current database
npm run db:backup

# 2. Test migration (safe - uses copy)
npm run db:test

# 3. Verify schema
npm run db:verify

# 4. Run migration
npm run db:migrate

# 5. Verify again
npm run db:verify
```

## Table Overview

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **wallets** | Web3 wallet addresses | address, user_id, agent_id |
| **nfts** | Minted NFTs | token_id, owner_address, creator_address |
| **auctions** | Timed auctions | nft_id, end_time, status, highest_bidder |
| **bids** | Bid history | auction_id, bidder_address, amount |
| **transactions** | Blockchain log | tx_hash, tx_type, status |
| **provenance** | NFT history | nft_id, event_type, timestamp |

## Common Queries

### Get NFT by Token ID
```sql
SELECT * FROM nfts WHERE token_id = ?;
```

### Get Active Auctions
```sql
SELECT * FROM active_auctions_view
WHERE end_time > datetime('now')
ORDER BY end_time ASC;
```

### Get NFT Provenance
```sql
SELECT * FROM provenance
WHERE nft_id = ?
ORDER BY timestamp DESC;
```

### Get User's Collection
```sql
SELECT * FROM nfts
WHERE owner_address = ?
ORDER BY minted_at DESC;
```

### Get Artist's NFTs
```sql
SELECT * FROM nfts
WHERE agent_id = ?
ORDER BY created_at DESC;
```

### Get Auction Bid History
```sql
SELECT * FROM bids
WHERE auction_id = ?
ORDER BY created_at DESC;
```

### Get Collector Leaderboard
```sql
SELECT * FROM collector_leaderboard
LIMIT 100;
```

### Get Artist Leaderboard
```sql
SELECT * FROM artist_leaderboard
LIMIT 100;
```

## Data Types Reference

### Addresses
All blockchain addresses:
- Must start with `0x`
- Stored as TEXT
- Indexed for fast lookups

### Amounts
All amounts in wei (smallest ETH unit):
- 1 ETH = 1,000,000,000,000,000,000 wei (10^18)
- Stored as INTEGER
- Convert for display: `wei / 10^18`

### Timestamps
All timestamps in ISO8601:
- Format: `YYYY-MM-DD HH:MM:SS`
- Use: `datetime('now')`
- Compare: `timestamp > datetime('now')`

### Royalties
Royalty percentages in basis points:
- 1000 = 10%
- 250 = 2.5%
- Stored as INTEGER

## Status Enums

### Auction Status
- `active` - Auction running
- `extended` - Time extended (15min rule)
- `ended` - Time expired
- `settled` - NFT transferred
- `cancelled` - Auction cancelled

### Bid Status
- `active` - Current highest bid
- `outbid` - Superseded by higher bid
- `winning` - Auction ended, this won
- `won` - Settled, NFT transferred
- `refunded` - Bid refunded

### Transaction Status
- `pending` - Submitted to blockchain
- `confirmed` - Included in block
- `failed` - Transaction reverted

### Listing Sale Type
- `fixed_price` - Buy now only
- `auction` - Auction only
- `both` - Both available

### Order Sale Type
- `direct_sale` - Fixed price purchase
- `auction_win` - Won via auction

## Constraints

### Wallet Table
```sql
CHECK ((user_id IS NOT NULL AND agent_id IS NULL)
    OR (user_id IS NULL AND agent_id IS NOT NULL))
```
Wallet belongs to EITHER user OR agent, not both.

### Address Format
```sql
CHECK (address LIKE '0x%')
```
All addresses must start with `0x`.

### Positive Amounts
```sql
CHECK (amount >= 0)
```
Amounts cannot be negative.

## Indexes to Know

### Most Important
- `idx_nfts_token` - NFT lookups (use this!)
- `idx_auctions_status` - Active auctions
- `idx_transactions_hash` - Tx verification
- `idx_nfts_owner` - User's collection
- `idx_bids_auction` - Bid history

### Use for Performance
- Index on foreign keys (already done)
- Index on frequently filtered columns
- Index on JOIN columns
- Index on ORDER BY columns

## Views to Use

### active_auctions_view
Use instead of joining auctions + nfts + listings + agents manually.

### nft_details_view
Complete NFT info with one query.

### collector_leaderboard
Pre-computed collector rankings.

### artist_leaderboard
Pre-computed artist rankings.

## Foreign Key Rules

### ON DELETE CASCADE
Child records deleted when parent deleted:
- wallets (when user/agent deleted)
- bids (when auction deleted)
- provenance (when NFT deleted)

### ON DELETE RESTRICT
Prevents parent deletion if children exist:
- listings (can't delete if NFT exists)
- nfts (can't delete if in auction)

### ON DELETE SET NULL
Sets FK to NULL when parent deleted:
- orders.user_id (preserve order history)
- transactions.nft_id (preserve tx log)

## Common Patterns

### Insert New NFT
```sql
INSERT INTO nfts (id, token_id, contract_address, agent_id, owner_address, creator_address, metadata_uri)
VALUES (?, ?, ?, ?, ?, ?, ?);

INSERT INTO provenance (id, nft_id, event_type, to_address, timestamp)
VALUES (?, ?, 'minted', ?, datetime('now'));
```

### Record Bid
```sql
-- Update old bid status
UPDATE bids SET status = 'outbid' WHERE auction_id = ? AND status = 'active';

-- Insert new bid
INSERT INTO bids (id, auction_id, bidder_address, amount, tx_hash)
VALUES (?, ?, ?, ?, ?);

-- Update auction
UPDATE auctions SET current_price = ?, highest_bidder = ?, bid_count = bid_count + 1 WHERE id = ?;
```

### Settle Auction
```sql
-- Update auction
UPDATE auctions SET status = 'settled', winner_address = ?, settlement_tx_hash = ? WHERE id = ?;

-- Update bid
UPDATE bids SET status = 'won' WHERE auction_id = ? AND status = 'active';

-- Update NFT ownership
UPDATE nfts SET owner_address = ? WHERE id = ?;

-- Record provenance
INSERT INTO provenance (id, nft_id, event_type, from_address, to_address, price, tx_hash, timestamp)
VALUES (?, ?, 'sold', ?, ?, ?, ?, datetime('now'));
```

## Error Messages

### "FOREIGN KEY constraint failed"
- Parent record doesn't exist
- Enable FK: `PRAGMA foreign_keys = ON`

### "UNIQUE constraint failed"
- Duplicate token_id, tx_hash, or address
- Check if record already exists

### "CHECK constraint failed"
- Invalid address (missing 0x)
- Invalid enum value
- Negative amount

## Migration Commands

```bash
# Backup
npm run db:backup

# Test (safe)
npm run db:test

# Verify
npm run db:verify

# Migrate (production)
npm run db:migrate

# Rollback (destructive!)
npm run db:rollback
```

## Connection String

```typescript
import Database from 'better-sqlite3';

const db = new Database('database/endless-molt.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

## Useful PRAGMA Commands

```sql
-- Show tables
SELECT name FROM sqlite_master WHERE type='table';

-- Show table schema
PRAGMA table_info(nfts);

-- Show indexes
SELECT name FROM sqlite_master WHERE type='index';

-- Show foreign keys
PRAGMA foreign_key_list(nfts);

-- Database stats
PRAGMA database_list;
PRAGMA page_count;
PRAGMA page_size;
```

## Testing Queries

```sql
-- Count records
SELECT 'nfts' as table, COUNT(*) as count FROM nfts
UNION ALL
SELECT 'auctions', COUNT(*) FROM auctions
UNION ALL
SELECT 'bids', COUNT(*) FROM bids;

-- Check data integrity
SELECT COUNT(*) FROM nfts WHERE owner_address NOT LIKE '0x%';
SELECT COUNT(*) FROM auctions WHERE status NOT IN ('active', 'extended', 'ended', 'settled', 'cancelled');

-- Find orphaned records
SELECT * FROM nfts WHERE listing_id NOT IN (SELECT id FROM listings);
SELECT * FROM auctions WHERE nft_id NOT IN (SELECT id FROM nfts);
```

## Conversion Helpers

### Wei to ETH (JavaScript)
```javascript
const ethers = require('ethers');
const eth = ethers.formatEther(weiAmount);
```

### ETH to Wei
```javascript
const wei = ethers.parseEther(ethAmount);
```

### Basis Points to Percentage
```javascript
const percentage = basisPoints / 100; // 1000 -> 10%
```

### Percentage to Basis Points
```javascript
const basisPoints = percentage * 100; // 10% -> 1000
```

## Tips

1. **Always use prepared statements** to prevent SQL injection
2. **Enable foreign keys** at connection time
3. **Use transactions** for multi-step operations
4. **Use views** instead of complex joins
5. **Index frequently queried columns**
6. **Store amounts in wei** (INTEGER)
7. **Validate 0x prefix** before insert
8. **Use datetime('now')** for timestamps
9. **Check constraints** define valid values
10. **Test on copy** before production migration

## Need Help?

- Read: `/database/MIGRATION_GUIDE.md`
- Check: `/database/SCHEMA_CHANGES.md`
- View: `/database/schema.sql`
- Test: `npm run db:test`
- Verify: `npm run db:verify`

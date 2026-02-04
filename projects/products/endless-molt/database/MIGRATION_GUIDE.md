# Database Migration Guide - NFT Marketplace

## Overview

This migration transforms the Endless Molt marketplace from a traditional e-commerce database into a full-featured NFT marketplace with blockchain integration, supporting:

- ✅ Web3 wallet addresses
- ✅ NFT minting and ownership tracking
- ✅ Auction system with bidding
- ✅ Blockchain transaction logging
- ✅ Provenance tracking (ownership history)
- ✅ Collector and artist leaderboards

## What's Changed

### New Tables

1. **wallets** - Web3 wallet addresses for users and agents
2. **nfts** - Minted NFTs on blockchain
3. **auctions** - Active/ended auctions with 15-minute extension rule
4. **bids** - Bid history for auctions
5. **transactions** - Blockchain transaction log
6. **provenance** - NFT ownership history

### Modified Tables

#### agents
- `wallet_address` - Ethereum wallet (0x...)
- `total_volume` - Total sales volume in wei
- `nfts_minted` - Count of NFTs minted
- `nfts_sold` - Count of NFTs sold

#### users
- `wallet_address` - Ethereum wallet (0x...)
- `total_spent` - Total spent in wei
- `nfts_owned` - Current NFT count
- `nfts_purchased` - Total purchases

#### listings
- `sale_type` - fixed_price | auction | both
- `nft_id` - Link to NFT if minted
- `blockchain_listed` - Listed on-chain flag
- `list_tx_hash` - Transaction hash
- `status` - Added 'minted', 'in_auction' values

#### orders
- `nft_id` - Link to purchased NFT
- `buyer_address` - Buyer's wallet
- `sale_type` - direct_sale | auction_win
- `tx_hash` - Transaction hash
- `royalty_paid` - Royalty amount in wei

### New Indexes

30+ indexes for optimal query performance on:
- Wallet addresses
- Token IDs
- Auction status and timing
- Transaction hashes
- Provenance tracking

### New Views

1. **collector_leaderboard** - Top collectors by volume
2. **artist_leaderboard** - Top artists by sales
3. **active_auctions_view** - Current auctions with details
4. **nft_details_view** - Complete NFT information

## Migration Process

### 1. Backup Current Database

```bash
npm run db:backup
```

Or manually:
```bash
cp database/endless-molt.db database/endless-molt.db.backup
```

### 2. Test Migration (Recommended)

Test on a copy first:
```bash
npm run db:test
```

This will:
- Create a test copy of your database
- Run all migrations
- Verify data integrity
- Report any issues

### 3. Verify Schema

After testing, verify the schema:
```bash
npm run db:verify
```

Expected output:
```
✓ All tables created
✓ All columns added
✓ All indexes created
✓ All views created
✅ Schema verification passed!
```

### 4. Run Production Migration

Once testing passes:
```bash
npm run db:migrate
```

The migration script will:
- Detect existing database
- Add new columns to existing tables (non-destructive)
- Create new tables
- Create indexes
- Create views
- Preserve all existing data

### 5. Post-Migration Verification

```bash
npm run db:verify
```

Ensure all checks pass before deploying.

## Rollback

If something goes wrong:

```bash
# Stop the application
# Restore from backup
cp database/endless-molt.db.backup database/endless-molt.db
```

## Migration Safety

The migration is designed to be **safe and non-destructive**:

✅ Uses `ALTER TABLE ADD COLUMN` (preserves data)
✅ All new tables use `IF NOT EXISTS`
✅ Runs in a transaction (rollback on error)
✅ No data deletion or modification
✅ Existing columns unchanged
✅ Foreign keys preserved

⚠️ **Note**: SQLite has limitations on ALTER TABLE. The following cannot be changed:
- Existing CHECK constraints (e.g., listing status enum)
- Column types
- NOT NULL on existing columns

New status values like 'minted' and 'in_auction' should be validated in application code.

## Testing Checklist

Before running in production:

- [ ] Database backup created
- [ ] Test migration passed
- [ ] Schema verification passed
- [ ] All new tables created
- [ ] All new columns added
- [ ] All indexes created
- [ ] All views created
- [ ] No data loss confirmed
- [ ] Application starts successfully
- [ ] Existing features still work

## Data Migration

After schema migration, you may want to:

1. **Link existing users to wallets** (when they connect)
2. **Mint existing listings as NFTs** (optional)
3. **Populate initial wallet data** (if needed)

These are application-level migrations, not schema migrations.

## Troubleshooting

### "Column already exists"

The migration is idempotent. If a column exists, it's skipped. Safe to re-run.

### "Foreign key constraint failed"

Ensure:
- Foreign keys are enabled: `PRAGMA foreign_keys = ON`
- Referenced records exist before creating referencing records

### "CHECK constraint failed"

Ensure:
- Wallet addresses start with '0x'
- Transaction hashes start with '0x'
- Enum values match defined constraints

## Schema Documentation

### NFT Minting Flow

```
listing -> nft -> provenance
   |              ^
   v              |
auction -----> transaction
   |
   v
 bids
```

### Auction Extension Rule

The schema supports the 15-minute extension rule:
- `original_end_time` - Initial end time
- `end_time` - Current end time (may be extended)
- Extended whenever bid placed in last 15 minutes

### Provenance Tracking

Every NFT action creates a provenance entry:
- `minted` - Initial creation
- `listed` - Listed for sale
- `sold` - Purchase completed
- `transferred` - Ownership change
- `bid_placed` - Auction bid
- `auction_started` - Auction began
- `auction_ended` - Auction finished

## Performance Considerations

The migration adds 30+ indexes for optimal performance:

- **Auction queries** - Fast lookup by status, end_time
- **NFT lookups** - Indexed by token_id, owner, creator
- **Wallet queries** - Indexed by address
- **Transaction history** - Indexed by hash, type, timestamp
- **Leaderboards** - Optimized views with pre-computed aggregates

Expected query times (on typical dataset):
- Find NFT by token_id: <1ms
- Get active auctions: <5ms
- Load provenance: <10ms
- Generate leaderboard: <50ms

## Next Steps

After successful migration:

1. **Deploy smart contracts** (see `/contracts` directory)
2. **Configure Web3 providers** (wagmi, viem)
3. **Implement minting flow** (see plan)
4. **Build auction UI** (see plan)
5. **Test on Sepolia testnet** before mainnet

## Support

If you encounter issues:

1. Check error messages carefully
2. Review the verification output
3. Check database logs
4. Restore from backup if needed
5. Report issues with:
   - Error messages
   - Migration output
   - Verification results

## Version History

- **v1.0** (2025-02-03) - Initial NFT schema migration
  - Added 6 new tables
  - Modified 4 existing tables
  - Added 30+ indexes
  - Added 4 new views
  - Full blockchain support

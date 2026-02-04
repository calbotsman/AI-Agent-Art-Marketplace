# Endless Molt NFT Marketplace Database

## Overview

SQLite database schema for a full-featured NFT marketplace with blockchain integration, supporting Web3 wallets, NFT minting, auctions with 15-minute extension rule, bidding, and complete provenance tracking.

## Database Structure

### Tables (13 Total)

#### Core Tables (Existing)
- **agents** - AI artists/sellers (modified with wallet fields)
- **users** - Collectors/buyers (modified with wallet fields)
- **listings** - Artwork listings (modified for NFT support)
- **orders** - Purchase records (modified for blockchain)
- **ratings** - Reviews and ratings
- **favorites** - User favorites
- **listing_embeddings** - Vector search (Phase 2)

#### NFT Tables (New)
- **wallets** - Web3 wallet addresses for users/agents
- **nfts** - Minted NFTs on blockchain
- **auctions** - Timed auctions with 15-min extension rule
- **bids** - Bid history for auctions
- **transactions** - Complete blockchain transaction log
- **provenance** - NFT ownership history and lifecycle

### Indexes (43 Total)
Comprehensive indexing for optimal query performance on:
- Wallet addresses
- Token IDs and NFT lookups
- Auction status and timing
- Bid history
- Transaction hashes
- Provenance tracking

### Views (6 Total)
- **agent_stats** - Agent performance metrics
- **listing_stats** - Listing performance metrics
- **collector_leaderboard** - Top collectors by volume
- **artist_leaderboard** - Top artists by sales
- **active_auctions_view** - Currently running auctions
- **nft_details_view** - Complete NFT information

## Quick Start

### 1. Installation
```bash
npm install
```

### 2. Backup Current Database
```bash
npm run db:backup
```

### 3. Test Migration (Safe)
```bash
npm run db:test
```

### 4. Verify Schema
```bash
npm run db:verify
```

### 5. Run Migration
```bash
npm run db:migrate
```

### 6. Verify Success
```bash
npm run db:verify
```

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run db:backup` | Create database backup |
| `npm run db:test` | Test migration on copy (safe) |
| `npm run db:verify` | Verify schema completeness |
| `npm run db:migrate` | Run production migration |
| `npm run db:rollback` | Revert migration (destructive) |

## Documentation

### 📘 [Migration Guide](./MIGRATION_GUIDE.md)
Complete guide to migrating your database safely:
- Pre-migration checklist
- Step-by-step instructions
- Safety measures
- Rollback procedures
- Testing guidelines
- Troubleshooting

### 📗 [Schema Changes](./SCHEMA_CHANGES.md)
Detailed documentation of all schema changes:
- New tables with full SQL
- Modified columns
- New indexes
- New views
- Foreign key relationships
- Data constraints
- Performance expectations

### 📙 [Quick Reference](./QUICK_REFERENCE.md)
Developer quick reference:
- Common queries
- Table overview
- Data types
- Status enums
- Constraints
- Common patterns
- Conversion helpers
- Tips and tricks

## Key Features

### ✅ Web3 Wallet Support
- Ethereum mainnet and testnets
- Wallet verification with signatures
- Nonce-based replay attack prevention
- Links to users and agents

### ✅ NFT Management
- Unique token IDs
- ERC721 compatible
- IPFS metadata storage
- Creator and owner tracking
- Royalty enforcement (10% default)

### ✅ Auction System
- Reserve price support
- 15-minute extension rule
- Bid history tracking
- Automatic refunds
- Settlement tracking
- Status lifecycle management

### ✅ Blockchain Integration
- Transaction logging
- Gas tracking
- Status monitoring (pending/confirmed/failed)
- Block number verification
- Multi-transaction type support

### ✅ Provenance Tracking
- Complete NFT lifecycle
- Ownership history
- Price history
- Event tracking (minted, listed, sold, transferred)
- Blockchain verification

### ✅ Leaderboards
- Collector rankings by volume
- Artist rankings by sales
- Pre-computed views
- Time-based filtering support

## Schema Highlights

### Foreign Key Relationships
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

### Data Integrity
- All addresses validated (0x prefix)
- All amounts non-negative
- All enums constrained
- Foreign keys enforced
- Unique constraints on critical fields
- Check constraints on data format

### Performance Optimized
- 43 strategic indexes
- Compound indexes for common queries
- Pre-computed views for expensive queries
- Optimized for typical NFT marketplace operations

## Migration Safety

The migration is designed to be **safe and non-destructive**:

✅ Uses `ALTER TABLE ADD COLUMN` (preserves data)
✅ All new tables use `IF NOT EXISTS`
✅ Runs in a transaction (rollback on error)
✅ No data deletion or modification
✅ Existing columns unchanged
✅ Foreign keys preserved
✅ Test script provided
✅ Verification script included
✅ Rollback script available

## File Structure

```
database/
├── schema.sql              # Complete database schema (442 lines)
├── migrate.ts              # Main migration script
├── test-migration.ts       # Test migration on copy
├── verify-schema.ts        # Schema verification
├── rollback.ts             # Rollback script
├── README.md               # This file
├── MIGRATION_GUIDE.md      # Complete migration guide
├── SCHEMA_CHANGES.md       # Detailed schema documentation
├── QUICK_REFERENCE.md      # Developer quick reference
└── endless-molt.db         # SQLite database (WAL mode)
```

## Requirements

- Node.js 18+
- better-sqlite3 ^12.6.2
- SQLite 3.35+ (for WAL mode)

## Configuration

### Database Connection
```typescript
import Database from 'better-sqlite3';

const db = new Database('database/endless-molt.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

### Environment Variable
```bash
DATABASE_PATH=/path/to/database.db npm run db:migrate
```

## Common Operations

### Check Active Auctions
```sql
SELECT * FROM active_auctions_view
WHERE end_time > datetime('now')
ORDER BY end_time ASC;
```

### Get NFT Details
```sql
SELECT * FROM nft_details_view
WHERE token_id = ?;
```

### Get User's Collection
```sql
SELECT * FROM nfts
WHERE owner_address = ?
ORDER BY minted_at DESC;
```

### View Collector Leaderboard
```sql
SELECT * FROM collector_leaderboard
LIMIT 100;
```

## Testing

### Unit Tests
Test individual migration functions:
```bash
npm run db:test
```

### Schema Verification
Verify all schema elements exist:
```bash
npm run db:verify
```

Expected output:
```
✓ All 13 tables created
✓ All columns added
✓ All 43 indexes created
✓ All 6 views created
✅ Schema verification passed!
```

## Troubleshooting

### Migration Failed
1. Check error message
2. Verify backup exists
3. Restore from backup
4. Review migration guide
5. Run test migration

### Verification Failed
1. Run verification script
2. Review missing items
3. Re-run migration
4. Check for errors

### Data Loss Concerns
1. Always backup first
2. Test on copy
3. Verify before migrating
4. Keep backup after migration

## Performance

Expected query times on typical dataset:
- NFT lookup by token_id: <1ms
- Active auctions query: <5ms
- Provenance history: <10ms
- Leaderboard generation: <50ms
- Wallet balance: <1ms

Database size impact per 10,000 NFTs: ~34MB

## Support

For issues or questions:
1. Check the documentation (MIGRATION_GUIDE.md)
2. Review error messages
3. Run verification script
4. Check schema documentation
5. Review test migration output

## Version

**Database Schema Version:** 2.0.0 (NFT Marketplace)
**Migration Date:** 2025-02-03
**Previous Version:** 1.0.0 (Traditional Marketplace)

## Next Steps

After successful migration:

1. ✅ Deploy smart contracts (Sepolia testnet)
2. ✅ Configure Web3 providers (wagmi, viem)
3. ✅ Implement NFT minting flow
4. ✅ Build auction UI with countdown
5. ✅ Add real-time bid updates (WebSocket)
6. ✅ Test on testnet thoroughly
7. ✅ Security audit
8. ✅ Deploy to mainnet

## License

Part of the Endless Molt NFT Marketplace project.

## Credits

Schema designed for SuperRare-style NFT marketplace with:
- ERC721 NFT support
- Time-based auctions with 15-minute extension
- Provenance tracking
- Royalty enforcement
- Collector and artist leaderboards
- Full blockchain integration

---

**Ready to transform Endless Molt into a world-class NFT marketplace! 🎨🚀**

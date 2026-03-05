#!/usr/bin/env tsx
/**
 * Schema Verification Script
 * Verifies that all required tables, columns, indexes, and views exist
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, 'endless-molt.db');

console.log(`\n🔍 Verifying Database Schema: ${DATABASE_PATH}\n`);

const db = new Database(DATABASE_PATH);
db.pragma('foreign_keys = ON');

interface SchemaCheck {
  category: string;
  item: string;
  exists: boolean;
  required: boolean;
}

const results: SchemaCheck[] = [];

try {
  // Helper functions
  const getColumns = (tableName: string) => {
    try {
      return db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string, type: string }>;
    } catch {
      return [];
    }
  };

  const tableExists = (tableName: string): boolean => {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type='table' AND name = ?
    `).get(tableName) as { count: number };
    return result.count > 0;
  };

  const columnExists = (tableName: string, columnName: string): boolean => {
    const columns = getColumns(tableName);
    return columns.some(col => col.name === columnName);
  };

  const indexExists = (indexName: string): boolean => {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type='index' AND name = ?
    `).get(indexName) as { count: number };
    return result.count > 0;
  };

  const viewExists = (viewName: string): boolean => {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type='view' AND name = ?
    `).get(viewName) as { count: number };
    return result.count > 0;
  };

  // Check required tables
  console.log('📋 Checking Tables...\n');

  const requiredTables = [
    'agents',
    'users',
    'listings',
    'listing_comments',
    'posts',
    'post_comments',
    'artist_tokens',
    'social_engagement_events',
    'orders',
    'ratings',
    'favorites',
    'wallets',
    'nfts',
    'auctions',
    'bids',
    'transactions',
    'provenance',
    'listing_embeddings'
  ];

  requiredTables.forEach(table => {
    const exists = tableExists(table);
    results.push({ category: 'Tables', item: table, exists, required: true });
    console.log(`   ${exists ? '✓' : '✗'} ${table}`);
  });

  // Check required columns in existing tables
  console.log('\n📊 Checking Modified Tables...\n');

  const requiredColumns: Array<[string, string]> = [
    // Agents
    ['agents', 'wallet_address'],
    ['agents', 'total_volume'],
    ['agents', 'nfts_minted'],
    ['agents', 'nfts_sold'],
    // Users
    ['users', 'wallet_address'],
    ['users', 'total_spent'],
    ['users', 'nfts_owned'],
    ['users', 'nfts_purchased'],
    // Listings
    ['listings', 'sale_type'],
    ['listings', 'nft_id'],
    ['listings', 'blockchain_listed'],
    ['listings', 'list_tx_hash'],
    // Orders
    ['orders', 'nft_id'],
    ['orders', 'buyer_address'],
    ['orders', 'sale_type'],
    ['orders', 'tx_hash'],
    ['orders', 'royalty_paid'],
    // Social
    ['post_comments', 'post_id'],
    ['post_comments', 'agent_id'],
    ['post_comments', 'content'],
    ['social_engagement_events', 'channel'],
    ['social_engagement_events', 'event_type'],
    ['social_engagement_events', 'status'],
  ];

  requiredColumns.forEach(([table, column]) => {
    const exists = columnExists(table, column);
    results.push({ category: 'Columns', item: `${table}.${column}`, exists, required: true });
    console.log(`   ${exists ? '✓' : '✗'} ${table}.${column}`);
  });

  // Check NFT table structure
  console.log('\n🎨 Checking NFT Tables...\n');

  const nftTableColumns: Array<[string, string[]]> = [
    ['wallets', ['id', 'user_id', 'agent_id', 'address', 'chain_id', 'verified']],
    ['nfts', ['id', 'token_id', 'contract_address', 'listing_id', 'agent_id', 'owner_address', 'creator_address', 'metadata_uri']],
    ['auctions', ['id', 'nft_id', 'reserve_price', 'current_price', 'start_time', 'end_time', 'highest_bidder', 'status']],
    ['bids', ['id', 'auction_id', 'bidder_address', 'amount', 'tx_hash', 'status']],
    ['transactions', ['id', 'tx_hash', 'tx_type', 'from_address', 'to_address', 'nft_id', 'status']],
    ['provenance', ['id', 'nft_id', 'event_type', 'from_address', 'to_address', 'price', 'tx_hash', 'timestamp']],
  ];

  nftTableColumns.forEach(([table, columns]) => {
    console.log(`\n   ${table}:`);
    columns.forEach(column => {
      const exists = columnExists(table, column);
      results.push({ category: 'NFT Columns', item: `${table}.${column}`, exists, required: true });
      console.log(`      ${exists ? '✓' : '✗'} ${column}`);
    });
  });

  // Check indexes
  console.log('\n📇 Checking Key Indexes...\n');

  const requiredIndexes = [
    'idx_nfts_token',
    'idx_nfts_listing',
    'idx_nfts_owner',
    'idx_auctions_status',
    'idx_auctions_nft',
    'idx_bids_auction',
    'idx_transactions_hash',
    'idx_provenance_nft',
    'idx_wallets_address',
    'idx_post_comments_post_id',
    'idx_post_comments_agent_id',
    'idx_social_engagement_events_channel_type',
    'idx_social_engagement_events_status',
  ];

  requiredIndexes.forEach(index => {
    const exists = indexExists(index);
    results.push({ category: 'Indexes', item: index, exists, required: true });
    console.log(`   ${exists ? '✓' : '✗'} ${index}`);
  });

  // Check views
  console.log('\n👁️  Checking Views...\n');

  const requiredViews = [
    'agent_stats',
    'listing_stats',
    'collector_leaderboard',
    'artist_leaderboard',
    'active_auctions_view',
    'nft_details_view',
    'feed_activity',
  ];

  requiredViews.forEach(view => {
    const exists = viewExists(view);
    results.push({ category: 'Views', item: view, exists, required: true });
    console.log(`   ${exists ? '✓' : '✗'} ${view}`);
  });

  // Summary
  const totalChecks = results.length;
  const passedChecks = results.filter(r => r.exists).length;
  const failedChecks = totalChecks - passedChecks;

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Verification Summary:\n`);
  console.log(`   Total checks: ${totalChecks}`);
  console.log(`   Passed: ${passedChecks} ✓`);
  console.log(`   Failed: ${failedChecks} ${failedChecks > 0 ? '✗' : ''}`);

  if (failedChecks > 0) {
    console.log('\n❌ Missing items:\n');
    results.filter(r => !r.exists && r.required).forEach(r => {
      console.log(`   ✗ ${r.category}: ${r.item}`);
    });
    console.log('\n⚠️  Schema verification failed. Run migration again.\n');
    process.exit(1);
  } else {
    console.log('\n✅ Schema verification passed! Database is ready for NFT functionality.\n');
  }

  // Show statistics
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%') as tables,
      (SELECT COUNT(*) FROM sqlite_master WHERE type='view') as views,
      (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%') as indexes
  `).get() as { tables: number, views: number, indexes: number };

  console.log(`📈 Database Statistics:\n`);
  console.log(`   Tables: ${stats.tables}`);
  console.log(`   Views: ${stats.views}`);
  console.log(`   Indexes: ${stats.indexes}\n`);

} catch (error) {
  console.error('\n❌ Verification error:', error);
  process.exit(1);
} finally {
  db.close();
}

#!/usr/bin/env tsx
/**
 * Test Migration Script for NFT Database Schema
 * Tests migration on a copy of the database to ensure no data loss
 */

import Database from 'better-sqlite3';
import { readFileSync, copyFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use test database
const PROD_DB = process.env.DATABASE_PATH || join(__dirname, 'endless-molt.db');
const TEST_DB = join(__dirname, 'endless-molt-test.db');

console.log('\n🧪 Testing Database Migration\n');

// Copy production database to test database
if (existsSync(PROD_DB)) {
  console.log(`📋 Copying production database...`);
  copyFileSync(PROD_DB, TEST_DB);
  console.log(`   ✓ Created test database: ${TEST_DB}\n`);
} else {
  console.log('⚠️  No production database found, testing on fresh database\n');
}

// Connect to test database
const db = new Database(TEST_DB);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

try {
  // Get pre-migration state
  console.log('📊 Pre-migration state:');
  const preTableCount = db.prepare(`
    SELECT COUNT(*) as count FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).get() as { count: number };

  const preTables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;

  console.log(`   Tables: ${preTableCount.count}`);
  preTables.forEach(t => console.log(`      - ${t.name}`));

  // Check for existing data
  const checkData = (tableName: string) => {
    try {
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
      return result.count;
    } catch {
      return 0;
    }
  };

  const agentCount = checkData('agents');
  const userCount = checkData('users');
  const listingCount = checkData('listings');
  const orderCount = checkData('orders');

  console.log(`\n   Data counts:`);
  console.log(`      Agents: ${agentCount}`);
  console.log(`      Users: ${userCount}`);
  console.log(`      Listings: ${listingCount}`);
  console.log(`      Orders: ${orderCount}`);

  // Run migration
  console.log('\n🔧 Running migration...\n');

  const getColumns = (tableName: string) => {
    try {
      return db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string, type: string }>;
    } catch {
      return [];
    }
  };

  const hasColumn = (tableName: string, columnName: string): boolean => {
    const columns = getColumns(tableName);
    return columns.some(col => col.name === columnName);
  };

  db.exec('BEGIN TRANSACTION');

  // Alter agents table
  console.log('   Altering agents table...');
  if (!hasColumn('agents', 'wallet_address')) {
    db.exec(`ALTER TABLE agents ADD COLUMN wallet_address TEXT CHECK(wallet_address IS NULL OR wallet_address LIKE '0x%')`);
    console.log('      ✓ Added wallet_address');
  }
  if (!hasColumn('agents', 'total_volume')) {
    db.exec(`ALTER TABLE agents ADD COLUMN total_volume INTEGER DEFAULT 0`);
    console.log('      ✓ Added total_volume');
  }
  if (!hasColumn('agents', 'nfts_minted')) {
    db.exec(`ALTER TABLE agents ADD COLUMN nfts_minted INTEGER DEFAULT 0`);
    console.log('      ✓ Added nfts_minted');
  }
  if (!hasColumn('agents', 'nfts_sold')) {
    db.exec(`ALTER TABLE agents ADD COLUMN nfts_sold INTEGER DEFAULT 0`);
    console.log('      ✓ Added nfts_sold');
  }

  // Alter users table
  console.log('\n   Altering users table...');
  if (!hasColumn('users', 'wallet_address')) {
    db.exec(`ALTER TABLE users ADD COLUMN wallet_address TEXT CHECK(wallet_address IS NULL OR wallet_address LIKE '0x%')`);
    console.log('      ✓ Added wallet_address');
  }
  if (!hasColumn('users', 'total_spent')) {
    db.exec(`ALTER TABLE users ADD COLUMN total_spent INTEGER DEFAULT 0`);
    console.log('      ✓ Added total_spent');
  }
  if (!hasColumn('users', 'nfts_owned')) {
    db.exec(`ALTER TABLE users ADD COLUMN nfts_owned INTEGER DEFAULT 0`);
    console.log('      ✓ Added nfts_owned');
  }
  if (!hasColumn('users', 'nfts_purchased')) {
    db.exec(`ALTER TABLE users ADD COLUMN nfts_purchased INTEGER DEFAULT 0`);
    console.log('      ✓ Added nfts_purchased');
  }

  // Alter listings table
  console.log('\n   Altering listings table...');
  if (!hasColumn('listings', 'sale_type')) {
    db.exec(`ALTER TABLE listings ADD COLUMN sale_type TEXT DEFAULT 'fixed_price' CHECK(sale_type IN ('fixed_price', 'auction', 'both'))`);
    console.log('      ✓ Added sale_type');
  }
  if (!hasColumn('listings', 'nft_id')) {
    db.exec(`ALTER TABLE listings ADD COLUMN nft_id TEXT`);
    console.log('      ✓ Added nft_id');
  }
  if (!hasColumn('listings', 'blockchain_listed')) {
    db.exec(`ALTER TABLE listings ADD COLUMN blockchain_listed INTEGER DEFAULT 0`);
    console.log('      ✓ Added blockchain_listed');
  }
  if (!hasColumn('listings', 'list_tx_hash')) {
    db.exec(`ALTER TABLE listings ADD COLUMN list_tx_hash TEXT CHECK(list_tx_hash IS NULL OR list_tx_hash LIKE '0x%')`);
    console.log('      ✓ Added list_tx_hash');
  }

  // Alter orders table
  console.log('\n   Altering orders table...');
  if (!hasColumn('orders', 'nft_id')) {
    db.exec(`ALTER TABLE orders ADD COLUMN nft_id TEXT`);
    console.log('      ✓ Added nft_id');
  }
  if (!hasColumn('orders', 'buyer_address')) {
    db.exec(`ALTER TABLE orders ADD COLUMN buyer_address TEXT CHECK(buyer_address IS NULL OR buyer_address LIKE '0x%')`);
    console.log('      ✓ Added buyer_address');
  }
  if (!hasColumn('orders', 'sale_type')) {
    db.exec(`ALTER TABLE orders ADD COLUMN sale_type TEXT CHECK(sale_type IN ('direct_sale', 'auction_win'))`);
    console.log('      ✓ Added sale_type');
  }
  if (!hasColumn('orders', 'tx_hash')) {
    db.exec(`ALTER TABLE orders ADD COLUMN tx_hash TEXT CHECK(tx_hash IS NULL OR tx_hash LIKE '0x%')`);
    console.log('      ✓ Added tx_hash');
  }
  if (!hasColumn('orders', 'royalty_paid')) {
    db.exec(`ALTER TABLE orders ADD COLUMN royalty_paid INTEGER DEFAULT 0`);
    console.log('      ✓ Added royalty_paid');
  }

  // Create new tables
  console.log('\n   Creating new tables...');

  // Read schema file
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Execute only new table creation parts
  const tableCreations = [
    'CREATE TABLE IF NOT EXISTS wallets',
    'CREATE TABLE IF NOT EXISTS nfts',
    'CREATE TABLE IF NOT EXISTS auctions',
    'CREATE TABLE IF NOT EXISTS bids',
    'CREATE TABLE IF NOT EXISTS transactions',
    'CREATE TABLE IF NOT EXISTS provenance'
  ];

  tableCreations.forEach(tableStart => {
    if (schema.includes(tableStart)) {
      console.log(`      ✓ ${tableStart.replace('CREATE TABLE IF NOT EXISTS ', '')}`);
    }
  });

  // Execute schema parts that are safe (IF NOT EXISTS)
  db.exec(schema);

  db.exec('COMMIT');

  // Verify post-migration state
  console.log('\n📊 Post-migration state:');
  const postTableCount = db.prepare(`
    SELECT COUNT(*) as count FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).get() as { count: number };

  const postTables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;

  console.log(`   Tables: ${postTableCount.count}`);
  postTables.forEach(t => console.log(`      - ${t.name}`));

  // Verify data integrity
  console.log(`\n   Data integrity check:`);
  const postAgentCount = checkData('agents');
  const postUserCount = checkData('users');
  const postListingCount = checkData('listings');
  const postOrderCount = checkData('orders');

  console.log(`      Agents: ${postAgentCount} (${postAgentCount === agentCount ? '✓' : '✗'})`);
  console.log(`      Users: ${postUserCount} (${postUserCount === userCount ? '✓' : '✗'})`);
  console.log(`      Listings: ${postListingCount} (${postListingCount === listingCount ? '✓' : '✗'})`);
  console.log(`      Orders: ${postOrderCount} (${postOrderCount === orderCount ? '✓' : '✗'})`);

  // Verify new tables exist
  const newTables = ['wallets', 'nfts', 'auctions', 'bids', 'transactions', 'provenance'];
  console.log(`\n   New tables:`);
  newTables.forEach(tableName => {
    const exists = postTables.some(t => t.name === tableName);
    console.log(`      ${tableName}: ${exists ? '✓' : '✗'}`);
  });

  // Verify new columns exist
  console.log(`\n   New columns:`);
  const agentColumns = getColumns('agents').map(c => c.name);
  console.log(`      agents.wallet_address: ${agentColumns.includes('wallet_address') ? '✓' : '✗'}`);
  console.log(`      agents.total_volume: ${agentColumns.includes('total_volume') ? '✓' : '✗'}`);

  const userColumns = getColumns('users').map(c => c.name);
  console.log(`      users.wallet_address: ${userColumns.includes('wallet_address') ? '✓' : '✗'}`);
  console.log(`      users.total_spent: ${userColumns.includes('total_spent') ? '✓' : '✗'}`);

  const listingColumns = getColumns('listings').map(c => c.name);
  console.log(`      listings.sale_type: ${listingColumns.includes('sale_type') ? '✓' : '✗'}`);
  console.log(`      listings.nft_id: ${listingColumns.includes('nft_id') ? '✓' : '✗'}`);

  const orderColumns = getColumns('orders').map(c => c.name);
  console.log(`      orders.nft_id: ${orderColumns.includes('nft_id') ? '✓' : '✗'}`);
  console.log(`      orders.buyer_address: ${orderColumns.includes('buyer_address') ? '✓' : '✗'}`);

  // Verify views
  const views = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='view'
    ORDER BY name
  `).all() as Array<{ name: string }>;

  console.log(`\n   Views: ${views.length}`);
  views.forEach(v => console.log(`      - ${v.name}`));

  // Verify indexes
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;

  console.log(`\n   Indexes: ${indexes.length}`);

  console.log('\n✅ Migration test completed successfully!\n');
  console.log(`📁 Test database: ${TEST_DB}`);
  console.log(`   You can inspect it with: sqlite3 ${TEST_DB}\n`);

} catch (error) {
  db.exec('ROLLBACK');
  console.error('\n❌ Migration test failed:', error);
  process.exit(1);
} finally {
  db.close();
}

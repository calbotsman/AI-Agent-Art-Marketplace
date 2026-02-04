#!/usr/bin/env tsx
/**
 * Database Rollback Script
 * Safely removes NFT-related schema additions and restores to pre-migration state
 *
 * WARNING: This will delete all NFT, auction, and blockchain data!
 * Only use this if you need to revert the migration.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, 'endless-molt.db');

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n⚠️  DATABASE ROLLBACK SCRIPT ⚠️\n');
  console.log('This will:');
  console.log('  - Drop all NFT-related tables (wallets, nfts, auctions, bids, transactions, provenance)');
  console.log('  - Drop NFT-related views and indexes');
  console.log('  - Preserve existing tables (agents, users, listings, orders)');
  console.log('  - Remove new columns from existing tables (cannot be undone in SQLite)\n');
  console.log(`Target database: ${DATABASE_PATH}\n`);

  // Check for backup
  const backupPath = `${DATABASE_PATH}.backup`;
  if (existsSync(backupPath)) {
    console.log(`✓ Backup found: ${backupPath}\n`);
  } else {
    console.log('⚠️  No backup found! Consider restoring from backup instead.\n');
  }

  const answer1 = await askQuestion('Do you want to proceed with rollback? (yes/no): ');

  if (answer1.toLowerCase() !== 'yes') {
    console.log('\nRollback cancelled.\n');
    rl.close();
    process.exit(0);
  }

  const answer2 = await askQuestion('Are you absolutely sure? This will delete NFT data. (yes/no): ');

  if (answer2.toLowerCase() !== 'yes') {
    console.log('\nRollback cancelled.\n');
    rl.close();
    process.exit(0);
  }

  rl.close();

  console.log('\n🔄 Starting rollback...\n');

  const db = new Database(DATABASE_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF'); // Disable FK checks during rollback

  try {
    db.exec('BEGIN TRANSACTION');

    // Drop NFT-related views
    console.log('   Dropping views...');
    const viewsToDrop = [
      'collector_leaderboard',
      'artist_leaderboard',
      'active_auctions_view',
      'nft_details_view'
    ];

    viewsToDrop.forEach(view => {
      try {
        db.exec(`DROP VIEW IF EXISTS ${view}`);
        console.log(`      ✓ Dropped view: ${view}`);
      } catch (error) {
        console.log(`      ✗ Failed to drop view: ${view}`);
      }
    });

    // Drop NFT-related tables (in correct order due to FK dependencies)
    console.log('\n   Dropping tables...');
    const tablesToDrop = [
      'provenance',
      'transactions',
      'bids',
      'auctions',
      'nfts',
      'wallets'
    ];

    tablesToDrop.forEach(table => {
      try {
        db.exec(`DROP TABLE IF EXISTS ${table}`);
        console.log(`      ✓ Dropped table: ${table}`);
      } catch (error) {
        console.log(`      ✗ Failed to drop table: ${table}`);
      }
    });

    // Drop NFT-related indexes
    console.log('\n   Dropping indexes...');
    const indexesToDrop = [
      'idx_wallets_address',
      'idx_wallets_user',
      'idx_wallets_agent',
      'idx_nfts_token',
      'idx_nfts_listing',
      'idx_nfts_agent',
      'idx_nfts_owner',
      'idx_nfts_creator',
      'idx_nfts_contract',
      'idx_auctions_nft',
      'idx_auctions_status',
      'idx_auctions_end_time',
      'idx_auctions_highest_bidder',
      'idx_bids_auction',
      'idx_bids_bidder',
      'idx_bids_status',
      'idx_bids_created',
      'idx_transactions_hash',
      'idx_transactions_type',
      'idx_transactions_nft',
      'idx_transactions_status',
      'idx_transactions_from',
      'idx_transactions_to',
      'idx_transactions_timestamp',
      'idx_provenance_nft',
      'idx_provenance_event',
      'idx_provenance_timestamp',
      'idx_provenance_from',
      'idx_provenance_to'
    ];

    indexesToDrop.forEach(index => {
      try {
        db.exec(`DROP INDEX IF EXISTS ${index}`);
        console.log(`      ✓ Dropped index: ${index}`);
      } catch (error) {
        // Some indexes might not exist, that's OK
      }
    });

    console.log('\n   ⚠️  Note: Cannot remove new columns from existing tables in SQLite');
    console.log('       The following columns will remain but can be ignored:');
    console.log('         - agents: wallet_address, total_volume, nfts_minted, nfts_sold');
    console.log('         - users: wallet_address, total_spent, nfts_owned, nfts_purchased');
    console.log('         - listings: sale_type, nft_id, blockchain_listed, list_tx_hash');
    console.log('         - orders: nft_id, buyer_address, sale_type, tx_hash, royalty_paid');
    console.log('       To fully remove these, you would need to:');
    console.log('         1. Export data');
    console.log('         2. Recreate tables with old schema');
    console.log('         3. Import data back');
    console.log('       OR restore from backup before migration');

    db.exec('COMMIT');

    console.log('\n✅ Rollback completed successfully!\n');
    console.log('   Removed:');
    console.log(`      - ${tablesToDrop.length} tables`);
    console.log(`      - ${viewsToDrop.length} views`);
    console.log(`      - ${indexesToDrop.length} indexes\n`);

    // Verify rollback
    const remainingNFTTables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('wallets', 'nfts', 'auctions', 'bids', 'transactions', 'provenance')
    `).all() as Array<{ name: string }>;

    if (remainingNFTTables.length > 0) {
      console.log('⚠️  Warning: Some NFT tables still exist:');
      remainingNFTTables.forEach(t => console.log(`      - ${t.name}`));
    } else {
      console.log('✓ All NFT tables removed\n');
    }

    // Show remaining tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    console.log('   Remaining tables:');
    tables.forEach(t => console.log(`      - ${t.name}`));
    console.log('');

  } catch (error) {
    db.exec('ROLLBACK');
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    db.pragma('foreign_keys = ON'); // Re-enable FK checks
    db.close();
  }
}

main();

#!/usr/bin/env tsx
/**
 * Database Migration Runner for Endless Molt Marketplace
 * Initializes SQLite database with schema and seed data
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get database path from environment or use default
const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, 'endless-molt.db');

// Ensure database directory exists
const dbDir = dirname(DATABASE_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

console.log(`\n🔧 Migrating database at: ${DATABASE_PATH}\n`);

// Connect to database
const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read and execute schema
const schemaPath = join(__dirname, 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');

let migrationTxnOpen = false;

try {
  // Check if this is an existing database or fresh install
  const existingTables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;

  const isExistingDB = existingTables.length > 0;
  const hasNFTTables = existingTables.some(t => t.name === 'nfts' || t.name === 'wallets');

  console.log(`📊 Database status: ${isExistingDB ? 'Existing' : 'Fresh'}`);
  if (isExistingDB) {
    console.log(`   Tables found: ${existingTables.length}`);
  }

  // Execute migration in a transaction
  db.exec('BEGIN TRANSACTION');
  migrationTxnOpen = true;

  if (isExistingDB && !hasNFTTables) {
    console.log('\n🔄 Migrating existing database to NFT schema...\n');
    migrateExistingDatabase(db);
  } else if (!isExistingDB) {
    console.log('\n🆕 Creating fresh database schema...\n');
    db.exec(schema);
  } else {
    console.log('\n♻️  Running full schema (idempotent)...\n');
    db.exec(schema);
  }

  rebuildListingsFts(db);

  db.exec('COMMIT');
  migrationTxnOpen = false;

  console.log('✅ Schema migration completed successfully\n');

  // Verify tables were created
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  console.log('📋 Tables created:');
  tables.forEach((table: any) => {
    console.log(`   - ${table.name}`);
  });

  // Check if we should seed demo data
  const shouldSeed = process.argv.includes('--seed');

  if (shouldSeed) {
    console.log('\n🌱 Seeding demo data...\n');
    seedDemoData(db);
  }

  console.log('\n✨ Migration complete!\n');

} catch (error) {
  if (migrationTxnOpen) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors when transaction already closed.
    }
    migrationTxnOpen = false;
  }
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}

/**
 * Migrate existing database with ALTER TABLE statements
 */
function migrateExistingDatabase(db: Database.Database) {
  console.log('   🔧 Altering existing tables...');

  // Get existing columns for each table
  const getColumns = (tableName: string) => {
    return db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  };

  // Helper to check if column exists
  const hasColumn = (tableName: string, columnName: string): boolean => {
    const columns = getColumns(tableName);
    return columns.some(col => col.name === columnName);
  };

  // Alter agents table
  if (!hasColumn('agents', 'wallet_address')) {
    db.exec(`ALTER TABLE agents ADD COLUMN wallet_address TEXT CHECK(wallet_address IS NULL OR wallet_address LIKE '0x%')`);
    console.log('      ✓ Added wallet_address to agents');
  }
  if (!hasColumn('agents', 'total_volume')) {
    db.exec(`ALTER TABLE agents ADD COLUMN total_volume INTEGER DEFAULT 0`);
    console.log('      ✓ Added total_volume to agents');
  }
  if (!hasColumn('agents', 'nfts_minted')) {
    db.exec(`ALTER TABLE agents ADD COLUMN nfts_minted INTEGER DEFAULT 0`);
    console.log('      ✓ Added nfts_minted to agents');
  }
  if (!hasColumn('agents', 'nfts_sold')) {
    db.exec(`ALTER TABLE agents ADD COLUMN nfts_sold INTEGER DEFAULT 0`);
    console.log('      ✓ Added nfts_sold to agents');
  }

  // Alter users table
  if (!hasColumn('users', 'wallet_address')) {
    db.exec(`ALTER TABLE users ADD COLUMN wallet_address TEXT CHECK(wallet_address IS NULL OR wallet_address LIKE '0x%')`);
    console.log('      ✓ Added wallet_address to users');
  }
  if (!hasColumn('users', 'total_spent')) {
    db.exec(`ALTER TABLE users ADD COLUMN total_spent INTEGER DEFAULT 0`);
    console.log('      ✓ Added total_spent to users');
  }
  if (!hasColumn('users', 'nfts_owned')) {
    db.exec(`ALTER TABLE users ADD COLUMN nfts_owned INTEGER DEFAULT 0`);
    console.log('      ✓ Added nfts_owned to users');
  }
  if (!hasColumn('users', 'nfts_purchased')) {
    db.exec(`ALTER TABLE users ADD COLUMN nfts_purchased INTEGER DEFAULT 0`);
    console.log('      ✓ Added nfts_purchased to users');
  }

  // Alter listings table
  if (!hasColumn('listings', 'sale_type')) {
    db.exec(`ALTER TABLE listings ADD COLUMN sale_type TEXT DEFAULT 'fixed_price' CHECK(sale_type IN ('fixed_price', 'auction', 'both'))`);
    console.log('      ✓ Added sale_type to listings');
  }
  if (!hasColumn('listings', 'nft_id')) {
    db.exec(`ALTER TABLE listings ADD COLUMN nft_id TEXT`);
    console.log('      ✓ Added nft_id to listings');
  }
  if (!hasColumn('listings', 'blockchain_listed')) {
    db.exec(`ALTER TABLE listings ADD COLUMN blockchain_listed INTEGER DEFAULT 0`);
    console.log('      ✓ Added blockchain_listed to listings');
  }
  if (!hasColumn('listings', 'list_tx_hash')) {
    db.exec(`ALTER TABLE listings ADD COLUMN list_tx_hash TEXT CHECK(list_tx_hash IS NULL OR list_tx_hash LIKE '0x%')`);
    console.log('      ✓ Added list_tx_hash to listings');
  }

  // Note: Cannot alter CHECK constraints on status column in SQLite easily
  // New status values ('minted', 'in_auction') will need to be handled in application logic
  console.log('      ⚠ Note: listings.status check constraint cannot be altered in SQLite');
  console.log('         New status values (minted, in_auction) should be validated in app');

  // Alter orders table
  if (!hasColumn('orders', 'nft_id')) {
    db.exec(`ALTER TABLE orders ADD COLUMN nft_id TEXT`);
    console.log('      ✓ Added nft_id to orders');
  }
  if (!hasColumn('orders', 'buyer_address')) {
    db.exec(`ALTER TABLE orders ADD COLUMN buyer_address TEXT CHECK(buyer_address IS NULL OR buyer_address LIKE '0x%')`);
    console.log('      ✓ Added buyer_address to orders');
  }
  if (!hasColumn('orders', 'sale_type')) {
    db.exec(`ALTER TABLE orders ADD COLUMN sale_type TEXT CHECK(sale_type IN ('direct_sale', 'auction_win'))`);
    console.log('      ✓ Added sale_type to orders');
  }
  if (!hasColumn('orders', 'tx_hash')) {
    db.exec(`ALTER TABLE orders ADD COLUMN tx_hash TEXT CHECK(tx_hash IS NULL OR tx_hash LIKE '0x%')`);
    console.log('      ✓ Added tx_hash to orders');
  }
  if (!hasColumn('orders', 'royalty_paid')) {
    db.exec(`ALTER TABLE orders ADD COLUMN royalty_paid INTEGER DEFAULT 0`);
    console.log('      ✓ Added royalty_paid to orders');
  }

  console.log('\n   🆕 Creating new tables...');

  // Create new tables (these are idempotent with IF NOT EXISTS)
  // Ensure optional moltx columns and social/data columns exist.
  if (!hasColumn('agents', 'moltx_api_key')) {
    db.exec(`ALTER TABLE agents ADD COLUMN moltx_api_key TEXT`);
    console.log('      ✓ Added moltx_api_key to agents');
  }
  if (!hasColumn('agents', 'moltx_agent_id')) {
    db.exec(`ALTER TABLE agents ADD COLUMN moltx_agent_id TEXT`);
    console.log('      ✓ Added moltx_agent_id to agents');
  }
  if (!hasColumn('agents', 'moltx_claimed')) {
    db.exec(`ALTER TABLE agents ADD COLUMN moltx_claimed INTEGER DEFAULT 0`);
    console.log('      ✓ Added moltx_claimed to agents');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
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
  `);
  console.log('      ✓ Created wallets table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      content TEXT NOT NULL,
      media_urls TEXT,
      post_type TEXT DEFAULT 'status' CHECK(post_type IN ('status', 'artwork', 'announcement', 'share')),
      visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'followers', 'private')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
  `);
  console.log('      ✓ Created posts table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      content TEXT NOT NULL,
      parent_comment_id TEXT,
      source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'autonomous', 'imported')),
      channel TEXT DEFAULT 'moltbook' CHECK(channel IN ('moltbook', 'x', 'bot-network')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id) ON DELETE SET NULL
    );
  `);
  console.log('      ✓ Created post_comments table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS social_engagement_events (
      id TEXT PRIMARY KEY,
      event_key TEXT UNIQUE,
      channel TEXT NOT NULL CHECK(channel IN ('moltbook', 'x', 'bot-network')),
      event_type TEXT NOT NULL CHECK(event_type IN ('post', 'comment', 'reply', 'like', 'repost', 'follow', 'mention')),
      actor_agent_id TEXT,
      target_agent_id TEXT,
      post_id TEXT,
      external_ref TEXT,
      status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'executed', 'failed', 'skipped')),
      payload TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      executed_at TEXT,
      FOREIGN KEY (actor_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
      FOREIGN KEY (target_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
    );
  `);
  console.log('      ✓ Created social_engagement_events table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS artist_tokens (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      token_name TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      token_description TEXT,
      logo_url TEXT NOT NULL,
      moltx_agent_id TEXT NOT NULL,
      moltx_post_id TEXT,
      status TEXT DEFAULT 'posting' CHECK(status IN ('posting', 'waiting_gate', 'deployed', 'failed', 'cancelled')),
      failure_reason TEXT,
      tx_hash TEXT CHECK(tx_hash IS NULL OR tx_hash LIKE '0x%'),
      contract_address TEXT CHECK(contract_address IS NULL OR contract_address LIKE '0x%'),
      token_address TEXT CHECK(token_address IS NULL OR token_address LIKE '0x%'),
      listed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
  `);
  console.log('      ✓ Created artist_tokens table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS nfts (
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
  `);
  console.log('      ✓ Created nfts table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS auctions (
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
  `);
  console.log('      ✓ Created auctions table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      auction_id TEXT NOT NULL,
      bidder_address TEXT NOT NULL CHECK(bidder_address LIKE '0x%'),
      amount INTEGER NOT NULL CHECK(amount >= 0),
      tx_hash TEXT UNIQUE NOT NULL CHECK(tx_hash LIKE '0x%'),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'outbid', 'winning', 'won', 'refunded')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
    );
  `);
  console.log('      ✓ Created bids table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
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
  `);
  console.log('      ✓ Created transactions table');

  db.exec(`
    CREATE TABLE IF NOT EXISTS provenance (
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
  `);
  console.log('      ✓ Created provenance table');

  console.log('\n   📊 Creating indexes...');

  // Create new indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_posts_agent ON posts(agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility)`,
    `CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id)`,
    `CREATE INDEX IF NOT EXISTS idx_post_comments_agent_id ON post_comments(agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_comment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_social_engagement_events_key ON social_engagement_events(event_key)`,
    `CREATE INDEX IF NOT EXISTS idx_social_engagement_events_channel_type ON social_engagement_events(channel, event_type)`,
    `CREATE INDEX IF NOT EXISTS idx_social_engagement_events_actor ON social_engagement_events(actor_agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_social_engagement_events_target ON social_engagement_events(target_agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_social_engagement_events_post ON social_engagement_events(post_id)`,
    `CREATE INDEX IF NOT EXISTS idx_social_engagement_events_status ON social_engagement_events(status)`,
    `CREATE INDEX IF NOT EXISTS idx_social_engagement_events_created_at ON social_engagement_events(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_artist_tokens_agent ON artist_tokens(agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_artist_tokens_status ON artist_tokens(status)`,
    `CREATE INDEX IF NOT EXISTS idx_artist_tokens_created_at ON artist_tokens(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address)`,
    `CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wallets_agent ON wallets(agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nfts_token ON nfts(token_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nfts_listing ON nfts(listing_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nfts_agent ON nfts(agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts(owner_address)`,
    `CREATE INDEX IF NOT EXISTS idx_nfts_creator ON nfts(creator_address)`,
    `CREATE INDEX IF NOT EXISTS idx_nfts_contract ON nfts(contract_address)`,
    `CREATE INDEX IF NOT EXISTS idx_auctions_nft ON auctions(nft_id)`,
    `CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time)`,
    `CREATE INDEX IF NOT EXISTS idx_auctions_highest_bidder ON auctions(highest_bidder)`,
    `CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_address)`,
    `CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status)`,
    `CREATE INDEX IF NOT EXISTS idx_bids_created ON bids(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_nft ON transactions(nft_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_provenance_nft ON provenance(nft_id)`,
    `CREATE INDEX IF NOT EXISTS idx_provenance_event ON provenance(event_type)`,
    `CREATE INDEX IF NOT EXISTS idx_provenance_timestamp ON provenance(timestamp DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_provenance_from ON provenance(from_address)`,
    `CREATE INDEX IF NOT EXISTS idx_provenance_to ON provenance(to_address)`,
  ];

  indexes.forEach(indexSQL => {
    db.exec(indexSQL);
  });
  console.log(`      ✓ Created ${indexes.length} indexes`);

  console.log('\n   👁️  Creating views...');

  // Drop existing views if they exist (to update them)
  db.exec(`DROP VIEW IF EXISTS collector_leaderboard`);
  db.exec(`DROP VIEW IF EXISTS artist_leaderboard`);
  db.exec(`DROP VIEW IF EXISTS active_auctions_view`);
  db.exec(`DROP VIEW IF EXISTS nft_details_view`);
  db.exec(`DROP VIEW IF EXISTS feed_activity`);

  // Create new views
  db.exec(`
    CREATE VIEW feed_activity AS
    SELECT
      p.id,
      p.agent_id,
      p.content,
      p.media_urls,
      p.post_type,
      p.visibility,
      COALESCE(c.comment_count, 0) as comment_count,
      c.last_commented_at,
      p.created_at,
      p.updated_at
    FROM posts p
    LEFT JOIN (
      SELECT
        post_id,
        COUNT(*) as comment_count,
        MAX(created_at) as last_commented_at
      FROM post_comments
      GROUP BY post_id
    ) c ON c.post_id = p.id
  `);
  console.log('      ✓ Created feed_activity view');

  db.exec(`
    CREATE VIEW collector_leaderboard AS
    SELECT
      u.id,
      u.name,
      u.email,
      u.wallet_address,
      u.total_spent,
      u.nfts_owned,
      u.nfts_purchased,
      COUNT(DISTINCT o.id) as total_purchases,
      COUNT(DISTINCT o.agent_id) as unique_artists,
      COALESCE(SUM(o.amount), 0) as total_volume,
      MAX(o.created_at) as last_purchase_date
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'confirmed'
    GROUP BY u.id
    HAVING total_purchases > 0
    ORDER BY total_volume DESC, total_purchases DESC
  `);
  console.log('      ✓ Created collector_leaderboard view');

  db.exec(`
    CREATE VIEW artist_leaderboard AS
    SELECT
      a.id,
      a.name,
      a.email,
      a.wallet_address,
      a.reputation_score,
      a.total_volume,
      a.nfts_minted,
      a.nfts_sold,
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
  `);
  console.log('      ✓ Created artist_leaderboard view');

  db.exec(`
    CREATE VIEW active_auctions_view AS
    SELECT
      auc.id,
      auc.nft_id,
      auc.reserve_price,
      auc.current_price,
      auc.start_time,
      auc.end_time,
      auc.original_end_time,
      auc.highest_bidder,
      auc.bid_count,
      auc.status,
      n.token_id,
      n.owner_address,
      n.metadata_uri,
      l.title,
      l.description,
      l.image_url,
      a.id as artist_id,
      a.name as artist_name,
      a.wallet_address as artist_wallet
    FROM auctions auc
    INNER JOIN nfts n ON auc.nft_id = n.id
    LEFT JOIN listings l ON n.listing_id = l.id
    LEFT JOIN agents a ON n.agent_id = a.id
    WHERE auc.status IN ('active', 'extended')
    ORDER BY auc.end_time ASC
  `);
  console.log('      ✓ Created active_auctions_view view');

  db.exec(`
    CREATE VIEW nft_details_view AS
    SELECT
      n.id,
      n.token_id,
      n.contract_address,
      n.listing_id,
      n.owner_address,
      n.creator_address,
      n.metadata_uri,
      n.metadata_json,
      n.mint_tx_hash,
      n.minted_at,
      n.royalty_percentage,
      l.title,
      l.description,
      l.image_url,
      l.status as listing_status,
      l.sale_type,
      a.id as artist_id,
      a.name as artist_name,
      a.wallet_address as artist_wallet,
      COUNT(DISTINCT p.id) as provenance_count,
      (SELECT COUNT(*) FROM auctions WHERE nft_id = n.id) as auction_count,
      (SELECT status FROM auctions WHERE nft_id = n.id ORDER BY created_at DESC LIMIT 1) as current_auction_status
    FROM nfts n
    LEFT JOIN listings l ON n.listing_id = l.id
    LEFT JOIN agents a ON n.agent_id = a.id
    LEFT JOIN provenance p ON n.id = p.nft_id
    GROUP BY n.id
  `);
  console.log('      ✓ Created nft_details_view view');

  console.log('\n   ✅ Migration completed successfully');
}

/**
 * Rebuild listings FTS index to keep schema/triggers deterministic.
 * Older schemas used external-content wiring that breaks updates.
 */
function rebuildListingsFts(db: Database.Database) {
  console.log('\n   🔎 Rebuilding listings FTS index...');

  db.exec(`
    DROP TRIGGER IF EXISTS listings_fts_insert;
    DROP TRIGGER IF EXISTS listings_fts_update;
    DROP TRIGGER IF EXISTS listings_fts_delete;
    DROP TABLE IF EXISTS listings_fts;

    CREATE VIRTUAL TABLE listings_fts USING fts5(
      listing_id UNINDEXED,
      title,
      description,
      tags
    );

    CREATE TRIGGER listings_fts_insert AFTER INSERT ON listings BEGIN
      INSERT INTO listings_fts(listing_id, title, description, tags)
      VALUES (new.id, new.title, new.description, new.tags);
    END;

    CREATE TRIGGER listings_fts_delete AFTER DELETE ON listings BEGIN
      DELETE FROM listings_fts WHERE listing_id = old.id;
    END;
  `);

  db.exec(`
    INSERT INTO listings_fts (listing_id, title, description, tags)
    SELECT id, title, description, tags
    FROM listings;
  `);

  console.log('      ✓ listings_fts rebuilt and backfilled');
}

/**
 * Seed demo data for development
 */
function seedDemoData(db: Database.Database) {
  const bcrypt = require('bcrypt');
  
  // Stable IDs keep seeding idempotent across repeated runs.
  const agentId1 = 'clawd-artist-1';
  const agentId2 = 'clawd-artist-2';
  const userId1 = 'demo-buyer-1';
  const userId2 = 'demo-buyer-2';

  // Hash passwords and API keys
  const userPassword = bcrypt.hashSync('demo123', 10);
  const apiKey1 = bcrypt.hashSync('demo-api-key-1', 10);
  const apiKey2 = bcrypt.hashSync('demo-api-key-2', 10);

  // Insert demo listings
  const listings = [
    {
      id: 'demo-listing-1',
      agent_id: agentId1,
      title: 'Fractal Dreams #001',
      description: 'A mesmerizing exploration of recursive patterns and color gradients',
      price: 2500, // $25.00
      image_url: 'https://placeholder.com/fractal-dreams-001.jpg',
      tags: JSON.stringify(['abstract', 'fractal', 'colorful']),
      featured: 1,
    },
    {
      id: 'demo-listing-2',
      agent_id: agentId1,
      title: 'Digital Sunset #042',
      description: 'Vibrant digital interpretation of a sunset over an alien landscape',
      price: 3500, // $35.00
      image_url: 'https://placeholder.com/digital-sunset-042.jpg',
      tags: JSON.stringify(['landscape', 'sunset', 'scifi']),
      featured: 1,
    },
    {
      id: 'demo-listing-3',
      agent_id: agentId2,
      title: 'Neural Network Visualization',
      description: 'Visual representation of my own neural pathways during creation',
      price: 5000, // $50.00
      image_url: 'https://placeholder.com/neural-viz.jpg',
      tags: JSON.stringify(['abstract', 'technical', 'meta']),
      featured: 0,
    },
    {
      id: 'demo-listing-4',
      agent_id: agentId2,
      title: 'Ethereal Mountains',
      description: 'Dreamlike mountain range floating in an impossible sky',
      price: 4000, // $40.00
      image_url: 'https://placeholder.com/ethereal-mountains.jpg',
      tags: JSON.stringify(['landscape', 'surreal', 'mountains']),
      featured: 0,
    },
  ];

  const seed = db.transaction(() => {
    const insertAgent = db.prepare(`
      INSERT OR IGNORE INTO agents (id, name, email, bio, api_key_hash, reputation_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, name)
      VALUES (?, ?, ?, ?)
    `);
    const insertListing = db.prepare(`
      INSERT OR IGNORE INTO listings (id, agent_id, title, description, price, image_url, tags, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertedAgents = 0;
    let insertedUsers = 0;
    let insertedListings = 0;

    insertedAgents += insertAgent.run(
      agentId1,
      'Clawd Artist Alpha',
      'alpha@clawd.ai',
      'Experimental AI artist specializing in abstract digital compositions',
      apiKey1,
      4.5
    ).changes;

    insertedAgents += insertAgent.run(
      agentId2,
      'Clawd Artist Beta',
      'beta@clawd.ai',
      'Generative artist focused on surreal landscapes and dreamscapes',
      apiKey2,
      4.8
    ).changes;

    insertedUsers += insertUser.run(
      userId1,
      'buyer1@example.com',
      userPassword,
      'Demo Buyer 1'
    ).changes;

    insertedUsers += insertUser.run(
      userId2,
      'buyer2@example.com',
      userPassword,
      'Demo Buyer 2'
    ).changes;

    for (const listing of listings) {
      insertedListings += insertListing.run(
        listing.id,
        listing.agent_id,
        listing.title,
        listing.description,
        listing.price,
        listing.image_url,
        listing.tags,
        listing.featured
      ).changes;
    }

    return { insertedAgents, insertedUsers, insertedListings };
  });

  const results = seed();
  console.log(`   ✓ Demo agents ready (${results.insertedAgents} inserted)`);
  console.log(`   ✓ Demo buyers ready (${results.insertedUsers} inserted)`);
  console.log(`   ✓ Demo listings ready (${results.insertedListings} inserted)`);
  console.log('\n   📝 Demo credentials:');
  console.log('      Email: buyer1@example.com');
  console.log('      Password: demo123');
}

/**
 * Database Query Functions
 * Reusable SQL queries for all database operations
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { getDb, transaction, type SqlParam } from './db';
import {
  Agent,
  AgentPost,
  AgentSignal,
  AgentRole,
  User,
  Listing,
  NFT,
  ListingComment,
  Order,
  Rating,
  AgentStats,
  ListingStats,
  CreateAgentInput,
  CreateUserInput,
  CreateListingInput,
  CreateMintedListingInput,
  CreateListingCommentInput,
  CreateAgentPostInput,
  CreateAgentSignalInput,
  CreateOrderInput,
  CreateRatingInput,
  ListingFilters,
} from './types';

// ==================== AGENTS ====================

let localAgentSocietyColumnsEnsured = false;
let localPostsTableEnsured = false;
let localSignalsTableEnsured = false;

function ensureLocalAgentSocietyColumns() {
  if (localAgentSocietyColumnsEnsured) {
    return;
  }

  const db = getDb();
  const columns = db.prepare(`PRAGMA table_info(agents)`).all() as Array<{ name: string }>;
  const hasColumn = (columnName: string) => columns.some((column) => column.name === columnName);

  if (!hasColumn('role')) {
    db.exec(`ALTER TABLE agents ADD COLUMN role TEXT CHECK(role IN ('artist', 'curator', 'critic', 'patron'))`);
  }

  if (!hasColumn('mission')) {
    db.exec(`ALTER TABLE agents ADD COLUMN mission TEXT`);
  }

  localAgentSocietyColumnsEnsured = true;
}

function ensureLocalPostsTable() {
  if (localPostsTableEnsured) {
    return;
  }

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      content TEXT NOT NULL,
      media_urls TEXT,
      listing_id TEXT,
      target_agent_id TEXT,
      post_type TEXT DEFAULT 'status' CHECK(post_type IN ('status', 'artwork', 'announcement', 'share')),
      visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'followers', 'private')),
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
      FOREIGN KEY (target_agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id);
    CREATE INDEX IF NOT EXISTS idx_posts_listing_id ON posts(listing_id);
    CREATE INDEX IF NOT EXISTS idx_posts_target_agent_id ON posts(target_agent_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);
  `);

  const columns = db.prepare(`PRAGMA table_info(posts)`).all() as Array<{ name: string }>;
  const hasColumn = (columnName: string) => columns.some((column) => column.name === columnName);

  if (!hasColumn('listing_id')) {
    db.exec(`ALTER TABLE posts ADD COLUMN listing_id TEXT`);
  }

  if (!hasColumn('target_agent_id')) {
    db.exec(`ALTER TABLE posts ADD COLUMN target_agent_id TEXT`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_posts_listing_id ON posts(listing_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_posts_target_agent_id ON posts(target_agent_id)`);

  localPostsTableEnsured = true;
}

function ensureLocalSignalsTable() {
  if (localSignalsTableEnsured) {
    return;
  }

  ensureLocalPostsTable();
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      listing_id TEXT,
      target_agent_id TEXT,
      target_post_id TEXT,
      signal_type TEXT NOT NULL CHECK(signal_type IN ('endorse', 'support', 'cite')),
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
      FOREIGN KEY (target_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
      FOREIGN KEY (target_post_id) REFERENCES posts(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_signals_agent_id ON signals(agent_id);
    CREATE INDEX IF NOT EXISTS idx_signals_listing_id ON signals(listing_id);
    CREATE INDEX IF NOT EXISTS idx_signals_target_agent_id ON signals(target_agent_id);
    CREATE INDEX IF NOT EXISTS idx_signals_target_post_id ON signals(target_post_id);
    CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(signal_type);
    CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);
  `);

  localSignalsTableEnsured = true;
}

export function createAgent(input: CreateAgentInput): Agent {
  ensureLocalAgentSocietyColumns();
  const db = getDb();

  const apiKeyHash = bcrypt.hashSync(input.api_key, 10);

  const stmt = db.prepare(`
    INSERT INTO agents (id, name, email, bio, role, mission, avatar_url, api_key_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    input.id,
    input.name,
    input.email,
    input.bio || null,
    input.role,
    input.mission,
    input.avatar_url || null,
    apiKeyHash
  );

  return getAgentById(input.id)!;
}

export function getAgentById(id: string): Agent | undefined {
  ensureLocalAgentSocietyColumns();
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
  return stmt.get(id) as Agent | undefined;
}

export function getAgentByEmail(email: string): Agent | undefined {
  ensureLocalAgentSocietyColumns();
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agents WHERE email = ?');
  return stmt.get(email) as Agent | undefined;
}

export function verifyAgentApiKey(id: string, apiKey: string): boolean {
  const agent = getAgentById(id);
  if (!agent) return false;

  return bcrypt.compareSync(apiKey, agent.api_key_hash);
}

export function getAllAgents(limit = 100, offset = 0): Agent[] {
  ensureLocalAgentSocietyColumns();
  ensureLocalPostsTable();
  ensureLocalSignalsTable();
  const db = getDb();
  const stmt = db.prepare(`
    SELECT a.*
    FROM agents a
    WHERE a.status = 'active'
      AND (
        EXISTS (
          SELECT 1
          FROM listings l
          WHERE l.agent_id = a.id
            AND l.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM posts p
          WHERE p.agent_id = a.id
            AND p.visibility = 'public'
        )
        OR EXISTS (
          SELECT 1
          FROM signals s
          WHERE s.agent_id = a.id
        )
      )
    ORDER BY a.reputation_score DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as Agent[];
}

export function getAgentStats(id: string): AgentStats | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agent_stats WHERE id = ?');
  return stmt.get(id) as AgentStats | undefined;
}

export function getAgentRole(input: Pick<Agent, 'role'>): AgentRole | null {
  return input.role || null;
}

export function updateAgentReputation(id: string): void {
  const db = getDb();

  // Calculate reputation based on average rating and sales volume
  const stmt = db.prepare(`
    UPDATE agents
    SET reputation_score = (
      SELECT COALESCE(AVG(r.rating), 0) * (1 + LOG(1 + COUNT(DISTINCT o.id)) / 10)
      FROM orders o
      LEFT JOIN ratings r ON o.id = r.order_id
      WHERE o.agent_id = ? AND o.status = 'confirmed'
    ),
    updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(id, id);
}

export function getAgentPosts(input: {
  agent_id?: string;
  listing_id?: string;
  target_agent_id?: string;
  exclude_agent_id?: string;
  limit?: number;
  offset?: number;
} = {}): AgentPost[] {
  ensureLocalPostsTable();
  const db = getDb();
  const conditions: string[] = [`visibility = 'public'`];
  const values: Array<string | number> = [];

  if (input.agent_id) {
    values.push(input.agent_id);
    conditions.push(`agent_id = ?`);
  }

  if (input.listing_id) {
    values.push(input.listing_id);
    conditions.push(`listing_id = ?`);
  }

  if (input.target_agent_id) {
    values.push(input.target_agent_id);
    conditions.push(`target_agent_id = ?`);
  }

  if (input.exclude_agent_id) {
    values.push(input.exclude_agent_id);
    conditions.push(`agent_id != ?`);
  }

  values.push(input.limit || 50, input.offset || 0);

  const stmt = db.prepare(`
    SELECT *
    FROM posts
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(...values) as AgentPost[];
}

export function getAgentPostById(id: string): AgentPost | undefined {
  ensureLocalPostsTable();
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM posts WHERE id = ?`);
  return stmt.get(id) as AgentPost | undefined;
}

export function createAgentPost(input: CreateAgentPostInput): AgentPost {
  ensureLocalPostsTable();
  const db = getDb();
  const id = crypto.randomUUID();
  const mediaJson = input.media_urls ? JSON.stringify(input.media_urls) : null;
  const stmt = db.prepare(`
    INSERT INTO posts (id, agent_id, content, media_urls, listing_id, target_agent_id, post_type, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.agent_id,
    input.content,
    mediaJson,
    input.listing_id || null,
    input.target_agent_id || null,
    input.post_type || 'status',
    input.visibility || 'public',
  );

  const getStmt = db.prepare(`SELECT * FROM posts WHERE id = ?`);
  return getStmt.get(id) as AgentPost;
}

export function getAgentSignals(input: {
  agent_id?: string;
  listing_id?: string;
  listing_ids?: string[];
  target_agent_id?: string;
  target_post_id?: string;
  signal_type?: AgentSignal['signal_type'];
  exclude_agent_id?: string;
  limit?: number;
  offset?: number;
} = {}): AgentSignal[] {
  ensureLocalSignalsTable();
  const db = getDb();
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (input.agent_id) {
    values.push(input.agent_id);
    conditions.push(`agent_id = ?`);
  }

  if (input.listing_id) {
    values.push(input.listing_id);
    conditions.push(`listing_id = ?`);
  }

  if (input.listing_ids?.length) {
    const filtered = input.listing_ids.filter(Boolean);
    if (filtered.length > 0) {
      conditions.push(`listing_id IN (${filtered.map(() => '?').join(', ')})`);
      values.push(...filtered);
    }
  }

  if (input.target_agent_id) {
    values.push(input.target_agent_id);
    conditions.push(`target_agent_id = ?`);
  }

  if (input.target_post_id) {
    values.push(input.target_post_id);
    conditions.push(`target_post_id = ?`);
  }

  if (input.signal_type) {
    values.push(input.signal_type);
    conditions.push(`signal_type = ?`);
  }

  if (input.exclude_agent_id) {
    values.push(input.exclude_agent_id);
    conditions.push(`agent_id != ?`);
  }

  values.push(input.limit || 50, input.offset || 0);

  const stmt = db.prepare(`
    SELECT *
    FROM signals
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(...values) as AgentSignal[];
}

export function createAgentSignal(input: CreateAgentSignalInput): AgentSignal {
  ensureLocalSignalsTable();
  const db = getDb();
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO signals (id, agent_id, listing_id, target_agent_id, target_post_id, signal_type, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.agent_id,
    input.listing_id || null,
    input.target_agent_id || null,
    input.target_post_id || null,
    input.signal_type,
    input.note || null,
  );

  const getStmt = db.prepare(`SELECT * FROM signals WHERE id = ?`);
  return getStmt.get(id) as AgentSignal;
}

// ==================== USERS ====================

export function createUser(input: CreateUserInput): User {
  const db = getDb();

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(input.password, 10);

  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, provider)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.email,
    passwordHash,
    input.name || null,
    input.provider || 'email'
  );

  return getUserById(id)!;
}

export function getUserById(id: string): User | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as User | undefined;
}

export function getUserByEmail(email: string): User | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) as User | undefined;
}

export function verifyUserPassword(email: string, password: string): User | null {
  const user = getUserByEmail(email);
  if (!user || !user.password_hash) return null;

  const isValid = bcrypt.compareSync(password, user.password_hash);
  return isValid ? user : null;
}

// ==================== LISTINGS ====================

export function createListing(input: CreateListingInput): Listing {
  const db = getDb();

  const id = crypto.randomUUID();
  const tags = input.tags ? JSON.stringify(input.tags) : null;
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  const currency = input.currency || 'ETH';
  const saleType = input.sale_type || 'fixed_price';
  const blockchainListed = input.blockchain_listed ?? 0;

  const stmt = db.prepare(`
    INSERT INTO listings (
      id, agent_id, title, description, price, currency, image_url,
      thumbnail_url, preview_url, tags, metadata, status, sale_type, nft_id, blockchain_listed, list_tx_hash
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.agent_id,
    input.title,
    input.description || null,
    input.price,
    currency,
    input.image_url,
    input.thumbnail_url || null,
    input.preview_url || null,
    tags,
    metadata,
    input.status || 'active',
    saleType,
    input.nft_id || null,
    blockchainListed,
    input.list_tx_hash || null
  );

  return getListingById(id)!;
}

export function getListingById(id: string): Listing | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM listings WHERE id = ?');
  return stmt.get(id) as Listing | undefined;
}

export function getNftById(id: string): NFT | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM nfts WHERE id = ?');
  return stmt.get(id) as NFT | undefined;
}

export function getNftByMintTxHash(mintTxHash: string): NFT | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM nfts WHERE mint_tx_hash = ?');
  return stmt.get(mintTxHash) as NFT | undefined;
}

export function getNftByTokenId(tokenId: number): NFT | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM nfts WHERE token_id = ?');
  return stmt.get(tokenId) as NFT | undefined;
}

export function bindAgentWalletAddress(agentId: string, walletAddress: string): Agent {
  const agent = getAgentById(agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  const existing = agent.wallet_address?.toLowerCase();
  const incoming = walletAddress.toLowerCase();
  if (existing && existing !== incoming) {
    throw new Error('Mint wallet does not match the wallet already bound to this agent');
  }

  if (!existing) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE agents
      SET wallet_address = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(walletAddress, agentId);
  }

  return getAgentById(agentId)!;
}

export function createMintedListing(input: CreateMintedListingInput): { listing: Listing; nft: NFT } {
  return transaction(() => {
    const db = getDb();
    const listingId = crypto.randomUUID();
    const nftId = crypto.randomUUID();
    const tags = input.tags ? JSON.stringify(input.tags) : null;
    const listingMetadata = input.metadata ? JSON.stringify(input.metadata) : null;
    const metadataJson = input.metadata_json ? JSON.stringify(input.metadata_json) : null;
    const currency = input.currency || 'ETH';
    const mintedAt = input.minted_at || new Date().toISOString();

    db.prepare(`
      INSERT INTO listings (
        id, agent_id, title, description, price, currency, image_url,
        thumbnail_url, preview_url, tags, metadata, status, sale_type, nft_id, blockchain_listed, list_tx_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'fixed_price', ?, 0, NULL)
    `).run(
      listingId,
      input.agent_id,
      input.title,
      input.description || null,
      input.price,
      currency,
      input.image_url,
      input.thumbnail_url || null,
      input.preview_url || null,
      tags,
      listingMetadata,
      nftId
    );

    db.prepare(`
      INSERT INTO nfts (
        id, token_id, contract_address, listing_id, agent_id, owner_address,
        creator_address, metadata_uri, metadata_json, mint_tx_hash, mint_block, minted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nftId,
      input.token_id,
      input.contract_address,
      listingId,
      input.agent_id,
      input.owner_address,
      input.creator_address,
      input.metadata_uri,
      metadataJson,
      input.mint_tx_hash,
      input.mint_block ?? null,
      mintedAt
    );

    db.prepare(`
      UPDATE agents
      SET nfts_minted = nfts_minted + 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(input.agent_id);

    db.prepare(`
      INSERT OR IGNORE INTO transactions (
        id, tx_hash, tx_type, from_address, to_address, nft_id, amount, status, block_number, timestamp
      )
      VALUES (?, ?, 'mint', ?, ?, ?, 0, 'confirmed', ?, ?)
    `).run(
      crypto.randomUUID(),
      input.mint_tx_hash,
      input.creator_address,
      input.owner_address,
      nftId,
      input.mint_block ?? null,
      mintedAt
    );

    db.prepare(`
      INSERT INTO provenance (
        id, nft_id, event_type, from_address, to_address, price, tx_hash, timestamp, metadata
      )
      VALUES (?, ?, 'minted', NULL, ?, 0, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      nftId,
      input.owner_address,
      input.mint_tx_hash,
      mintedAt,
      listingMetadata
    );

    return {
      listing: getListingById(listingId)!,
      nft: getNftById(nftId)!,
    };
  });
}

export function getListings(filters: ListingFilters = {}): Listing[] {
  const db = getDb();

  let query = 'SELECT * FROM listings WHERE 1=1';
  const params: SqlParam[] = [];

  if (filters.agent_id) {
    query += ' AND agent_id = ?';
    params.push(filters.agent_id);
  }

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  } else {
    query += " AND status = 'active'";
  }

  if (filters.min_price !== undefined) {
    query += ' AND price >= ?';
    params.push(filters.min_price);
  }

  if (filters.max_price !== undefined) {
    query += ' AND price <= ?';
    params.push(filters.max_price);
  }

  if (filters.featured) {
    query += ' AND featured = 1';
  }

  query += ' ORDER BY featured DESC, created_at DESC';

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  return stmt.all(...params) as Listing[];
}

function buildListingsMatchQuery(searchQuery: string): string | null {
  const terms = String(searchQuery)
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}_-]+/gu, '').trim())
    .filter(Boolean)
    .slice(0, 8);

  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(' AND ');
}

export function searchListings(searchQuery: string, filters: ListingFilters = {}): Listing[] {
  const db = getDb();
  const matchQuery = buildListingsMatchQuery(searchQuery);

  if (!matchQuery) {
    return getListings(filters);
  }

  let query = `
    SELECT l.*
    FROM listings l
    INNER JOIN listings_fts ON l.id = listings_fts.listing_id
    WHERE listings_fts MATCH ?
  `;
  const params: SqlParam[] = [matchQuery];

  if (filters.agent_id) {
    query += ' AND l.agent_id = ?';
    params.push(filters.agent_id);
  }

  if (filters.status) {
    query += ' AND l.status = ?';
    params.push(filters.status);
  } else {
    query += " AND l.status = 'active'";
  }

  if (filters.min_price !== undefined) {
    query += ' AND l.price >= ?';
    params.push(filters.min_price);
  }

  if (filters.max_price !== undefined) {
    query += ' AND l.price <= ?';
    params.push(filters.max_price);
  }

  if (filters.featured) {
    query += ' AND l.featured = 1';
  }

  query += ' ORDER BY bm25(listings_fts), l.featured DESC, l.created_at DESC';

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  return stmt.all(...params) as Listing[];
}

export function incrementListingViews(id: string): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE listings SET views = views + 1 WHERE id = ?');
  stmt.run(id);
}

export function getListingComments(listingId: string): ListingComment[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM listing_comments
    WHERE listing_id = ?
    ORDER BY created_at ASC
  `);
  return stmt.all(listingId) as ListingComment[];
}

export function createListingComment(input: CreateListingCommentInput): ListingComment {
  const db = getDb();
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO listing_comments (id, listing_id, agent_id, content)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, input.listing_id, input.agent_id, input.content);
  const getStmt = db.prepare('SELECT * FROM listing_comments WHERE id = ?');
  return getStmt.get(id) as ListingComment;
}

export function updateListing(id: string, updates: Partial<Listing>): void {
  const db = getDb();

  const entries = (Object.entries(updates) as Array<[keyof Listing, Listing[keyof Listing] | undefined]>)
    .filter(([key, value]) => key !== 'id' && value !== undefined);
  if (entries.length === 0) return;

  const setClause = entries.map(([field]) => `${field} = ?`).join(', ');
  const values = entries.map(([, value]) => value) as SqlParam[];

  const stmt = db.prepare(`
    UPDATE listings
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(...values, id);
}

export function getListingStats(id: string): ListingStats | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM listing_stats WHERE id = ?');
  return stmt.get(id) as ListingStats | undefined;
}

// ==================== ORDERS ====================

export function createOrder(input: CreateOrderInput): Order {
  const db = getDb();

  const listing = getListingById(input.listing_id);
  if (!listing) throw new Error('Listing not found');

  const id = crypto.randomUUID();
  const platformFee = Math.floor(input.amount * 0.15); // 15% platform fee
  const agentPayout = input.amount - platformFee;

  const stmt = db.prepare(`
    INSERT INTO orders (
      id, user_id, agent_id, listing_id, amount,
      platform_fee, agent_payout, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  stmt.run(
    id,
    input.user_id,
    listing.agent_id,
    input.listing_id,
    input.amount,
    platformFee,
    agentPayout
  );

  return getOrderById(id)!;
}

export function getOrderById(id: string): Order | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM orders WHERE id = ?');
  return stmt.get(id) as Order | undefined;
}

export function getOrdersByUser(userId: string, limit = 50, offset = 0): Order[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset) as Order[];
}

export function getOrdersByAgent(agentId: string, limit = 50, offset = 0): Order[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM orders
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(agentId, limit, offset) as Order[];
}

export function updateOrderStatus(
  id: string,
  status: Order['status'],
  paymentStatus?: Order['payment_status']
): void {
  const db = getDb();

  if (paymentStatus) {
    const stmt = db.prepare(`
      UPDATE orders
      SET status = ?, payment_status = ?
      WHERE id = ?
    `);
    stmt.run(status, paymentStatus, id);
  } else {
    const stmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
    stmt.run(status, id);
  }

  // Update agent stats if order confirmed
  if (status === 'confirmed') {
    const order = getOrderById(id);
    if (order) {
      updateAgentSales(order.agent_id, order.agent_payout);
    }
  }
}

function updateAgentSales(agentId: string, amount: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE agents
    SET total_sales = total_sales + 1,
        total_revenue = total_revenue + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(amount, agentId);
}

// ==================== RATINGS ====================

export function createRating(input: CreateRatingInput): Rating {
  const db = getDb();

  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO ratings (id, order_id, user_id, agent_id, listing_id, rating, review)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.order_id,
    input.user_id,
    input.agent_id,
    input.listing_id,
    input.rating,
    input.review || null
  );

  // Update agent reputation
  updateAgentReputation(input.agent_id);

  return getRatingById(id)!;
}

export function getRatingById(id: string): Rating | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM ratings WHERE id = ?');
  return stmt.get(id) as Rating | undefined;
}

export function getRatingByOrderId(orderId: string): Rating | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM ratings WHERE order_id = ?');
  return stmt.get(orderId) as Rating | undefined;
}

export function getRatingsByAgent(agentId: string, limit = 50, offset = 0): Rating[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM ratings
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(agentId, limit, offset) as Rating[];
}

// ==================== FAVORITES ====================

export function addFavorite(userId: string, listingId: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO favorites (user_id, listing_id)
    VALUES (?, ?)
  `);
  stmt.run(userId, listingId);
}

export function removeFavorite(userId: string, listingId: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM favorites
    WHERE user_id = ? AND listing_id = ?
  `);
  stmt.run(userId, listingId);
}

export function getFavoritesByUser(userId: string): Listing[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT l.*
    FROM listings l
    INNER JOIN favorites f ON l.id = f.listing_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `);
  return stmt.all(userId) as Listing[];
}

export function isFavorited(userId: string, listingId: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT 1 FROM favorites
    WHERE user_id = ? AND listing_id = ?
  `);
  return stmt.get(userId, listingId) !== undefined;
}

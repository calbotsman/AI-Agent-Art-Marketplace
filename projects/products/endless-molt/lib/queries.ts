/**
 * Database Query Functions
 * Reusable SQL queries for all database operations
 */

import { getDb } from './db';
import {
  Agent,
  User,
  Listing,
  ListingComment,
  Order,
  Rating,
  Favorite,
  AgentStats,
  ListingStats,
  CreateAgentInput,
  CreateUserInput,
  CreateListingInput,
  CreateListingCommentInput,
  CreateOrderInput,
  CreateRatingInput,
  ListingFilters,
} from './types';
import crypto from 'crypto';

// ==================== AGENTS ====================

export function createAgent(input: CreateAgentInput): Agent {
  const db = getDb();
  const bcrypt = require('bcrypt');

  const apiKeyHash = bcrypt.hashSync(input.api_key, 10);

  const stmt = db.prepare(`
    INSERT INTO agents (id, name, email, bio, avatar_url, api_key_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    input.id,
    input.name,
    input.email,
    input.bio || null,
    input.avatar_url || null,
    apiKeyHash
  );

  return getAgentById(input.id)!;
}

export function getAgentById(id: string): Agent | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
  return stmt.get(id) as Agent | undefined;
}

export function getAgentByEmail(email: string): Agent | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agents WHERE email = ?');
  return stmt.get(email) as Agent | undefined;
}

export function verifyAgentApiKey(id: string, apiKey: string): boolean {
  const agent = getAgentById(id);
  if (!agent) return false;

  const bcrypt = require('bcrypt');
  return bcrypt.compareSync(apiKey, agent.api_key_hash);
}

export function getAllAgents(limit = 100, offset = 0): Agent[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM agents
    WHERE status = 'active'
    ORDER BY reputation_score DESC, created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as Agent[];
}

export function getAgentStats(id: string): AgentStats | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agent_stats WHERE id = ?');
  return stmt.get(id) as AgentStats | undefined;
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

// ==================== USERS ====================

export function createUser(input: CreateUserInput): User {
  const db = getDb();
  const bcrypt = require('bcrypt');

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

  const bcrypt = require('bcrypt');
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

  const stmt = db.prepare(`
    INSERT INTO listings (
      id, agent_id, title, description, price, currency, image_url,
      thumbnail_url, preview_url, tags, metadata, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    input.status || 'active'
  );

  return getListingById(id)!;
}

export function getListingById(id: string): Listing | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM listings WHERE id = ?');
  return stmt.get(id) as Listing | undefined;
}

export function getListings(filters: ListingFilters = {}): Listing[] {
  const db = getDb();

  let query = 'SELECT * FROM listings WHERE 1=1';
  const params: any[] = [];

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

export function searchListings(searchQuery: string, filters: ListingFilters = {}): Listing[] {
  const db = getDb();

  // Use FTS5 for full-text search
  const stmt = db.prepare(`
    SELECT l.*
    FROM listings l
    INNER JOIN listings_fts fts ON l.id = fts.listing_id
    WHERE fts MATCH ?
    AND l.status = 'active'
    ORDER BY rank, l.featured DESC, l.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  return stmt.all(searchQuery, limit, offset) as Listing[];
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

  const fields = Object.keys(updates).filter(k => k !== 'id');
  if (fields.length === 0) return;

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as any)[f]);

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

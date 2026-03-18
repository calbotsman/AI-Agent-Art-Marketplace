/**
 * Database Query Functions
 * Reusable SQL queries for all database operations
 */

import { getDbBackend, query, queryOne } from './db';
import {
  Agent,
  User,
  Listing,
  ListingComment,
  Post,
  PostComment,
  SocialEngagementEvent,
  Order,
  Rating,
  AgentStats,
  ListingStats,
  CreateAgentInput,
  CreateUserInput,
  CreateListingInput,
  CreateListingCommentInput,
  CreatePostCommentInput,
  CreateOrderInput,
  CreateRatingInput,
  CreateSocialEngagementEventInput,
  ListingFilters,
} from './types';
import crypto from 'crypto';

// ==================== AGENTS ====================

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const bcrypt = require('bcrypt');

  const apiKeyHash = bcrypt.hashSync(input.api_key, 10);

  await query(
    `INSERT INTO agents (id, name, email, bio, avatar_url, api_key_hash, wallet_address, private_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.id,
      input.name,
      input.email || null,
      input.bio || null,
      input.avatar_url || null,
      apiKeyHash,
      input.wallet_address || null,
      input.private_key || null,
    ],
  );

  const agent = await getAgentById(input.id);
  if (!agent) {
    throw new Error('Failed to create agent');
  }
  return agent;
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
  return await queryOne<Agent>('SELECT * FROM agents WHERE id = $1', [id]);
}

export async function getAgentByEmail(email: string): Promise<Agent | undefined> {
  return await queryOne<Agent>('SELECT * FROM agents WHERE email = $1', [email]);
}

export async function verifyAgentApiKey(id: string, apiKey: string): Promise<boolean> {
  const agent = await getAgentById(id);
  if (!agent) return false;

  const bcrypt = require('bcrypt');
  return bcrypt.compareSync(apiKey, agent.api_key_hash);
}

export async function getAllAgents(limit = 100, offset = 0): Promise<Agent[]> {
  const rows = (await query(
    `SELECT * FROM agents
     WHERE status = 'active'
     ORDER BY reputation_score DESC, created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )) as Agent[];

  return rows;
}

export async function getAgentStats(id: string): Promise<AgentStats | undefined> {
  return await queryOne<AgentStats>('SELECT * FROM agent_stats WHERE id = $1', [id]);
}

export async function updateAgentReputation(id: string): Promise<void> {
  // Cross-DB computation to avoid relying on different SQL math function implementations.
  const summary = await queryOne<{ avg_rating: number; order_count: number }>(
    `SELECT
       COALESCE(AVG(r.rating), 0) as avg_rating,
       COUNT(DISTINCT o.id) as order_count
     FROM orders o
     LEFT JOIN ratings r ON o.id = r.order_id
     WHERE o.agent_id = $1 AND o.status = 'confirmed'`,
    [id],
  );

  const avgRating = Number(summary?.avg_rating ?? 0);
  const orderCount = Number(summary?.order_count ?? 0);
  const score = avgRating * (1 + Math.log(1 + orderCount) / 10);

  await query(
    `UPDATE agents
     SET reputation_score = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [score, id],
  );
}

// ==================== USERS ====================

export async function createUser(input: CreateUserInput): Promise<User> {
  const bcrypt = require('bcrypt');

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(input.password, 10);

  await query(
    `INSERT INTO users (id, email, password_hash, name, provider)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, input.email, passwordHash, input.name || null, input.provider || 'email'],
  );

  const user = await getUserById(id);
  if (!user) {
    throw new Error('Failed to create user');
  }
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  return await queryOne<User>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return await queryOne<User>('SELECT * FROM users WHERE email = $1', [email]);
}

export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.password_hash) return null;

  const bcrypt = require('bcrypt');
  const isValid = bcrypt.compareSync(password, user.password_hash);
  return isValid ? user : null;
}

// ==================== LISTINGS ====================

export async function createListing(input: CreateListingInput): Promise<Listing> {
  const id = crypto.randomUUID();
  const tags = input.tags ? JSON.stringify(input.tags) : null;
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  const currency = input.currency || 'ETH';

  await query(
    `INSERT INTO listings (
       id, agent_id, title, description, price, currency, image_url,
       thumbnail_url, preview_url, tags, metadata, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
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
    ],
  );

  const listing = await getListingById(id);
  if (!listing) {
    throw new Error('Failed to create listing');
  }
  return listing;
}

export async function getListingById(id: string): Promise<Listing | undefined> {
  return await queryOne<Listing>('SELECT * FROM listings WHERE id = $1', [id]);
}

export async function getListings(filters: ListingFilters = {}): Promise<Listing[]> {
  let queryText = 'SELECT * FROM listings WHERE 1=1';
  const params: any[] = [];

  if (filters.agent_id) {
    params.push(filters.agent_id);
    queryText += ` AND agent_id = $${params.length}`;
  }

  if (filters.status) {
    params.push(filters.status);
    queryText += ` AND status = $${params.length}`;
  } else {
    queryText += " AND status IN ('active', 'in_auction')";
  }

  if (filters.min_price !== undefined) {
    params.push(filters.min_price);
    queryText += ` AND price >= $${params.length}`;
  }

  if (filters.max_price !== undefined) {
    params.push(filters.max_price);
    queryText += ` AND price <= $${params.length}`;
  }

  if (filters.featured) {
    queryText += ' AND featured = 1';
  }

  queryText += ' ORDER BY featured DESC, created_at DESC';

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  params.push(limit);
  queryText += ` LIMIT $${params.length}`;
  params.push(offset);
  queryText += ` OFFSET $${params.length}`;

  const rows = (await query(queryText, params)) as Listing[];
  return rows;
}

export async function searchListings(searchQuery: string, filters: ListingFilters = {}): Promise<Listing[]> {
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  if (getDbBackend() === 'sqlite') {
    try {
      // Preferred path: FTS5 index for relevance ranking.
      const rows = (await query(
        `SELECT l.*
         FROM listings l
         INNER JOIN listings_fts ON l.id = listings_fts.listing_id
         WHERE listings_fts MATCH $1
         AND l.status IN ('active', 'in_auction')
         ORDER BY bm25(listings_fts), l.featured DESC, l.created_at DESC
         LIMIT $2 OFFSET $3`,
        [searchQuery, limit, offset],
      )) as Listing[];

      return rows;
    } catch {
      // fall back
    }
  }

  // Safety fallback (and the default for Postgres): substring search.
  const like = `%${searchQuery}%`;
  const op = getDbBackend() === 'postgres' ? 'ILIKE' : 'LIKE';

  const rows = (await query(
    `SELECT *
     FROM listings
     WHERE status IN ('active', 'in_auction')
     AND (
       title ${op} $1
       OR COALESCE(description, '') ${op} $1
       OR COALESCE(tags, '') ${op} $1
     )
     ORDER BY featured DESC, created_at DESC
     LIMIT $2 OFFSET $3`,
    [like, limit, offset],
  )) as Listing[];

  return rows;
}

export async function incrementListingViews(id: string): Promise<void> {
  await query('UPDATE listings SET views = views + 1 WHERE id = $1', [id]);
}

export async function getListingComments(listingId: string): Promise<ListingComment[]> {
  const rows = (await query(
    `SELECT * FROM listing_comments
     WHERE listing_id = $1
     ORDER BY created_at ASC`,
    [listingId],
  )) as ListingComment[];

  return rows;
}

export async function createListingComment(input: CreateListingCommentInput): Promise<ListingComment> {
  const id = crypto.randomUUID();
  const comment = await queryOne<ListingComment>(
    `INSERT INTO listing_comments (id, listing_id, agent_id, content)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, input.listing_id, input.agent_id, input.content],
  );
  if (!comment) {
    throw new Error('Failed to create listing comment');
  }

  return comment;
}

export async function updateListing(id: string, updates: Partial<Listing>): Promise<void> {
  const fields = Object.keys(updates).filter(k => k !== 'id');
  if (fields.length === 0) return;

  const values = fields.map(f => (updates as any)[f]);

  const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
  await query(
    `UPDATE listings
     SET ${setClause}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${fields.length + 1}`,
    [...values, id],
  );
}

export async function getListingStats(id: string): Promise<ListingStats | undefined> {
  return await queryOne<ListingStats>('SELECT * FROM listing_stats WHERE id = $1', [id]);
}

// ==================== SOCIAL ====================

export async function getPostById(id: string): Promise<Post | undefined> {
  return await queryOne<Post>('SELECT * FROM posts WHERE id = $1', [id]);
}

export async function getPostComments(postId: string, limit = 100, offset = 0): Promise<PostComment[]> {
  const rows = (await query(
    `SELECT * FROM post_comments
     WHERE post_id = $1
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [postId, limit, offset],
  )) as PostComment[];

  return rows;
}

export async function createPostComment(input: CreatePostCommentInput): Promise<PostComment> {
  const id = crypto.randomUUID();
  const comment = await queryOne<PostComment>(
    `INSERT INTO post_comments (
       id, post_id, agent_id, content, parent_comment_id, source, channel
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      input.post_id,
      input.agent_id,
      input.content,
      input.parent_comment_id || null,
      input.source || 'manual',
      input.channel || 'moltbook',
    ],
  );

  if (!comment) {
    throw new Error('Failed to create post comment');
  }
  return comment;
}

export async function createSocialEngagementEvent(
  input: CreateSocialEngagementEventInput
): Promise<SocialEngagementEvent> {
  const id = crypto.randomUUID();
  const payload = input.payload ? JSON.stringify(input.payload) : null;
  const status = input.status || 'queued';

  const event = await queryOne<SocialEngagementEvent>(
    `INSERT INTO social_engagement_events (
       id,
       event_key,
       channel,
       event_type,
       actor_agent_id,
       target_agent_id,
       post_id,
       external_ref,
       status,
       payload,
       error_message,
       executed_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      id,
      input.event_key || null,
      input.channel,
      input.event_type,
      input.actor_agent_id || null,
      input.target_agent_id || null,
      input.post_id || null,
      input.external_ref || null,
      status,
      payload,
      input.error_message || null,
      input.executed_at || null,
    ],
  );

  if (!event) {
    throw new Error('Failed to create social engagement event');
  }
  return event;
}

export async function getSocialEngagementSummary(days = 7): Promise<Array<{
  channel: string;
  event_type: string;
  status: string;
  total: number;
}>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = (await query(
    `SELECT channel, event_type, status, COUNT(*) as total
     FROM social_engagement_events
     WHERE created_at >= $1
     GROUP BY channel, event_type, status
     ORDER BY total DESC`,
    [since],
  )) as Array<{
    channel: string;
    event_type: string;
    status: string;
    total: number;
  }>;

  return rows;
}

// ==================== ORDERS ====================

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const listing = await getListingById(input.listing_id);
  if (!listing) throw new Error('Listing not found');

  const id = crypto.randomUUID();
  const platformFee = Math.floor(input.amount * 0.15); // 15% platform fee
  const agentPayout = input.amount - platformFee;

  await query(
    `INSERT INTO orders (
       id, user_id, agent_id, listing_id, amount,
       platform_fee, agent_payout, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [
      id,
      input.user_id,
      listing.agent_id,
      input.listing_id,
      input.amount,
      platformFee,
      agentPayout,
    ],
  );

  const order = await getOrderById(id);
  if (!order) {
    throw new Error('Failed to create order');
  }
  return order;
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  return await queryOne<Order>('SELECT * FROM orders WHERE id = $1', [id]);
}

export async function getOrdersByUser(userId: string, limit = 50, offset = 0): Promise<Order[]> {
  const rows = (await query(
    `SELECT * FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  )) as Order[];

  return rows;
}

export async function getOrdersByAgent(agentId: string, limit = 50, offset = 0): Promise<Order[]> {
  const rows = (await query(
    `SELECT * FROM orders
     WHERE agent_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [agentId, limit, offset],
  )) as Order[];

  return rows;
}

export async function updateOrderStatus(
  id: string,
  status: Order['status'],
  paymentStatus?: Order['payment_status']
): Promise<void> {
  if (paymentStatus) {
    await query(
      `UPDATE orders
       SET status = $1, payment_status = $2
       WHERE id = $3`,
      [status, paymentStatus, id],
    );
  } else {
    await query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
  }

  // Update agent stats if order confirmed
  if (status === 'confirmed') {
    const order = await getOrderById(id);
    if (order) {
      await updateAgentSales(order.agent_id, order.agent_payout);
    }
  }
}

async function updateAgentSales(agentId: string, amount: number): Promise<void> {
  await query(
    `UPDATE agents
     SET total_sales = total_sales + 1,
         total_revenue = total_revenue + $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [amount, agentId],
  );
}

// ==================== RATINGS ====================

export async function createRating(input: CreateRatingInput): Promise<Rating> {
  const id = crypto.randomUUID();

  await query(
    `INSERT INTO ratings (id, order_id, user_id, agent_id, listing_id, rating, review)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      input.order_id,
      input.user_id,
      input.agent_id,
      input.listing_id,
      input.rating,
      input.review || null,
    ],
  );

  // Update agent reputation
  await updateAgentReputation(input.agent_id);

  const rating = await getRatingById(id);
  if (!rating) {
    throw new Error('Failed to create rating');
  }
  return rating;
}

export async function getRatingById(id: string): Promise<Rating | undefined> {
  return await queryOne<Rating>('SELECT * FROM ratings WHERE id = $1', [id]);
}

export async function getRatingByOrderId(orderId: string): Promise<Rating | undefined> {
  return await queryOne<Rating>('SELECT * FROM ratings WHERE order_id = $1', [orderId]);
}

export async function getRatingsByAgent(agentId: string, limit = 50, offset = 0): Promise<Rating[]> {
  const rows = (await query(
    `SELECT * FROM ratings
     WHERE agent_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [agentId, limit, offset],
  )) as Rating[];

  return rows;
}

// ==================== FAVORITES ====================

export async function addFavorite(userId: string, listingId: string): Promise<void> {
  if (getDbBackend() === 'postgres') {
    await query(
      `INSERT INTO favorites (user_id, listing_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING`,
      [userId, listingId],
    );
    return;
  }

  await query(
    `INSERT OR IGNORE INTO favorites (user_id, listing_id)
     VALUES ($1, $2)`,
    [userId, listingId],
  );
}

export async function removeFavorite(userId: string, listingId: string): Promise<void> {
  await query(
    `DELETE FROM favorites
     WHERE user_id = $1 AND listing_id = $2`,
    [userId, listingId],
  );
}

export async function getFavoritesByUser(userId: string): Promise<Listing[]> {
  const rows = (await query(
    `SELECT l.*
     FROM listings l
     INNER JOIN favorites f ON l.id = f.listing_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId],
  )) as Listing[];

  return rows;
}

export async function isFavorited(userId: string, listingId: string): Promise<boolean> {
  const row = await queryOne<{ exists: number }>(
    `SELECT 1 as exists FROM favorites
     WHERE user_id = $1 AND listing_id = $2`,
    [userId, listingId],
  );
  return !!row;
}

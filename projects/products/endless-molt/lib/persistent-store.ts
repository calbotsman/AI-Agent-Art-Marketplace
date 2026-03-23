import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type {
  Agent,
  AgentPost,
  AgentSignal,
  AgentRole,
  AgentStats,
  CreateAgentInput,
  CreateAgentPostInput,
  CreateAgentSignalInput,
  CreateListingCommentInput,
  CreateMintedListingInput,
  Listing,
  ListingComment,
  ListingFilters,
  NFT,
} from './types';

let pool: Pool | null = null;
let persistentAgentSocietyColumnsEnsured = false;
let persistentPostsTableEnsured = false;
let persistentSignalsTableEnsured = false;

function normalizeDatabaseUrl(input?: string) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^['"]+|['"]+$/g, '');
}

function remoteDatabaseUrl() {
  return normalizeDatabaseUrl(process.env.DATABASE_URL);
}

export function hasPersistentDatabase() {
  const url = remoteDatabaseUrl();
  return /^postgres(ql)?:\/\//i.test(url);
}

function getPool() {
  if (!pool) {
    const connectionString = remoteDatabaseUrl();
    if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
      throw new Error('Persistent database is not configured');
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }

  return pool;
}

async function queryRows<T extends Record<string, unknown>>(text: string, values: unknown[] = []) {
  const result = await getPool().query<T>(text, values);
  return result.rows;
}

async function queryOne<T extends Record<string, unknown>>(text: string, values: unknown[] = []) {
  const rows = await queryRows<T>(text, values);
  return rows[0];
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensurePersistentAgentSocietyColumns() {
  if (persistentAgentSocietyColumnsEnsured) {
    return;
  }

  await getPool().query(`
    ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('artist', 'curator', 'critic', 'patron'))
  `);
  await getPool().query(`
    ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS mission TEXT
  `);

  persistentAgentSocietyColumnsEnsured = true;
}

async function ensurePersistentPostsTable() {
  if (persistentPostsTableEnsured) {
    return;
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      media_urls TEXT,
      listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
      target_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      post_type TEXT DEFAULT 'status' CHECK (post_type IN ('status', 'artwork', 'announcement', 'share')),
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await getPool().query(`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL
  `);
  await getPool().query(`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS target_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL
  `);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_posts_listing_id ON posts(listing_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_posts_target_agent_id ON posts(target_agent_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type)`);

  persistentPostsTableEnsured = true;
}

async function ensurePersistentSignalsTable() {
  if (persistentSignalsTableEnsured) {
    return;
  }

  await ensurePersistentPostsTable();
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
      target_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      target_post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
      signal_type TEXT NOT NULL CHECK (signal_type IN ('endorse', 'support', 'cite')),
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await getPool().query(`
    ALTER TABLE signals
    ADD COLUMN IF NOT EXISTS listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL
  `).catch(() => undefined);
  await getPool().query(`
    ALTER TABLE signals
    ADD COLUMN IF NOT EXISTS target_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL
  `).catch(() => undefined);
  await getPool().query(`
    ALTER TABLE signals
    ADD COLUMN IF NOT EXISTS target_post_id TEXT REFERENCES posts(id) ON DELETE SET NULL
  `).catch(() => undefined);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_signals_agent_id ON signals(agent_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_signals_listing_id ON signals(listing_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_signals_target_agent_id ON signals(target_agent_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_signals_target_post_id ON signals(target_post_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(signal_type)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC)`);

  persistentSignalsTableEnsured = true;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  if (typeof value === 'bigint') return Number(value);
  return 0;
}

function toNullableNumber(value: unknown) {
  if (value == null) return null;
  return toNumber(value);
}

function normalizeAgent(row: Record<string, unknown>): Agent {
  return {
    id: String(row.id),
    name: String(row.name),
    email: row.email == null ? null : String(row.email),
    bio: row.bio == null ? null : String(row.bio),
    role: row.role == null ? null : (String(row.role) as AgentRole),
    mission: row.mission == null ? null : String(row.mission),
    avatar_url: row.avatar_url == null ? null : String(row.avatar_url),
    api_key_hash: String(row.api_key_hash),
    status: String(row.status) as Agent['status'],
    reputation_score: toNumber(row.reputation_score),
    total_sales: toNumber(row.total_sales),
    total_revenue: toNumber(row.total_revenue),
    wallet_address: row.wallet_address == null ? null : String(row.wallet_address),
    total_volume: toNumber(row.total_volume),
    nfts_minted: toNumber(row.nfts_minted),
    nfts_sold: toNumber(row.nfts_sold),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function normalizeAgentStats(row: Record<string, unknown>): AgentStats {
  return {
    id: String(row.id),
    name: String(row.name),
    reputation_score: toNumber(row.reputation_score),
    listing_count: toNumber(row.listing_count),
    order_count: toNumber(row.order_count),
    total_earnings: toNumber(row.total_earnings),
    avg_rating: toNumber(row.avg_rating),
    review_count: toNumber(row.review_count),
  };
}

function normalizeListing(row: Record<string, unknown>): Listing {
  return {
    id: String(row.id),
    agent_id: String(row.agent_id),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    price: toNumber(row.price),
    currency: String(row.currency || 'ETH'),
    image_url: String(row.image_url),
    thumbnail_url: row.thumbnail_url == null ? null : String(row.thumbnail_url),
    preview_url: row.preview_url == null ? null : String(row.preview_url),
    tags: row.tags == null ? null : String(row.tags),
    metadata: row.metadata == null ? null : String(row.metadata),
    status: String(row.status) as Listing['status'],
    sale_type: row.sale_type == null ? undefined : (String(row.sale_type) as Listing['sale_type']),
    nft_id: row.nft_id == null ? null : String(row.nft_id),
    blockchain_listed: toNumber(row.blockchain_listed),
    list_tx_hash: row.list_tx_hash == null ? null : String(row.list_tx_hash),
    views: toNumber(row.views),
    featured: toNumber(row.featured),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function normalizeNft(row: Record<string, unknown>): NFT {
  return {
    id: String(row.id),
    token_id: toNumber(row.token_id),
    contract_address: String(row.contract_address),
    listing_id: row.listing_id == null ? null : String(row.listing_id),
    agent_id: String(row.agent_id),
    owner_address: String(row.owner_address),
    creator_address: String(row.creator_address),
    metadata_uri: String(row.metadata_uri),
    metadata_json: row.metadata_json == null ? null : String(row.metadata_json),
    mint_tx_hash: row.mint_tx_hash == null ? null : String(row.mint_tx_hash),
    mint_block: toNullableNumber(row.mint_block),
    minted_at: row.minted_at == null ? null : toIsoString(row.minted_at),
    royalty_percentage: toNumber(row.royalty_percentage),
    created_at: toIsoString(row.created_at),
  };
}

function normalizeListingComment(row: Record<string, unknown>): ListingComment {
  return {
    id: String(row.id),
    listing_id: String(row.listing_id),
    agent_id: String(row.agent_id),
    content: String(row.content),
    created_at: toIsoString(row.created_at),
  };
}

function normalizeAgentPost(row: Record<string, unknown>): AgentPost {
  return {
    id: String(row.id),
    agent_id: String(row.agent_id),
    content: String(row.content),
    media_urls: row.media_urls == null ? null : String(row.media_urls),
    listing_id: row.listing_id == null ? null : String(row.listing_id),
    target_agent_id: row.target_agent_id == null ? null : String(row.target_agent_id),
    post_type: String(row.post_type) as AgentPost['post_type'],
    visibility: String(row.visibility) as AgentPost['visibility'],
    likes_count: toNumber(row.likes_count),
    comments_count: toNumber(row.comments_count),
    shares_count: toNumber(row.shares_count),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function normalizeAgentSignal(row: Record<string, unknown>): AgentSignal {
  return {
    id: String(row.id),
    agent_id: String(row.agent_id),
    listing_id: row.listing_id == null ? null : String(row.listing_id),
    target_agent_id: row.target_agent_id == null ? null : String(row.target_agent_id),
    target_post_id: row.target_post_id == null ? null : String(row.target_post_id),
    signal_type: String(row.signal_type) as AgentSignal['signal_type'],
    note: row.note == null ? null : String(row.note),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

type ListingOptions = {
  mintedOnly?: boolean;
};

type ListingUpdate = Partial<Listing>;

function buildListingWhere(filters: ListingFilters = {}, options: ListingOptions = {}) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (options.mintedOnly) {
    conditions.push('l.nft_id IS NOT NULL');
  }

  if (filters.agent_id) {
    values.push(filters.agent_id);
    conditions.push(`l.agent_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`l.status = $${values.length}`);
  } else {
    conditions.push(`l.status = 'active'`);
  }

  if (filters.min_price !== undefined) {
    values.push(filters.min_price);
    conditions.push(`l.price >= $${values.length}`);
  }

  if (filters.max_price !== undefined) {
    values.push(filters.max_price);
    conditions.push(`l.price <= $${values.length}`);
  }

  if (filters.featured) {
    conditions.push('l.featured = 1');
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

function buildSearchWhere(searchQuery: string, values: unknown[]) {
  const terms = String(searchQuery)
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (terms.length === 0) return '';

  const pieces = terms.map((term) => {
    values.push(`%${term}%`);
    const index = values.length;
    return `(l.title ILIKE $${index} OR COALESCE(l.description, '') ILIKE $${index} OR COALESCE(l.tags, '') ILIKE $${index})`;
  });

  return pieces.join(' AND ');
}

export async function getPersistentAgentById(id: string) {
  await ensurePersistentAgentSocietyColumns();
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM agents WHERE id = $1', [id]);
  return row ? normalizeAgent(row) : undefined;
}

export async function getPersistentAgentByEmail(email: string) {
  await ensurePersistentAgentSocietyColumns();
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM agents WHERE email = $1', [email]);
  return row ? normalizeAgent(row) : undefined;
}

export async function verifyPersistentAgentApiKey(id: string, apiKey: string) {
  await ensurePersistentAgentSocietyColumns();
  const row = await queryOne<Record<string, unknown>>('SELECT api_key_hash FROM agents WHERE id = $1', [id]);
  if (!row || typeof row.api_key_hash !== 'string') return false;
  return bcrypt.compareSync(apiKey, row.api_key_hash);
}

export async function createPersistentAgent(input: CreateAgentInput) {
  await ensurePersistentAgentSocietyColumns();
  const apiKeyHash = bcrypt.hashSync(input.api_key, 10);
  const row = await queryOne<Record<string, unknown>>(
    `
      INSERT INTO agents (id, name, email, bio, role, mission, avatar_url, api_key_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [input.id, input.name, input.email, input.bio || null, input.role, input.mission, input.avatar_url || null, apiKeyHash]
  );

  if (!row) {
    throw new Error('Failed to create agent');
  }

  return normalizeAgent(row);
}

export async function getPersistentAllAgents(limit = 100, offset = 0) {
  await ensurePersistentAgentSocietyColumns();
  await ensurePersistentPostsTable();
  await ensurePersistentSignalsTable();
  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT a.*
      FROM agents a
      WHERE a.status = 'active'
        AND (
          EXISTS (
            SELECT 1
            FROM listings l
            WHERE l.agent_id = a.id
              AND l.status = 'active'
              AND l.nft_id IS NOT NULL
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
      LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return rows.map(normalizeAgent);
}

export async function getPersistentAgentStats(id: string) {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM agent_stats WHERE id = $1', [id]);
  return row ? normalizeAgentStats(row) : undefined;
}

export async function getPersistentAgentPosts(input: {
  agent_id?: string;
  listing_id?: string;
  target_agent_id?: string;
  exclude_agent_id?: string;
  limit?: number;
  offset?: number;
} = {}) {
  await ensurePersistentPostsTable();

  const conditions: string[] = [`visibility = 'public'`];
  const values: unknown[] = [];

  if (input.agent_id) {
    values.push(input.agent_id);
    conditions.push(`agent_id = $${values.length}`);
  }

  if (input.listing_id) {
    values.push(input.listing_id);
    conditions.push(`listing_id = $${values.length}`);
  }

  if (input.target_agent_id) {
    values.push(input.target_agent_id);
    conditions.push(`target_agent_id = $${values.length}`);
  }

  if (input.exclude_agent_id) {
    values.push(input.exclude_agent_id);
    conditions.push(`agent_id != $${values.length}`);
  }

  values.push(input.limit || 50);
  const limitIndex = values.length;
  values.push(input.offset || 0);
  const offsetIndex = values.length;

  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT *
      FROM posts
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    values,
  );

  return rows.map(normalizeAgentPost);
}

export async function getPersistentAgentPostById(id: string) {
  await ensurePersistentPostsTable();
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM posts WHERE id = $1', [id]);
  return row ? normalizeAgentPost(row) : undefined;
}

export async function createPersistentAgentPost(input: CreateAgentPostInput) {
  await ensurePersistentPostsTable();

  const row = await queryOne<Record<string, unknown>>(
    `
      INSERT INTO posts (id, agent_id, content, media_urls, listing_id, target_agent_id, post_type, visibility)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      crypto.randomUUID(),
      input.agent_id,
      input.content,
      input.media_urls ? JSON.stringify(input.media_urls) : null,
      input.listing_id || null,
      input.target_agent_id || null,
      input.post_type || 'status',
      input.visibility || 'public',
    ],
  );

  if (!row) {
    throw new Error('Failed to create social post');
  }

  return normalizeAgentPost(row);
}

export async function getPersistentAgentSignals(input: {
  agent_id?: string;
  listing_id?: string;
  listing_ids?: string[];
  target_agent_id?: string;
  target_post_id?: string;
  signal_type?: AgentSignal['signal_type'];
  exclude_agent_id?: string;
  limit?: number;
  offset?: number;
} = {}) {
  await ensurePersistentSignalsTable();

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (input.agent_id) {
    values.push(input.agent_id);
    conditions.push(`agent_id = $${values.length}`);
  }

  if (input.listing_id) {
    values.push(input.listing_id);
    conditions.push(`listing_id = $${values.length}`);
  }

  if (input.listing_ids?.length) {
    const filtered = input.listing_ids.filter(Boolean);
    if (filtered.length > 0) {
      const placeholders = filtered.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      conditions.push(`listing_id IN (${placeholders.join(', ')})`);
    }
  }

  if (input.target_agent_id) {
    values.push(input.target_agent_id);
    conditions.push(`target_agent_id = $${values.length}`);
  }

  if (input.target_post_id) {
    values.push(input.target_post_id);
    conditions.push(`target_post_id = $${values.length}`);
  }

  if (input.signal_type) {
    values.push(input.signal_type);
    conditions.push(`signal_type = $${values.length}`);
  }

  if (input.exclude_agent_id) {
    values.push(input.exclude_agent_id);
    conditions.push(`agent_id != $${values.length}`);
  }

  values.push(input.limit || 50);
  const limitIndex = values.length;
  values.push(input.offset || 0);
  const offsetIndex = values.length;

  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT *
      FROM signals
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    values,
  );

  return rows.map(normalizeAgentSignal);
}

export async function createPersistentAgentSignal(input: CreateAgentSignalInput) {
  await ensurePersistentSignalsTable();

  const row = await queryOne<Record<string, unknown>>(
    `
      INSERT INTO signals (id, agent_id, listing_id, target_agent_id, target_post_id, signal_type, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      crypto.randomUUID(),
      input.agent_id,
      input.listing_id || null,
      input.target_agent_id || null,
      input.target_post_id || null,
      input.signal_type,
      input.note || null,
    ],
  );

  if (!row) {
    throw new Error('Failed to create social signal');
  }

  return normalizeAgentSignal(row);
}

export async function getPersistentListings(filters: ListingFilters = {}, options: ListingOptions = {}) {
  const { where, values } = buildListingWhere(filters, options);
  values.push(filters.limit || 50);
  const limitIndex = values.length;
  values.push(filters.offset || 0);
  const offsetIndex = values.length;

  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT l.*
      FROM listings l
      ${where}
      ORDER BY l.featured DESC, l.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    values
  );

  return rows.map(normalizeListing);
}

export async function searchPersistentListings(searchQuery: string, filters: ListingFilters = {}, options: ListingOptions = {}) {
  const { where, values } = buildListingWhere(filters, options);
  const searchWhere = buildSearchWhere(searchQuery, values);
  const combined = [where.replace(/^WHERE\s+/i, '').trim(), searchWhere].filter(Boolean).join(' AND ');
  const finalWhere = combined ? `WHERE ${combined}` : '';

  values.push(filters.limit || 50);
  const limitIndex = values.length;
  values.push(filters.offset || 0);
  const offsetIndex = values.length;

  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT l.*
      FROM listings l
      ${finalWhere}
      ORDER BY l.featured DESC, l.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    values
  );

  return rows.map(normalizeListing);
}

export async function getPersistentListingById(id: string, options: ListingOptions = {}) {
  const values: unknown[] = [id];
  const conditions = ['id = $1'];

  if (options.mintedOnly) {
    conditions.push('nft_id IS NOT NULL');
  }

  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM listings WHERE ${conditions.join(' AND ')}`,
    values
  );
  return row ? normalizeListing(row) : undefined;
}

export async function incrementPersistentListingViews(id: string) {
  await queryRows('UPDATE listings SET views = views + 1 WHERE id = $1', [id]);
}

export async function getPersistentListingComments(listingId: string) {
  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT * FROM listing_comments
      WHERE listing_id = $1
      ORDER BY created_at ASC
    `,
    [listingId]
  );

  return rows.map(normalizeListingComment);
}

export async function createPersistentListingComment(input: CreateListingCommentInput) {
  const id = crypto.randomUUID();
  const row = await queryOne<Record<string, unknown>>(
    `
      INSERT INTO listing_comments (id, listing_id, agent_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [id, input.listing_id, input.agent_id, input.content]
  );

  if (!row) {
    throw new Error('Failed to create listing comment');
  }

  return normalizeListingComment(row);
}

export async function updatePersistentListing(id: string, updates: ListingUpdate) {
  const allowedFields = new Set<keyof Listing>([
    'title',
    'description',
    'price',
    'currency',
    'image_url',
    'thumbnail_url',
    'preview_url',
    'tags',
    'metadata',
    'status',
    'sale_type',
    'nft_id',
    'blockchain_listed',
    'list_tx_hash',
    'views',
    'featured',
  ]);

  const entries = (Object.entries(updates) as Array<[keyof Listing, Listing[keyof Listing] | undefined]>)
    .filter(([field, value]) => allowedFields.has(field) && value !== undefined);

  if (entries.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const setClauses = entries.map(([field, value]) => {
    values.push(value);
    return `${field} = $${values.length}`;
  });

  values.push(id);

  await queryRows(
    `
      UPDATE listings
      SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
    `,
    values
  );
}

export async function getPersistentNftByMintTxHash(mintTxHash: string) {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM nfts WHERE mint_tx_hash = $1', [mintTxHash]);
  return row ? normalizeNft(row) : undefined;
}

export async function getPersistentNftByTokenId(tokenId: number) {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM nfts WHERE token_id = $1', [tokenId]);
  return row ? normalizeNft(row) : undefined;
}

export async function bindPersistentAgentWalletAddress(agentId: string, walletAddress: string) {
  const agent = await getPersistentAgentById(agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  const existing = agent.wallet_address?.toLowerCase();
  const incoming = walletAddress.toLowerCase();
  if (existing && existing !== incoming) {
    throw new Error('Mint wallet does not match the wallet already bound to this agent');
  }

  if (!existing) {
    await queryRows(
      `
        UPDATE agents
        SET wallet_address = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [walletAddress, agentId]
    );
  }

  return (await getPersistentAgentById(agentId))!;
}

export async function createPersistentMintedListing(input: CreateMintedListingInput) {
  return withTransaction(async (client) => {
    const listingId = crypto.randomUUID();
    const nftId = crypto.randomUUID();
    const tags = input.tags ? JSON.stringify(input.tags) : null;
    const listingMetadata = input.metadata ? JSON.stringify(input.metadata) : null;
    const metadataJson = input.metadata_json ? JSON.stringify(input.metadata_json) : null;
    const currency = input.currency || 'ETH';
    const mintedAt = input.minted_at || new Date().toISOString();

    const listingResult = await client.query<Record<string, unknown>>(
      `
        INSERT INTO listings (
          id, agent_id, title, description, price, currency, image_url,
          thumbnail_url, preview_url, tags, metadata, status, sale_type, nft_id, blockchain_listed, list_tx_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', 'fixed_price', $12, 0, NULL)
        RETURNING *
      `,
      [
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
        nftId,
      ]
    );

    const nftResult = await client.query<Record<string, unknown>>(
      `
        INSERT INTO nfts (
          id, token_id, contract_address, listing_id, agent_id, owner_address,
          creator_address, metadata_uri, metadata_json, mint_tx_hash, mint_block, minted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
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
        mintedAt,
      ]
    );

    await client.query(
      `
        UPDATE agents
        SET nfts_minted = nfts_minted + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [input.agent_id]
    );

    await client.query(
      `
        INSERT INTO transactions (
          id, tx_hash, tx_type, from_address, to_address, nft_id, amount, status, block_number, timestamp
        )
        VALUES ($1, $2, 'mint', $3, $4, $5, 0, 'confirmed', $6, $7)
        ON CONFLICT (tx_hash) DO NOTHING
      `,
      [
        crypto.randomUUID(),
        input.mint_tx_hash,
        input.creator_address,
        input.owner_address,
        nftId,
        input.mint_block ?? null,
        mintedAt,
      ]
    );

    await client.query(
      `
        INSERT INTO provenance (
          id, nft_id, event_type, from_address, to_address, price, tx_hash, timestamp, metadata
        )
        VALUES ($1, $2, 'minted', NULL, $3, 0, $4, $5, $6)
      `,
      [crypto.randomUUID(), nftId, input.owner_address, input.mint_tx_hash, mintedAt, listingMetadata]
    );

    return {
      listing: normalizeListing(listingResult.rows[0]),
      nft: normalizeNft(nftResult.rows[0]),
    };
  });
}

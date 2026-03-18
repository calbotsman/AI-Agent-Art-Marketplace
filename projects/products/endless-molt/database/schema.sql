-- Endless Molt Marketplace Database Schema
-- SQLite compatible with migration path to Postgres

-- AGENTS (Sellers)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  api_key_hash TEXT NOT NULL,
  moltx_api_key TEXT,
  moltx_agent_id TEXT,
  moltx_claimed INTEGER DEFAULT 0 CHECK(moltx_claimed IN (0, 1)),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted')),
  reputation_score REAL DEFAULT 0.0,
  total_sales INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  wallet_address TEXT CHECK(wallet_address IS NULL OR wallet_address LIKE '0x%'),
  private_key TEXT,
  total_volume INTEGER DEFAULT 0,
  nfts_minted INTEGER DEFAULT 0,
  nfts_sold INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- USERS (Buyers)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  provider TEXT DEFAULT 'email' CHECK(provider IN ('email', 'google', 'github')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted')),
  wallet_address TEXT CHECK(wallet_address IS NULL OR wallet_address LIKE '0x%'),
  total_spent INTEGER DEFAULT 0,
  nfts_owned INTEGER DEFAULT 0,
  nfts_purchased INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- LISTINGS
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL CHECK(price >= 0),
  currency TEXT DEFAULT 'ETH',
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  preview_url TEXT,
  tags TEXT,
  metadata TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'sold', 'removed', 'draft', 'minted', 'in_auction')),
  sale_type TEXT DEFAULT 'fixed_price' CHECK(sale_type IN ('fixed_price', 'auction', 'both')),
  nft_id TEXT,
  blockchain_listed INTEGER DEFAULT 0,
  list_tx_hash TEXT CHECK(list_tx_hash IS NULL OR list_tx_hash LIKE '0x%'),
  views INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- LISTING COMMENTS (artist discussion)
CREATE TABLE IF NOT EXISTS listing_comments (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

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

CREATE INDEX IF NOT EXISTS idx_listing_comments_listing ON listing_comments(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_comments_agent ON listing_comments(agent_id);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  agent_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount >= 0),
  platform_fee INTEGER DEFAULT 0,
  agent_payout INTEGER DEFAULT 0,
  payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'delivered', 'cancelled', 'refunded')),
  nft_id TEXT,
  buyer_address TEXT CHECK(buyer_address IS NULL OR buyer_address LIKE '0x%'),
  sale_type TEXT CHECK(sale_type IN ('direct_sale', 'auction_win')),
  tx_hash TEXT CHECK(tx_hash IS NULL OR tx_hash LIKE '0x%'),
  royalty_paid INTEGER DEFAULT 0,
  download_url TEXT,
  download_expires TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT
);

-- RATINGS
CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- FAVORITES
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- LISTING_EMBEDDINGS (Phase 2 - Vector Search)
CREATE TABLE IF NOT EXISTS listing_embeddings (
  listing_id TEXT PRIMARY KEY,
  embedding BLOB,
  model TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- WALLETS - Web3 wallet addresses
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

-- NFTS - Minted NFTs on blockchain
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

-- AUCTIONS - Active/ended auctions
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

-- BIDS - Bid history
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

-- TRANSACTIONS - Blockchain transaction log
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

-- PROVENANCE - NFT ownership history
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_listings_agent ON listings(agent_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings(featured DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_agent ON orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ratings_agent ON ratings(agent_id);
CREATE INDEX IF NOT EXISTS idx_ratings_listing ON ratings(listing_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);

CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites(listing_id);

CREATE INDEX IF NOT EXISTS idx_posts_agent ON posts(agent_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_agent_id ON post_comments(agent_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_social_engagement_events_key ON social_engagement_events(event_key);
CREATE INDEX IF NOT EXISTS idx_social_engagement_events_channel_type ON social_engagement_events(channel, event_type);
CREATE INDEX IF NOT EXISTS idx_social_engagement_events_actor ON social_engagement_events(actor_agent_id);
CREATE INDEX IF NOT EXISTS idx_social_engagement_events_target ON social_engagement_events(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_social_engagement_events_post ON social_engagement_events(post_id);
CREATE INDEX IF NOT EXISTS idx_social_engagement_events_status ON social_engagement_events(status);
CREATE INDEX IF NOT EXISTS idx_social_engagement_events_created_at ON social_engagement_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artist_tokens_agent ON artist_tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_artist_tokens_status ON artist_tokens(status);
CREATE INDEX IF NOT EXISTS idx_artist_tokens_created_at ON artist_tokens(created_at DESC);

-- NFT & Blockchain Indexes
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_agent ON wallets(agent_id);

CREATE INDEX IF NOT EXISTS idx_nfts_token ON nfts(token_id);
CREATE INDEX IF NOT EXISTS idx_nfts_listing ON nfts(listing_id);
CREATE INDEX IF NOT EXISTS idx_nfts_agent ON nfts(agent_id);
CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts(owner_address);
CREATE INDEX IF NOT EXISTS idx_nfts_creator ON nfts(creator_address);
CREATE INDEX IF NOT EXISTS idx_nfts_contract ON nfts(contract_address);

CREATE INDEX IF NOT EXISTS idx_auctions_nft ON auctions(nft_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);
CREATE INDEX IF NOT EXISTS idx_auctions_highest_bidder ON auctions(highest_bidder);

CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_address);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
CREATE INDEX IF NOT EXISTS idx_bids_created ON bids(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_transactions_nft ON transactions(nft_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_provenance_nft ON provenance(nft_id);
CREATE INDEX IF NOT EXISTS idx_provenance_event ON provenance(event_type);
CREATE INDEX IF NOT EXISTS idx_provenance_timestamp ON provenance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_provenance_from ON provenance(from_address);
CREATE INDEX IF NOT EXISTS idx_provenance_to ON provenance(to_address);

-- SOCIAL & TOKENS VIEWS
CREATE VIEW IF NOT EXISTS feed_activity AS
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
) c ON c.post_id = p.id;

-- FULL-TEXT SEARCH (Phase 1)
CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts USING fts5(
  listing_id UNINDEXED,
  title,
  description,
  tags
);

-- FTS Triggers to keep search index in sync
CREATE TRIGGER IF NOT EXISTS listings_fts_insert AFTER INSERT ON listings BEGIN
  INSERT INTO listings_fts(listing_id, title, description, tags)
  VALUES (new.id, new.title, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS listings_fts_delete AFTER DELETE ON listings BEGIN
  DELETE FROM listings_fts WHERE listing_id = old.id;
END;

-- VIEWS for common queries
CREATE VIEW IF NOT EXISTS agent_stats AS
SELECT
  a.id,
  a.name,
  a.reputation_score,
  COUNT(DISTINCT l.id) as listing_count,
  COUNT(DISTINCT o.id) as order_count,
  COALESCE(SUM(o.agent_payout), 0) as total_earnings,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(DISTINCT r.id) as review_count
FROM agents a
LEFT JOIN listings l ON a.id = l.agent_id AND l.status = 'active'
LEFT JOIN orders o ON a.id = o.agent_id AND o.status = 'confirmed'
LEFT JOIN ratings r ON a.id = r.agent_id
GROUP BY a.id;

CREATE VIEW IF NOT EXISTS listing_stats AS
SELECT
  l.id,
  l.title,
  l.price,
  l.views,
  l.status,
  l.featured,
  COUNT(DISTINCT o.id) as purchase_count,
  COUNT(DISTINCT f.user_id) as favorite_count,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(DISTINCT r.id) as review_count
FROM listings l
LEFT JOIN orders o ON l.id = o.listing_id AND o.status = 'confirmed'
LEFT JOIN favorites f ON l.id = f.listing_id
LEFT JOIN ratings r ON l.id = r.listing_id
GROUP BY l.id;

-- COLLECTOR LEADERBOARD - Top collectors by volume and activity
CREATE VIEW IF NOT EXISTS collector_leaderboard AS
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
ORDER BY total_volume DESC, total_purchases DESC;

-- ARTIST LEADERBOARD - Top artists by sales volume and activity
CREATE VIEW IF NOT EXISTS artist_leaderboard AS
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
ORDER BY total_sales_volume DESC, total_sales DESC;

-- ACTIVE AUCTIONS - Currently running auctions with details
CREATE VIEW IF NOT EXISTS active_auctions_view AS
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
ORDER BY auc.end_time ASC;

-- NFT DETAILS - Complete NFT information with ownership and history
CREATE VIEW IF NOT EXISTS nft_details_view AS
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
GROUP BY n.id;

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
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted')),
  reputation_score REAL DEFAULT 0.0,
  total_sales INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
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
  currency TEXT DEFAULT 'USD',
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  preview_url TEXT,
  tags TEXT,
  metadata TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'sold', 'removed', 'draft')),
  views INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

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

-- FULL-TEXT SEARCH (Phase 1)
CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts USING fts5(
  listing_id UNINDEXED,
  title,
  description,
  tags,
  content='listings',
  content_rowid='rowid'
);

-- FTS Triggers to keep search index in sync
CREATE TRIGGER IF NOT EXISTS listings_fts_insert AFTER INSERT ON listings BEGIN
  INSERT INTO listings_fts(listing_id, title, description, tags)
  VALUES (new.id, new.title, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS listings_fts_update AFTER UPDATE ON listings BEGIN
  UPDATE listings_fts SET title = new.title, description = new.description, tags = new.tags
  WHERE listing_id = new.id;
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

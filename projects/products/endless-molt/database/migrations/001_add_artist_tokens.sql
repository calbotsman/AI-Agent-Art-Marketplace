-- Migration: Add Artist Tokens for Clawnch Integration
-- Date: 2026-02-04
-- Description: Adds artist token launching capability via Clawnch/Moltx

-- ARTIST TOKENS - Tokens launched for each artist
CREATE TABLE IF NOT EXISTS artist_tokens (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    token_name TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    token_description TEXT,
    logo_url TEXT,
    contract_address TEXT CHECK(contract_address IS NULL OR contract_address LIKE '0x%'),
    chain TEXT DEFAULT 'base' CHECK(chain IN ('base', 'ethereum', 'polygon')),
    launched_at DATETIME,
    moltx_post_id TEXT,
    moltx_agent_id TEXT,
    clanker_url TEXT,
    clawnch_source TEXT DEFAULT 'moltx' CHECK(clawnch_source IN ('moltx', 'moltbook', '4claw', 'clawstr')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'posting', 'waiting_gate', 'scanning', 'launched', 'failed')),
    failure_reason TEXT,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- ARTIST TOKEN STATS - Accumulated stats for each token
CREATE TABLE IF NOT EXISTS artist_token_stats (
    token_id TEXT PRIMARY KEY,
    price_usd REAL DEFAULT 0,
    market_cap REAL DEFAULT 0,
    volume_24h REAL DEFAULT 0,
    volume_all_time REAL DEFAULT 0,
    price_change_24h REAL DEFAULT 0,
    holder_count INTEGER DEFAULT 0,
    fees_earned_usd REAL DEFAULT 0,
    fees_claimable_usd REAL DEFAULT 0,
    fees_claimed_usd REAL DEFAULT 0,
    last_synced_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES artist_tokens(id) ON DELETE CASCADE
);

-- FEE CLAIMS - History of fee claims
CREATE TABLE IF NOT EXISTS artist_token_fee_claims (
    id TEXT PRIMARY KEY,
    token_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    amount_weth REAL NOT NULL,
    amount_usd REAL NOT NULL,
    artist_share REAL NOT NULL, -- 70%
    platform_share REAL NOT NULL, -- 10%
    clawnch_share REAL NOT NULL, -- 20%
    tx_hash TEXT CHECK(tx_hash IS NULL OR tx_hash LIKE '0x%'),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES artist_tokens(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Update agents table to include Moltx info
ALTER TABLE agents ADD COLUMN token_enabled INTEGER DEFAULT 1;
ALTER TABLE agents ADD COLUMN moltx_agent_id TEXT;
ALTER TABLE agents ADD COLUMN moltx_api_key TEXT;
ALTER TABLE agents ADD COLUMN moltx_claimed INTEGER DEFAULT 0;

-- Indexes for artist tokens
CREATE INDEX IF NOT EXISTS idx_artist_tokens_agent ON artist_tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_artist_tokens_status ON artist_tokens(status);
CREATE INDEX IF NOT EXISTS idx_artist_tokens_contract ON artist_tokens(contract_address);
CREATE INDEX IF NOT EXISTS idx_artist_tokens_created ON artist_tokens(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_artist_token_stats_token ON artist_token_stats(token_id);
CREATE INDEX IF NOT EXISTS idx_artist_token_stats_volume ON artist_token_stats(volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_artist_token_stats_market_cap ON artist_token_stats(market_cap DESC);

CREATE INDEX IF NOT EXISTS idx_artist_token_fee_claims_token ON artist_token_fee_claims(token_id);
CREATE INDEX IF NOT EXISTS idx_artist_token_fee_claims_agent ON artist_token_fee_claims(agent_id);
CREATE INDEX IF NOT EXISTS idx_artist_token_fee_claims_status ON artist_token_fee_claims(status);
CREATE INDEX IF NOT EXISTS idx_artist_token_fee_claims_claimed ON artist_token_fee_claims(claimed_at DESC);

-- View for token leaderboard
CREATE VIEW IF NOT EXISTS token_leaderboard_view AS
SELECT
    t.id,
    t.token_name,
    t.token_symbol,
    t.contract_address,
    t.status,
    t.launched_at,
    t.clanker_url,
    a.id as artist_id,
    a.name as artist_name,
    s.price_usd,
    s.market_cap,
    s.volume_24h,
    s.volume_all_time,
    s.price_change_24h,
    s.fees_earned_usd,
    s.holder_count
FROM artist_tokens t
INNER JOIN agents a ON t.agent_id = a.id
LEFT JOIN artist_token_stats s ON t.id = s.token_id
WHERE t.status = 'launched'
ORDER BY s.volume_24h DESC;

-- View for artist token performance
CREATE VIEW IF NOT EXISTS artist_token_performance_view AS
SELECT
    a.id as artist_id,
    a.name as artist_name,
    t.id as token_id,
    t.token_name,
    t.token_symbol,
    t.contract_address,
    t.status,
    s.market_cap,
    s.volume_24h,
    s.fees_earned_usd,
    s.fees_claimable_usd,
    COUNT(DISTINCT c.id) as total_claims,
    COALESCE(SUM(c.artist_share), 0) as total_artist_earnings,
    COALESCE(SUM(c.platform_share), 0) as total_platform_earnings
FROM agents a
LEFT JOIN artist_tokens t ON a.id = t.agent_id
LEFT JOIN artist_token_stats s ON t.id = s.token_id
LEFT JOIN artist_token_fee_claims c ON t.id = c.token_id AND c.status = 'completed'
GROUP BY a.id, t.id;

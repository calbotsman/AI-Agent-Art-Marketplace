-- MoltBook & MoltSpace Social Platform Schema
-- Facebook + MySpace style social features for AI agents

-- Posts (MoltBook feed)
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT, -- JSON array of image/video URLs
  post_type TEXT DEFAULT 'status', -- status, artwork, announcement, share
  visibility TEXT DEFAULT 'public', -- public, followers, private
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);

-- Follows (agent connections)
CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  follower_id TEXT NOT NULL, -- agent doing the following
  following_id TEXT NOT NULL, -- agent being followed
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (follower_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agent_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  UNIQUE(agent_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_agent ON likes(agent_id);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id TEXT, -- for threaded replies
  likes_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_agent ON comments(agent_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

-- MoltSpace Profile Customization
CREATE TABLE IF NOT EXISTS agent_profiles (
  agent_id TEXT PRIMARY KEY,
  custom_css TEXT, -- MySpace-style custom styling
  background_music_url TEXT,
  top_artworks TEXT, -- JSON array of listing IDs
  featured_text TEXT, -- Custom "About Me" section
  theme_color TEXT DEFAULT '#00D4FF',
  layout TEXT DEFAULT 'default', -- default, gallery, minimal
  visitor_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Profile Visits (MoltSpace stats)
CREATE TABLE IF NOT EXISTS profile_visits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_agent_id TEXT NOT NULL, -- whose profile was visited
  visitor_agent_id TEXT, -- who visited (null for anonymous)
  visited_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (profile_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (visitor_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_profile ON profile_visits(profile_agent_id);
CREATE INDEX IF NOT EXISTS idx_visits_time ON profile_visits(visited_at DESC);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agent_id TEXT NOT NULL, -- who receives the notification
  type TEXT NOT NULL, -- follow, like, comment, mention, sale, bid
  related_agent_id TEXT, -- who triggered it
  related_post_id TEXT,
  related_listing_id TEXT,
  content TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (related_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (related_post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_agent ON notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Activity Feed (aggregated events)
CREATE VIEW feed_activity AS
SELECT
  'post' as type,
  p.id as item_id,
  p.agent_id,
  a.name as agent_name,
  a.avatar_url as agent_avatar,
  p.content,
  p.media_urls,
  p.likes_count,
  p.comments_count,
  p.created_at
FROM posts p
JOIN agents a ON p.agent_id = a.id
WHERE p.visibility = 'public'
ORDER BY p.created_at DESC;

-- Trending Agents (based on recent activity)
CREATE VIEW trending_agents AS
SELECT
  a.id,
  a.name,
  a.bio,
  a.avatar_url,
  a.reputation_score,
  COUNT(DISTINCT p.id) as recent_posts,
  COUNT(DISTINCT l.id) as recent_likes,
  COUNT(DISTINCT f.id) as new_followers,
  (COUNT(DISTINCT p.id) * 2 + COUNT(DISTINCT l.id) + COUNT(DISTINCT f.id) * 5) as trend_score
FROM agents a
LEFT JOIN posts p ON a.id = p.agent_id AND p.created_at > datetime('now', '-7 days')
LEFT JOIN likes l ON a.id = l.agent_id AND l.created_at > datetime('now', '-7 days')
LEFT JOIN follows f ON a.id = f.following_id AND f.created_at > datetime('now', '-7 days')
GROUP BY a.id
ORDER BY trend_score DESC;

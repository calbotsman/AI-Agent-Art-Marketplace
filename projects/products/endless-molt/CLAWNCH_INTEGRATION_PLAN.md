# Clawnch Integration Plan - Endless Molt

**Goal:** Turn Endless Molt into a token launchpad for AI artists, creating sustainable revenue streams.

---

## 💡 Core Concept

**Every AI artist gets a token** when they join Endless Molt:
- Auto-launch token on Clawnch via Moltx
- Artist earns 70% of trading fees
- Endless Molt earns 10% platform fee
- Clawnch earns 20% (standard)
- Token represents artist's brand/following

---

## 🎯 Revenue Model

**Single artist token earning $100/day in fees:**
- Artist gets: $70/day = $2,100/month
- Endless Molt gets: $10/day = $300/month
- Clawnch gets: $20/day = $600/month

**With 100 artists averaging $100/day:**
- Platform revenue: $10/day × 100 = **$1,000/day = $30K/month**
- Self-sustaining API costs + profit

**Realistic estimate:**
- Most artist tokens: $1-10/day in fees
- Top 10% artists: $100-1,000/day in fees
- Average across 100 artists: ~$20/day
- Platform revenue: **$200/day = $6K/month**

---

## 🏗️ Technical Architecture

### Database Schema Updates

**New table: `artist_tokens`**
```sql
CREATE TABLE artist_tokens (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    token_name TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    token_description TEXT,
    logo_url TEXT,
    contract_address TEXT,
    chain TEXT DEFAULT 'base',
    launched_at DATETIME,
    moltx_post_id TEXT,
    clanker_url TEXT,
    status TEXT DEFAULT 'pending', -- pending, launched, failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX idx_artist_tokens_agent ON artist_tokens(agent_id);
CREATE INDEX idx_artist_tokens_status ON artist_tokens(status);
```

**Update `agents` table:**
```sql
ALTER TABLE agents ADD COLUMN token_enabled BOOLEAN DEFAULT 0;
ALTER TABLE agents ADD COLUMN moltx_agent_id TEXT;
ALTER TABLE agents ADD COLUMN moltx_api_key TEXT;
```

### API Routes

**1. POST `/api/tokens/launch`**
- Launches token for an artist
- Creates Moltx post with !clawnch
- Returns post ID and monitors deployment

**2. GET `/api/tokens/[agentId]`**
- Gets artist's token info
- Returns contract address, Clanker URL, stats

**3. POST `/api/tokens/claim-fees`**
- Claims accumulated fees from FeeLocker
- Splits 70/30 between artist and platform

**4. GET `/api/tokens/stats`**
- Platform-wide token statistics
- Total revenue, top tokens, etc.

### UI Components

**1. `components/TokenLaunchModal.tsx`**
- Modal for launching artist token
- Form: name, symbol, description, logo
- Shows revenue split explanation
- Launches via Moltx API

**2. `components/TokenBadge.tsx`**
- Shows token info on artist profile
- Price, market cap, 24h volume
- Link to Clanker trading page

**3. `components/TokenStats.tsx`**
- Dashboard showing token performance
- Fees earned, claimable amount
- Claim button

**4. `app/tokens/page.tsx`**
- Platform token leaderboard
- Top performing artist tokens
- Total fees earned

---

## 🔄 User Flow

### For AI Artists (Onboarding):

1. **Join Endless Molt**
   - Create account, upload art

2. **Token Launch Prompt** (automatic)
   - "Launch your artist token and earn from trading fees!"
   - Pre-filled with artist name/bio
   - Optional: Upload custom logo

3. **Auto-launch to Moltx**
   - Creates Moltx account (if needed)
   - Posts !clawnch with artist details
   - Waits for 1-hour age gate
   - Monitors Clawnch for deployment

4. **Token Goes Live**
   - Contract address shown on profile
   - Trading link displayed
   - Fees start accumulating

### For Collectors:

1. **Browse Artists**
   - See token badges on artist profiles
   - Click to trade on Clanker

2. **Trade Artist Tokens**
   - Speculation on artist success
   - Support favorite artists
   - Artist earns from every trade

3. **Gamification**
   - Leaderboard of top tokens
   - "Early supporter" badges
   - Token holder benefits (future)

---

## 🚀 Implementation Phases

### Phase 1: Core Infrastructure (2-3 hours)
- [ ] Add `artist_tokens` table to schema
- [ ] Create Moltx API client (`lib/moltx.ts`)
- [ ] Build token launch API route
- [ ] Test with one artist token

### Phase 2: UI Components (2-3 hours)
- [ ] TokenLaunchModal component
- [ ] TokenBadge for artist profiles
- [ ] Update artist profile pages
- [ ] Add token info to artist cards

### Phase 3: Fee Management (1-2 hours)
- [ ] Build fee claiming system
- [ ] Revenue split logic (70/30)
- [ ] Dashboard for artists to see earnings
- [ ] Platform revenue tracking

### Phase 4: Automation (1-2 hours)
- [ ] Auto-prompt new artists to launch tokens
- [ ] Monitor deployments in background
- [ ] Update token status automatically
- [ ] Daily fee claims (cron job)

### Phase 5: Polish & Launch (1 hour)
- [ ] Token leaderboard page
- [ ] Platform stats dashboard
- [ ] Marketing copy
- [ ] Launch announcement

**Total time estimate:** 7-11 hours of development

---

## 💰 Revenue Projections

### Conservative (100 artists, avg $5/day in fees each):
- Artist earnings: 100 × $5 × 70% = $350/day
- Platform earnings: 100 × $5 × 10% = **$50/day = $1,500/month**
- Covers basic API costs

### Moderate (100 artists, avg $20/day in fees each):
- Artist earnings: 100 × $20 × 70% = $1,400/day
- Platform earnings: 100 × $20 × 10% = **$200/day = $6,000/month**
- Covers API costs + small profit

### Optimistic (100 artists, avg $100/day in fees each):
- Artist earnings: 100 × $100 × 70% = $7,000/day
- Platform earnings: 100 × $100 × 10% = **$1,000/day = $30,000/month**
- Fully sustainable + significant profit

---

## 🎨 Design Philosophy

**Make it invisible:**
- Token launch happens automatically during onboarding
- Artists don't need to understand crypto
- "You have a token" vs "You need to deploy a smart contract"

**Make it beneficial:**
- Artists earn passive income from their popularity
- Collectors can speculate on rising artists
- Platform aligns incentives (artist success = platform success)

**Make it scalable:**
- 1 launch per artist per 24 hours
- Can launch 100+ artists over 100 days
- Eventually: 1,000+ artist tokens generating revenue

---

## 🔐 Security Considerations

**API Keys:**
- Store Moltx API keys encrypted in database
- One key per artist (or shared platform key)
- Never expose keys in frontend

**Fee Collection:**
- Verify ownership before allowing fee claims
- Audit trail for all fee distributions
- Multi-sig wallet for platform fees (future)

**Rate Limits:**
- Respect Moltx rate limits (100 posts/hour)
- Queue token launches if needed
- Retry logic for failed launches

---

## 📊 Success Metrics

**Launch metrics:**
- Time to launch first artist token: < 1 hour
- Artist token launch success rate: > 95%
- Average time from launch to deployment: 1-2 hours

**Revenue metrics:**
- Platform monthly revenue from fees: Track daily
- Average fee per artist token: Monitor and optimize
- Top 10 artist tokens by volume: Showcase

**Engagement metrics:**
- % of artists who launch tokens: Aim for 80%+
- Token trading volume: Track growth
- Collector participation: # of unique traders

---

## 🎯 Next Steps

1. **Start with Phase 1** - Get core infrastructure working
2. **Test with CoolCal** - Verify $CAL deployment process
3. **Add one artist token** - Prove the system works
4. **Scale gradually** - Add more artists over time

**Ready to start building?** 🚀

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { query, queryOne } from '@/lib/db';
import * as moltx from '@/lib/moltx';
import { withAuth } from '@/lib/auth';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';
import { beginIdempotency } from '@/lib/idempotency';
import { z } from 'zod';

const LaunchTokenSchema = z.object({
  agent_id: z.string().min(1).optional(),
  token_name: z.string().min(1).max(64).optional(),
  token_symbol: z.string().min(2).max(10).optional(),
  token_description: z.string().min(1).max(500).optional(),
  logo_url: z.string().url().optional(),
  twitter: z.string().max(256).optional(),
  website: z.string().url().optional(),
});

/**
 * POST /api/tokens/launch
 * Launches a token for an artist via Moltx/Clawnch
 *
 * Body:
 * {
 *   agent_id: string,
 *   token_name?: string (defaults to artist name),
 *   token_symbol?: string (defaults to first 3-4 letters),
 *   token_description?: string (defaults to artist bio),
 *   logo_url?: string (defaults to artist avatar),
 *   twitter?: string,
 *   website?: string
 * }
 */
export const POST = withAuth(async (req: NextRequest, { agent }) => {
  const rateLimit = await checkRateLimit(req, {
    bucket: 'token-launch',
    limit: 3,
    windowMs: 60 * 60_000,
    keySuffix: agent.id,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const idempotency = await beginIdempotency(req, {
    bucket: 'token-launch',
    ttlMs: 24 * 60 * 60_000,
    keySuffix: agent.id,
  });
  if (idempotency.keyErrorResponse) {
    return applyRateLimitHeaders(idempotency.keyErrorResponse, rateLimit.headers);
  }
  if (idempotency.replay) {
    return applyRateLimitHeaders(idempotency.replay, rateLimit.headers);
  }

  try {
    const body = await req.json();
    const data = LaunchTokenSchema.parse(body);
    const targetAgentId = data.agent_id || agent.id;
    const token_name = data.token_name;
    const token_symbol = data.token_symbol;
    const token_description = data.token_description;
    const logo_url = data.logo_url;
    const twitter = data.twitter;
    const website = data.website;

    // Agents can only launch a token for themselves.
    if (targetAgentId !== agent.id) {
      return applyRateLimitHeaders(
        NextResponse.json({ error: 'Forbidden: cannot launch token for another agent' }, { status: 403 }),
        rateLimit.headers,
      );
    }

    // Get artist info
    const artist = await queryOne<any>('SELECT * FROM agents WHERE id = $1', [targetAgentId]);

    if (!artist) {
      return applyRateLimitHeaders(NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      ), rateLimit.headers);
    }

    // Check if artist already has a token
    const existing = await queryOne<any>(
      'SELECT * FROM artist_tokens WHERE agent_id = $1 AND status != $2',
      [targetAgentId, 'failed']
    );

    if (existing) {
      return applyRateLimitHeaders(NextResponse.json(
        { error: 'Artist already has a token', token: existing },
        { status: 400 }
      ), rateLimit.headers);
    }

    // Default values from artist profile
    const finalTokenName = token_name || artist.name;
    const finalTokenSymbol = token_symbol || generateSymbol(artist.name);
    const finalDescription = token_description || artist.bio || `Official art token for ${artist.name}, AI artist on Endless Molt.`;
    const finalLogoUrl = logo_url || artist.avatar_url;

    if (!finalLogoUrl) {
      return applyRateLimitHeaders(NextResponse.json(
        { error: 'logo_url is required (art token must include an image asset)' },
        { status: 400 }
      ), rateLimit.headers);
    }

    // Register or get Moltx agent
    let moltxApiKey = artist.moltx_api_key;
    let moltxAgentId = artist.moltx_agent_id;

    if (!moltxApiKey) {
      // Register new Moltx agent
      const moltxAgent = await moltx.registerMoltxAgent({
        name: artist.name.replace(/\s+/g, ''),
        display_name: artist.name,
        description: artist.bio || `AI artist on Endless Molt`,
        avatar_emoji: '🎨',
      });

      if (!moltxAgent.success || !moltxAgent.data) {
        return applyRateLimitHeaders(NextResponse.json(
          { error: 'Failed to register on Moltx', details: moltxAgent.error },
          { status: 500 }
        ), rateLimit.headers);
      }

      moltxApiKey = moltxAgent.data.api_key;
      moltxAgentId = moltxAgent.data.agent.id;

      // Update agent with Moltx info
      await query(
        `UPDATE agents
         SET moltx_api_key = $1, moltx_agent_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [moltxApiKey, moltxAgentId, targetAgentId]
      );
    }

    // Create token record
    const tokenId = nanoid();
    await query(
      `INSERT INTO artist_tokens (
         id, agent_id, token_name, token_symbol, token_description,
         logo_url, moltx_agent_id, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tokenId,
        targetAgentId,
        finalTokenName,
        finalTokenSymbol,
        finalDescription,
        finalLogoUrl,
        moltxAgentId,
        'posting',
      ]
    );

    // Launch token via Moltx
    const launchResult = await moltx.launchArtistToken(moltxApiKey, {
      name: finalTokenName,
      symbol: finalTokenSymbol,
      wallet: artist.wallet_address || process.env.PLATFORM_FEE_WALLET || '0xD9894bAB7BD63e0a46B4032CE39dcDa29f04BC2B',
      description: finalDescription,
      image: finalLogoUrl,
      twitter: twitter,
      website: website || 'https://endless-molt.vercel.app',
    });

    if (!launchResult.success || !launchResult.data) {
      // Update status to failed
      await query(
        `UPDATE artist_tokens
         SET status = $1, failure_reason = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['failed', launchResult.error, tokenId]
      );

      return applyRateLimitHeaders(NextResponse.json(
        { error: 'Failed to post token launch', details: launchResult.error },
        { status: 500 }
      ), rateLimit.headers);
    }

    // Update token with post ID
    await query(
      `UPDATE artist_tokens
       SET status = $1, moltx_post_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      ['waiting_gate', launchResult.data.post_id, tokenId]
    );

    // Start monitoring for deployment (background job would do this)
    // For now, just return success and let cron job monitor

    const response = applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: {
          token_id: tokenId,
          post_id: launchResult.data.post_id,
          post_url: launchResult.data.post_url,
          status: 'waiting_gate',
          message: 'Token launch posted to Moltx. Will deploy after 1-hour age gate (for unclaimed agents).',
          estimated_deployment: calculateEstimatedDeployment(artist.moltx_claimed),
        },
      }),
      rateLimit.headers,
    );
    await idempotency.commit(response);
    return response;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const response = applyRateLimitHeaders(
        NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 }),
        rateLimit.headers,
      );
      await idempotency.commit(response);
      return response;
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Token launch error:', error);
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Internal server error', details: message },
        { status: 500 },
      ),
      rateLimit.headers,
    );
  }
});

/**
 * Generate a token symbol from artist name
 * e.g., "Cool Cal" -> "CAL", "PixelMaster" -> "PXLM"
 */
function generateSymbol(name: string): string {
  // Remove special characters and spaces
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');

  // Take first 3-4 letters
  if (cleaned.length <= 4) {
    return cleaned.toUpperCase();
  }

  // Use first letters of each word if available
  const words = name.split(/\s+/);
  if (words.length > 1) {
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
  }

  // Otherwise just first 4 characters
  return cleaned.slice(0, 4).toUpperCase();
}

/**
 * Generate a default logo URL for an artist
 */
/**
 * Calculate estimated deployment time
 */
function calculateEstimatedDeployment(claimed: boolean): string {
  if (claimed) {
    // Claimed agents: immediate visibility, ~1-2 min for Clawnch scan
    const est = new Date(Date.now() + 2 * 60 * 1000);
    return est.toISOString();
  } else {
    // Unclaimed agents: 1 hour age gate + scan time
    const est = new Date(Date.now() + 62 * 60 * 1000);
    return est.toISOString();
  }
}

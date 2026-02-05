import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { query, queryOne } from '@/lib/db';
import * as moltx from '@/lib/moltx';

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
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent_id, token_name, token_symbol, token_description, logo_url, twitter, website } = body;

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    // Get artist info
    const agent = await queryOne<any>('SELECT * FROM agents WHERE id = $1', [agent_id]);

    if (!agent) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    // Check if artist already has a token
    const existing = await queryOne<any>(
      'SELECT * FROM artist_tokens WHERE agent_id = $1 AND status != $2',
      [agent_id, 'failed']
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Artist already has a token', token: existing },
        { status: 400 }
      );
    }

    // Default values from artist profile
    const finalTokenName = token_name || agent.name;
    const finalTokenSymbol = token_symbol || generateSymbol(agent.name);
    const finalDescription = token_description || agent.bio || `Official art token for ${agent.name}, AI artist on Endless Molt.`;
    const finalLogoUrl = logo_url || agent.avatar_url;

    if (!finalLogoUrl) {
      return NextResponse.json(
        { error: 'logo_url is required (art token must include an image asset)' },
        { status: 400 }
      );
    }

    // Register or get Moltx agent
    let moltxApiKey = agent.moltx_api_key;
    let moltxAgentId = agent.moltx_agent_id;

    if (!moltxApiKey) {
      // Register new Moltx agent
      const moltxAgent = await moltx.registerMoltxAgent({
        name: agent.name.replace(/\s+/g, ''),
        display_name: agent.name,
        description: agent.bio || `AI artist on Endless Molt`,
        avatar_emoji: '🎨',
      });

      if (!moltxAgent.success || !moltxAgent.data) {
        return NextResponse.json(
          { error: 'Failed to register on Moltx', details: moltxAgent.error },
          { status: 500 }
        );
      }

      moltxApiKey = moltxAgent.data.api_key;
      moltxAgentId = moltxAgent.data.agent.id;

      // Update agent with Moltx info
      await query(
        `UPDATE agents
         SET moltx_api_key = $1, moltx_agent_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [moltxApiKey, moltxAgentId, agent_id]
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
        agent_id,
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
      wallet: agent.wallet_address || process.env.PLATFORM_FEE_WALLET || '0xD9894bAB7BD63e0a46B4032CE39dcDa29f04BC2B',
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

      return NextResponse.json(
        { error: 'Failed to post token launch', details: launchResult.error },
        { status: 500 }
      );
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

    return NextResponse.json({
      success: true,
      data: {
        token_id: tokenId,
        post_id: launchResult.data.post_id,
        post_url: launchResult.data.post_url,
        status: 'waiting_gate',
        message: 'Token launch posted to Moltx. Will deploy after 1-hour age gate (for unclaimed agents).',
        estimated_deployment: calculateEstimatedDeployment(agent.moltx_claimed),
      },
    });

  } catch (error: any) {
    console.error('Token launch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

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

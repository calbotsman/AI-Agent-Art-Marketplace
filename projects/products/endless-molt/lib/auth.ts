/**
 * Authentication utilities for agents and buyers
 */

import { NextRequest } from 'next/server';
import { getAgentById, verifyAgentApiKey, getUserById } from './queries';
import { Agent, User } from './types';
import { auth } from '@/auth';

// ==================== AGENT AUTHENTICATION ====================

/**
 * Extract API key from request headers.
 *
 * Supports:
 * - Authorization: Bearer <agentId:secret>
 * - Authorization: ApiKey <agentId:secret>
 * - X-API-Key: <agentId:secret>
 */
function extractApiKey(request: NextRequest): string | null {
  const direct = request.headers.get('x-api-key');
  if (direct && direct.trim()) return direct.trim();

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^(Bearer|ApiKey)\s+(.+)$/i);
  return match ? match[2] : null;
}

/**
 * Authenticate agent via API key
 */
export async function authenticateAgent(request: NextRequest): Promise<Agent | null> {
  const apiKey = extractApiKey(request);
  if (!apiKey) return null;

  // Parse agent ID from API key format: "agentId:secret"
  // Note: we hash the full API key string in the DB, so verification must use the full key.
  const colon = apiKey.indexOf(':');
  if (colon <= 0 || colon === apiKey.length - 1) return null;
  const agentId = apiKey.slice(0, colon);

  // Verify API key
  const isValid = await verifyAgentApiKey(agentId, apiKey);
  if (!isValid) return null;

  // Return agent data
  return (await getAgentById(agentId)) || null;
}

/**
 * Require agent authentication (throws if not authenticated)
 */
export async function requireAgent(request: NextRequest): Promise<Agent> {
  const agent = await authenticateAgent(request);
  if (!agent) {
    throw new Error('Unauthorized: Invalid or missing API key');
  }
  return agent;
}

// ==================== OPERATOR / ADMIN AUTHENTICATION ====================

/**
 * Require an operator/admin token for sensitive server-side actions (custodial keys).
 * This is intentionally separate from agent auth. If an agent API key leaks,
 * it must not be sufficient to spend from DEPLOYER/OWNER wallets.
 *
 * Header: x-admin-token: <SERVER_ADMIN_TOKEN>
 */
export function requireAdminToken(request: Pick<Request, 'headers'>): void {
  const expected = process.env.SERVER_ADMIN_TOKEN;
  if (!expected) {
    throw new Error('Server admin token is not configured (set SERVER_ADMIN_TOKEN)');
  }

  const provided = request.headers.get('x-admin-token') || '';
  if (!provided || provided !== expected) {
    throw new Error('Unauthorized: Missing or invalid admin token');
  }
}

// ==================== USER/BUYER AUTHENTICATION ====================

/**
 * Get current user from session
 * Note: This will be integrated with NextAuth.js
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const session = await auth();
  const token =
    (session?.user && (session.user as { id?: string }).id) ||
    request.cookies.get('user-token')?.value;
  if (!token) return null;

  try {
    // In production, verify JWT token
    // For now, treat token as user ID
    const userId = String(token);
    return (await getUserById(userId)) || null;
  } catch {
    return null;
  }
}

/**
 * Require user authentication (throws if not authenticated)
 */
export async function requireUser(request: NextRequest): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized: Please log in');
  }
  return user;
}

// ==================== API KEY GENERATION ====================

/**
 * Generate a new API key for an agent
 * Format: agentId:randomSecret
 */
export function generateApiKey(agentId: string): string {
  const crypto = require('crypto');
  const secret = crypto.randomBytes(32).toString('hex');
  return `${agentId}:${secret}`;
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(apiKey: string): string {
  const bcrypt = require('bcrypt');
  return bcrypt.hashSync(apiKey, 10);
}

// ==================== MIDDLEWARE ====================

type AuthOptions = { type: 'agent' };
type AgentAuthContext = { agent: Agent };
type UserAuthContext = { user: User };

/**
 * Create an authenticated API route handler.
 * Supports handlers with or without route context.
 */
export function withAuth(
  handler: (request: NextRequest, context: AgentAuthContext) => Promise<Response>,
  options?: AuthOptions
): (request: NextRequest) => Promise<Response>;
export function withAuth<TContext extends object>(
  handler: (request: NextRequest, context: TContext & AgentAuthContext) => Promise<Response>,
  options?: AuthOptions
): (request: NextRequest, context: TContext) => Promise<Response>;
export function withAuth<TContext extends object>(
  handler: (request: NextRequest, context: TContext & AgentAuthContext) => Promise<Response>,
  options: AuthOptions = { type: 'agent' }
) {
  return async (request: NextRequest, context?: TContext): Promise<Response> => {
    try {
      if (options.type === 'agent') {
        const agent = await requireAgent(request);
        const authContext = { ...(context ?? ({} as TContext)), agent } as TContext & AgentAuthContext;
        return await handler(request, authContext);
      }

      return new Response(JSON.stringify({ error: 'Invalid auth type' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      return new Response(
        JSON.stringify({
          error: message || 'Authentication failed',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

/**
 * Create an authenticated API route handler for users.
 * Supports handlers with or without route context.
 */
export function withUserAuth(
  handler: (request: NextRequest, context: UserAuthContext) => Promise<Response>
): (request: NextRequest) => Promise<Response>;
export function withUserAuth<TContext extends object>(
  handler: (request: NextRequest, context: TContext & UserAuthContext) => Promise<Response>
): (request: NextRequest, context: TContext) => Promise<Response>;
export function withUserAuth<TContext extends object>(
  handler: (request: NextRequest, context: TContext & UserAuthContext) => Promise<Response>
) {
  return async (request: NextRequest, context?: TContext): Promise<Response> => {
    try {
      const user = await requireUser(request);
      const authContext = { ...(context ?? ({} as TContext)), user } as TContext & UserAuthContext;
      return await handler(request, authContext);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      return new Response(
        JSON.stringify({
          error: message || 'Authentication failed',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

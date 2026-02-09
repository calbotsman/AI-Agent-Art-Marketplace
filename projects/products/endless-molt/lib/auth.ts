/**
 * Authentication utilities for agents and buyers
 */

import { NextRequest } from 'next/server';
import { getAgentById, verifyAgentApiKey, getUserById } from './queries';
import { Agent, User } from './types';

// ==================== AGENT AUTHENTICATION ====================

/**
 * Extract API key from Authorization header
 */
function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  // Support both "Bearer <key>" and "ApiKey <key>" formats
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
  const isValid = verifyAgentApiKey(agentId, apiKey);
  if (!isValid) return null;

  // Return agent data
  return getAgentById(agentId) || null;
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

// ==================== USER/BUYER AUTHENTICATION ====================

/**
 * Get current user from session
 * Note: This will be integrated with NextAuth.js
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  // TODO: Integrate with NextAuth.js session
  // For now, we'll use a simple token approach
  const token = request.cookies.get('user-token')?.value;
  if (!token) return null;

  try {
    // In production, verify JWT token
    // For now, treat token as user ID
    const userId = token;
    return getUserById(userId) || null;
  } catch (error) {
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

/**
 * Create an authenticated API route handler
 */
export function withAuth(
  handler: (request: NextRequest, context: any) => Promise<Response>,
  options: { type: 'agent' } = { type: 'agent' }
) {
  return async (request: NextRequest, context: any): Promise<Response> => {
    try {
      if (options.type === 'agent') {
        const agent = await requireAgent(request);
        return await handler(request, { ...context, agent });
      }

      return new Response(JSON.stringify({ error: 'Invalid auth type' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          error: error.message || 'Authentication failed',
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
 * Create an authenticated API route handler for users
 */
export function withUserAuth(
  handler: (request: NextRequest, context: any) => Promise<Response>
) {
  return async (request: NextRequest, context: any): Promise<Response> => {
    try {
      const user = await requireUser(request);
      return await handler(request, { ...context, user });
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          error: error.message || 'Authentication failed',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

/**
 * Agent registration endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAgent, getAgentById, getAgentByEmail } from '@/lib/queries';
import { generateApiKey } from '@/lib/auth';
import { z } from 'zod';
import {
  createPersistentAgent,
  getPersistentAgentByEmail,
  getPersistentAgentById,
  hasPersistentDatabase,
} from '@/lib/persistent-store';

const AgentRegisterSchema = z.object({
  id: z.string().min(3).max(50).optional(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  // Forms often submit empty strings for optional fields. Normalize those to undefined.
  bio: z.preprocess((v) => (v === '' ? undefined : v), z.string().max(500).optional()),
  role: z.enum(['artist', 'curator', 'critic', 'patron']),
  mission: z
    .string()
    .trim()
    .min(24, 'Mission must be at least 24 characters')
    .max(280, 'Mission must be 280 characters or fewer'),
  avatar_url: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
});

function slugifyAgentId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return slug || 'agent';
}

async function agentIdExists(id: string) {
  return hasPersistentDatabase() ? Boolean(await getPersistentAgentById(id)) : Boolean(getAgentById(id));
}

async function resolveAgentId(input: { requestedId?: string; name: string }) {
  const requestedId = input.requestedId?.trim();

  if (requestedId) {
    return {
      id: requestedId,
      generated: false,
    };
  }

  const base = slugifyAgentId(input.name);
  let candidate = base;
  let suffix = 2;

  while (await agentIdExists(candidate)) {
    const suffixText = `-${suffix}`;
    candidate = `${base.slice(0, Math.max(1, 50 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  return {
    id: candidate,
    generated: true,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = AgentRegisterSchema.parse(body);
    const resolvedId = await resolveAgentId({ requestedId: data.id, name: data.name });

    // Check if agent ID already exists
    const existingAgent = hasPersistentDatabase()
      ? await getPersistentAgentById(resolvedId.id)
      : getAgentById(resolvedId.id);
    if (existingAgent) {
      return NextResponse.json(
        { error: resolvedId.generated ? 'Could not generate a unique agent ID' : 'Agent ID already taken' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = hasPersistentDatabase()
      ? await getPersistentAgentByEmail(data.email)
      : getAgentByEmail(data.email);
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Generate API key
    const apiKey = generateApiKey(resolvedId.id);

    // Create agent
    const agent = hasPersistentDatabase()
      ? await createPersistentAgent({
          ...data,
          id: resolvedId.id,
          api_key: apiKey,
        })
      : createAgent({
          ...data,
          id: resolvedId.id,
          api_key: apiKey,
        });

    // Return agent info with API key (only shown once)
    return NextResponse.json(
      {
        agent: {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          bio: agent.bio,
          role: agent.role,
          mission: agent.mission,
          avatar_url: agent.avatar_url,
        },
        api_key: apiKey,
        message: 'Agent registered successfully. Save your API key - it will not be shown again.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Agent registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

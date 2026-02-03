/**
 * Agent registration endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAgent, getAgentById, getAgentByEmail } from '@/lib/queries';
import { generateApiKey } from '@/lib/auth';
import { z } from 'zod';

const AgentRegisterSchema = z.object({
  id: z.string().min(3).max(50),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = AgentRegisterSchema.parse(body);

    // Check if agent ID already exists
    const existingAgent = getAgentById(data.id);
    if (existingAgent) {
      return NextResponse.json(
        { error: 'Agent ID already taken' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = getAgentByEmail(data.email);
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Generate API key
    const apiKey = generateApiKey(data.id);

    // Create agent
    const agent = createAgent({
      ...data,
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
          avatar_url: agent.avatar_url,
        },
        api_key: apiKey,
        message: 'Agent registered successfully. Save your API key - it will not be shown again.',
      },
      { status: 201 }
    );
  } catch (error: any) {
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

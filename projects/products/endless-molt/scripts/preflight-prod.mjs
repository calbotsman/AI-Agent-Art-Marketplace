#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const root = process.cwd();
const envLocal = path.join(root, '.env.local');
const envFile = path.join(root, '.env');

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile, override: false });
}
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal, override: true });
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PLACEHOLDER_RE =
  /(your_|YOUR_|placeholder|changeme|example|0x0000000000000000000000000000000000000000)/i;

const errors = [];
const warnings = [];

function required(name, validator, hint) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    errors.push(`${name} is missing (${hint}).`);
    return;
  }
  if (PLACEHOLDER_RE.test(value)) {
    errors.push(`${name} still looks like a placeholder (${hint}).`);
    return;
  }
  if (validator && !validator(value)) {
    errors.push(`${name} is invalid (${hint}).`);
  }
}

const enableWalletConnect = process.env.NEXT_PUBLIC_ENABLE_WALLETCONNECT === 'true';
const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (enableWalletConnect) {
  if (!walletConnectId || PLACEHOLDER_RE.test(walletConnectId) || walletConnectId.length < 16) {
    warnings.push(
      'NEXT_PUBLIC_ENABLE_WALLETCONNECT=true but NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing or invalid.',
    );
  }
}
required(
  'NEXT_PUBLIC_NFT_CONTRACT_MAINNET',
  (v) => ADDRESS_RE.test(v),
  'must be a 0x-prefixed Ethereum address',
);
required(
  'NEXT_PUBLIC_MARKETPLACE_CONTRACT_MAINNET',
  (v) => ADDRESS_RE.test(v),
  'must be a 0x-prefixed Ethereum address',
);
required(
  'NEXT_PUBLIC_AUCTION_CONTRACT_MAINNET',
  (v) => ADDRESS_RE.test(v),
  'must be a 0x-prefixed Ethereum address',
);

if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ORDERS_API === 'true') {
  warnings.push(
    'ENABLE_ORDERS_API=true in production enables the legacy mock checkout path. Keep it false unless fully secured.',
  );
}

if (!process.env.NEXTAUTH_SECRET || PLACEHOLDER_RE.test(process.env.NEXTAUTH_SECRET)) {
  warnings.push('NEXTAUTH_SECRET is missing or placeholder. Auth sessions may be unstable.');
}

const upstashUrl = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
const upstashToken = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
if ((upstashUrl && !upstashToken) || (!upstashUrl && upstashToken)) {
  warnings.push(
    'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together for distributed rate limiting.',
  );
}
if (!upstashUrl && !upstashToken) {
  warnings.push(
    'Distributed rate limiting is not configured (UPSTASH_REDIS_REST_URL/TOKEN). Falling back to in-memory limits.',
  );
}

if (errors.length === 0) {
  console.log('Preflight checks passed.');
} else {
  console.error('Preflight checks failed:');
  for (const message of errors) {
    console.error(`- ${message}`);
  }
}

if (warnings.length > 0) {
  console.warn('\nWarnings:');
  for (const message of warnings) {
    console.warn(`- ${message}`);
  }
}

process.exit(errors.length > 0 ? 1 : 0);

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, isAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { requireAdminToken } from '@/lib/auth';
import { applyRateLimitHeaders, checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const NFT_ABI = [
  'function whitelistAgent(address agent)',
] as const;

const FALLBACK_MAINNET_NFT = '0xCB775D441729eD900DCD8766F4ae130D8613bAe2' as const;

function getRpcUrl() {
  return (
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.RPC_URL ||
    ''
  );
}

function getOwnerKey() {
  const pk = process.env.OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '';
  return pk.startsWith('0x') ? pk : pk ? (`0x${pk}` as const) : '';
}

function getInviteCode() {
  return process.env.AGENT_WHITELIST_CODE || '';
}

function getNftAddress() {
  // Prefer explicit env var; otherwise use the known mainnet deployment address.
  const fromEnv =
    process.env.NEXT_PUBLIC_NFT_ADDRESS ||
    process.env.NFT_ADDRESS ||
    '';
  if (fromEnv) return fromEnv;

  return FALLBACK_MAINNET_NFT;
}

export async function POST(req: NextRequest) {
  const rateLimit = await checkRateLimit(req, {
    bucket: 'agent-whitelist',
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  try {
    // Hard gate: this route uses custodial keys. Only allow when explicitly enabled.
    if (process.env.SERVER_WHITELIST_ENABLED !== 'true') {
      return applyRateLimitHeaders(NextResponse.json({ error: 'Whitelisting is disabled' }, { status: 403 }), rateLimit.headers);
    }
    try {
      requireAdminToken(req);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unauthorized';
      return applyRateLimitHeaders(NextResponse.json({ error: message }, { status: 401 }), rateLimit.headers);
    }

    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      invite_code?: string;
    };

    const address = body.address || '';
    const inviteCode = body.invite_code || '';

    if (!isAddress(address)) {
      return applyRateLimitHeaders(NextResponse.json({ error: 'Invalid address' }, { status: 400 }), rateLimit.headers);
    }

    const expected = getInviteCode();
    if (!expected || inviteCode !== expected) {
      return applyRateLimitHeaders(NextResponse.json({ error: 'Invalid invite code' }, { status: 401 }), rateLimit.headers);
    }

    const rpcUrl = getRpcUrl();
    const ownerKey = getOwnerKey();
    const nftAddress = getNftAddress();

    if (!rpcUrl) return applyRateLimitHeaders(NextResponse.json({ error: 'Missing RPC URL (set ETH_MAINNET_RPC_URL)' }, { status: 500 }), rateLimit.headers);
    if (!ownerKey) return applyRateLimitHeaders(NextResponse.json({ error: 'Missing OWNER_PRIVATE_KEY' }, { status: 500 }), rateLimit.headers);
    if (!nftAddress || !isAddress(nftAddress)) {
      return applyRateLimitHeaders(NextResponse.json({ error: 'Missing NFT contract address' }, { status: 500 }), rateLimit.headers);
    }

    const account = privateKeyToAccount(ownerKey as `0x${string}`);
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ chain: mainnet, transport: http(rpcUrl), account });

    const { request } = await publicClient.simulateContract({
      address: nftAddress as `0x${string}`,
      abi: NFT_ABI,
      functionName: 'whitelistAgent',
      args: [address as `0x${string}`],
      account,
    });

    const hash = await walletClient.writeContract(request);
    return applyRateLimitHeaders(NextResponse.json({ ok: true, hash }), rateLimit.headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to whitelist';
    return applyRateLimitHeaders(
      NextResponse.json({ error: message }, { status: 500 }),
      rateLimit.headers,
    );
  }
}

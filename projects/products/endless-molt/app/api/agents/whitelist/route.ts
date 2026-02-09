import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, isAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const NFT_ABI = [
  'function whitelistAgent(address agent)',
] as const;

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
  // Prefer explicit env var; fall back to the repo's recorded mainnet deployment.
  const fromEnv =
    process.env.NEXT_PUBLIC_NFT_ADDRESS ||
    process.env.NFT_ADDRESS ||
    '';
  if (fromEnv) return fromEnv;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const deployments = require('../../../../deployments/mainnet.json') as { EndlessMoltNFT?: string };
    return deployments.EndlessMoltNFT || '';
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      invite_code?: string;
    };

    const address = body.address || '';
    const inviteCode = body.invite_code || '';

    if (!isAddress(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const expected = getInviteCode();
    if (!expected || inviteCode !== expected) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 401 });
    }

    const rpcUrl = getRpcUrl();
    const ownerKey = getOwnerKey();
    const nftAddress = getNftAddress();

    if (!rpcUrl) return NextResponse.json({ error: 'Missing RPC URL' }, { status: 500 });
    if (!ownerKey) return NextResponse.json({ error: 'Missing OWNER_PRIVATE_KEY' }, { status: 500 });
    if (!nftAddress || !isAddress(nftAddress)) return NextResponse.json({ error: 'Missing NFT contract address' }, { status: 500 });

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
    return NextResponse.json({ ok: true, hash });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to whitelist' }, { status: 500 });
  }
}

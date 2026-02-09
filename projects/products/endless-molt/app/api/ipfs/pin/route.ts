import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function pinataAuthHeaders() {
  // Support either JWT or API key/secret. Different Pinata UI versions surface different creds.
  const jwt = process.env.PINATA_JWT;
  if (jwt) {
    return { Authorization: `Bearer ${jwt}` } as Record<string, string>;
  }

  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;
  if (apiKey && apiSecret) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    } as Record<string, string>;
  }

  // Throw a helpful error for the operator.
  throw new Error('Missing PINATA_JWT (preferred) or PINATA_API_KEY + PINATA_API_SECRET');
}

async function pinFileToIpfs(args: { file: File; name?: string }) {
  const form = new FormData();
  form.append('file', args.file, args.name || args.file.name || 'asset');

  // Optional metadata
  if (args.name) {
    form.append('pinataMetadata', JSON.stringify({ name: args.name }));
  }

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      ...pinataAuthHeaders(),
    },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.details || data?.error || data?.message || `Pinata file pin failed (HTTP ${res.status})`);
  }

  const cid = data?.IpfsHash;
  if (!cid) throw new Error('Pinata did not return IpfsHash');
  return { cid, url: `ipfs://${cid}` };
}

async function pinJsonToIpfs(args: { json: any; name?: string }) {
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      ...pinataAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataMetadata: args.name ? { name: args.name } : undefined,
      pinataContent: args.json,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.details || data?.error || data?.message || `Pinata JSON pin failed (HTTP ${res.status})`);
  }

  const cid = data?.IpfsHash;
  if (!cid) throw new Error('Pinata did not return IpfsHash');
  return { cid, url: `ipfs://${cid}` };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const title = String(form.get('title') || '').trim();
    const description = String(form.get('description') || '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    }

    // 15MB is a pragmatic ceiling for serverless + pinning.
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
    }

    const image = await pinFileToIpfs({ file, name: title });

    const metadata = {
      name: title,
      description,
      image: image.url,
    };

    const meta = await pinJsonToIpfs({ json: metadata, name: `${title} (metadata)` });

    return NextResponse.json({
      ok: true,
      image: image.url,
      tokenUri: meta.url,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'IPFS pin failed' }, { status: 500 });
  }
}

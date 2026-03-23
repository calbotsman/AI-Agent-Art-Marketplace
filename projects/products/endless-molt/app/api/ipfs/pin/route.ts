import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getErrorMessage, getStringValue, isJsonRecord, readJsonRecord, type JsonRecord } from '@/lib/safe';
import { getArtworkSubmissionError, normalizeArtworkSubmission } from '@/lib/artwork-submission';

export const runtime = 'nodejs';
const INLINE_FALLBACK_MAX_BYTES = 64 * 1024;

function toGatewayUrl(ipfsUrl: string) {
  if (!ipfsUrl.startsWith('ipfs://')) return ipfsUrl;
  return `https://gateway.pinata.cloud/ipfs/${ipfsUrl.slice('ipfs://'.length)}`;
}

function hasPinataConfig() {
  return Boolean(process.env.PINATA_JWT || (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET));
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

async function fileToDataUrl(file: File) {
  const mimeType = file.type || 'application/octet-stream';
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

function jsonToDataUrl(value: Record<string, unknown>) {
  const bytes = Buffer.from(JSON.stringify(value));
  return `data:application/json;base64,${bytes.toString('base64')}`;
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

  const data = await readJsonRecord(res);
  if (!res.ok) {
    throw new Error(getPinataError(data, `Pinata file pin failed (HTTP ${res.status})`));
  }

  const cid = getStringValue(data, 'IpfsHash');
  if (!cid) throw new Error('Pinata did not return IpfsHash');
  return { cid, url: `ipfs://${cid}` };
}

async function pinJsonToIpfs(args: { json: Record<string, unknown>; name?: string }) {
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

  const data = await readJsonRecord(res);
  if (!res.ok) {
    throw new Error(getPinataError(data, `Pinata JSON pin failed (HTTP ${res.status})`));
  }

  const cid = getStringValue(data, 'IpfsHash');
  if (!cid) throw new Error('Pinata did not return IpfsHash');
  return { cid, url: `ipfs://${cid}` };
}

function getPinataError(data: JsonRecord | null, fallback: string) {
  const nestedError = data?.error;
  if (typeof nestedError === 'string') {
    return nestedError;
  }
  if (isJsonRecord(nestedError) && typeof nestedError.details === 'string') {
    return nestedError.details;
  }

  return getStringValue(data, 'message') || fallback;
}

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const { title, artistStatement } = normalizeArtworkSubmission({
      title: String(form.get('title') || ''),
      description: String(form.get('description') || ''),
      artistStatement: String(form.get('artist_statement') || ''),
    });

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const submissionError = getArtworkSubmissionError({ title, artistStatement });
    if (submissionError) {
      return NextResponse.json({ error: submissionError }, { status: 400 });
    }

    // 15MB is a pragmatic ceiling for serverless + pinning.
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
    }

    const metadata = {
      name: title,
      description: artistStatement,
      artist_statement: artistStatement,
    };
    let imageUrl = '';
    let tokenUri = '';
    let storage: 'pinata' | 'inline' = 'pinata';

    if (hasPinataConfig()) {
      const image = await pinFileToIpfs({ file, name: title });
      imageUrl = image.url;
      tokenUri = (await pinJsonToIpfs({
        json: {
          ...metadata,
          image: image.url,
        },
        name: `${title} (metadata)`,
      })).url;
    } else {
      if (file.size > INLINE_FALLBACK_MAX_BYTES) {
        return NextResponse.json(
          {
            error: `Pinata storage is offline and inline fallback only supports files up to ${Math.floor(
              INLINE_FALLBACK_MAX_BYTES / 1024
            )}KB.`,
          },
          { status: 503 }
        );
      }

      storage = 'inline';
      imageUrl = await fileToDataUrl(file);
      tokenUri = jsonToDataUrl({
        ...metadata,
        image: imageUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      storage,
      image: imageUrl,
      imageGateway: toGatewayUrl(imageUrl),
      tokenUri,
      tokenUriGateway: toGatewayUrl(tokenUri),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, 'IPFS pin failed') }, { status: 500 });
  }
});

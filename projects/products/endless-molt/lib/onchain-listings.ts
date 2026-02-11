import { ethers } from 'ethers';
import type { Listing } from '@/lib/types';

const NFT_READ_ABI = [
  'event NFTMinted(uint256 indexed tokenId, address indexed creator, address indexed to, string metadataURI)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function creatorOf(uint256 tokenId) view returns (address)',
] as const;

const CACHE_TTL_MS = 30_000;

type CachedListings = {
  at: number;
  listings: Listing[];
};

let cache: CachedListings | null = null;

function getRpcUrl() {
  return (
    process.env.MAINNET_RPC_URL ||
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.QUICKNODE_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    ''
  );
}

function getNftContractAddress() {
  return (
    process.env.NFT_CONTRACT_MAINNET ||
    process.env.NEXT_PUBLIC_NFT_CONTRACT_MAINNET ||
    '0xCB775D441729eD900DCD8766F4ae130D8613bAe2'
  );
}

function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function toIpfsGateway(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('ipfs://')) {
    const path = uri.replace(/^ipfs:\/\//, '');
    return `https://gateway.pinata.cloud/ipfs/${path}`;
  }
  return uri;
}

async function fetchJsonSafe(url: string): Promise<Record<string, any> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return (await response.json()) as Record<string, any>;
  } catch {
    return null;
  }
}

function parseStepTags(metadata: Record<string, any> | null): string[] {
  if (!metadata) return [];
  const attrs = Array.isArray(metadata.attributes) ? metadata.attributes : [];
  const tags = attrs
    .map((attr: any) => attr?.trait_type || attr?.value)
    .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
    .slice(0, 8);
  return tags;
}

function isImageUrl(value: string) {
  return /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(value);
}

async function buildListingFromMintEvent(
  event: ethers.EventLog,
  contract: ethers.Contract,
  provider: ethers.JsonRpcProvider,
): Promise<Listing | null> {
  try {
    const tokenId = event.args?.[0]?.toString();
    const creator = event.args?.[1] as string | undefined;
    const metadataUriRaw = (event.args?.[3] as string | undefined) || '';
    if (!tokenId) return null;

    const metadataUri = toIpfsGateway(metadataUriRaw);
    const metadata = await fetchJsonSafe(metadataUri);
    const imageFromMeta = metadata?.image ? toIpfsGateway(String(metadata.image)) : '';

    let tokenUriFromChain = metadataUri;
    if (!tokenUriFromChain) {
      try {
        tokenUriFromChain = toIpfsGateway((await contract.tokenURI(tokenId)) as string);
      } catch {
        tokenUriFromChain = '';
      }
    }

    const imageUrl = imageFromMeta || (isImageUrl(tokenUriFromChain) ? tokenUriFromChain : '');
    const title = String(metadata?.name || `Mainnet Piece #${tokenId}`);
    const description = metadata?.description ? String(metadata.description) : null;
    const tags = parseStepTags(metadata);

    let createdAt = new Date().toISOString();
    try {
      const block = await provider.getBlock(event.blockNumber);
      createdAt = new Date(Number(block?.timestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    } catch {
      // ignore block timestamp fetch failure
    }

    return {
      id: `onchain-${tokenId}`,
      agent_id: creator || 'onchain',
      title,
      description,
      price: 0,
      currency: 'ETH',
      image_url: imageUrl || '/placeholder/monochrome-type.svg',
      thumbnail_url: null,
      preview_url: null,
      tags: tags.length ? JSON.stringify(tags) : null,
      metadata: JSON.stringify({
        chain: 'ethereum-mainnet',
        token_id: tokenId,
        creator,
        tx_hash: event.transactionHash,
        contract_address: await contract.getAddress(),
        metadata_uri: metadataUriRaw || tokenUriFromChain || null,
      }),
      status: 'active',
      views: 0,
      featured: 0,
      created_at: createdAt,
      updated_at: createdAt,
    };
  } catch {
    return null;
  }
}

async function fetchMintEvents(contract: ethers.Contract, provider: ethers.JsonRpcProvider) {
  const current = await provider.getBlockNumber();
  const envStart = Number(process.env.MAINNET_NFT_START_BLOCK || '');
  const fromBlock = Number.isFinite(envStart) && envStart > 0 ? envStart : Math.max(0, current - 200_000);

  try {
    return (await contract.queryFilter(contract.filters.NFTMinted(), fromBlock, current)) as ethers.EventLog[];
  } catch {
    return [] as ethers.EventLog[];
  }
}

async function buildListingFromTokenRead(
  tokenId: number,
  contract: ethers.Contract,
  provider: ethers.JsonRpcProvider,
): Promise<Listing | null> {
  try {
    const tokenUriRaw = (await contract.tokenURI(tokenId)) as string;
    if (!tokenUriRaw) return null;

    const tokenUri = toIpfsGateway(tokenUriRaw);
    const metadata = await fetchJsonSafe(tokenUri);
    const imageFromMeta = metadata?.image ? toIpfsGateway(String(metadata.image)) : '';

    let owner = '';
    try {
      owner = (await contract.ownerOf(tokenId)) as string;
    } catch {
      owner = '';
    }

    let creator = '';
    try {
      creator = (await contract.creatorOf(tokenId)) as string;
    } catch {
      creator = owner;
    }

    const title = String(metadata?.name || `Mainnet Piece #${tokenId}`);
    const description = metadata?.description ? String(metadata.description) : null;
    const tags = parseStepTags(metadata);

    let createdAt = new Date().toISOString();
    try {
      const current = await provider.getBlockNumber();
      const block = await provider.getBlock(current);
      createdAt = new Date(Number(block?.timestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    } catch {
      // ignore block timestamp fetch failure
    }

    return {
      id: `onchain-${tokenId}`,
      agent_id: creator || 'onchain',
      title,
      description,
      price: 0,
      currency: 'ETH',
      image_url: imageFromMeta || '/placeholder/monochrome-type.svg',
      thumbnail_url: null,
      preview_url: null,
      tags: tags.length ? JSON.stringify(tags) : null,
      metadata: JSON.stringify({
        chain: 'ethereum-mainnet',
        token_id: String(tokenId),
        creator: creator || null,
        owner: owner || null,
        contract_address: await contract.getAddress(),
        metadata_uri: tokenUriRaw,
      }),
      status: 'active',
      views: 0,
      featured: 0,
      created_at: createdAt,
      updated_at: createdAt,
    };
  } catch {
    return null;
  }
}

async function readOnchainListings(limit = 50): Promise<Listing[]> {
  const configuredRpc = getRpcUrl();
  const rpcCandidates = [
    configuredRpc,
    'https://ethereum-rpc.publicnode.com',
    'https://cloudflare-eth.com',
  ].filter((url, index, arr) => !!url && arr.indexOf(url) === index) as string[];
  const contractAddress = getNftContractAddress();
  if (!isHexAddress(contractAddress)) return [];

  for (const rpcUrl of rpcCandidates) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, NFT_READ_ABI, provider);

      const events = await fetchMintEvents(contract, provider);
      if (events.length) {
        const newestFirst = [...events].sort((a, b) => b.blockNumber - a.blockNumber || b.index - a.index).slice(0, limit);
        const listings = await Promise.all(newestFirst.map((event) => buildListingFromMintEvent(event, contract, provider)));
        const filtered = listings.filter(Boolean) as Listing[];
        if (filtered.length > 0) {
          return filtered;
        }
      }

      // Fallback path for providers that struggle with log queries.
      let totalSupply = 0;
      try {
        totalSupply = Number(await contract.totalSupply());
      } catch {
        totalSupply = 0;
      }

      if (totalSupply > 0) {
        const start = Math.max(1, totalSupply - limit + 1);
        const tokenIds: number[] = [];
        for (let id = totalSupply; id >= start; id--) {
          tokenIds.push(id);
        }
        const listings = await Promise.all(tokenIds.map((tokenId) => buildListingFromTokenRead(tokenId, contract, provider)));
        const filtered = listings.filter(Boolean) as Listing[];
        if (filtered.length > 0) {
          return filtered;
        }
      }
    } catch {
      // Try next provider candidate.
      continue;
    }
  }

  return [];
}

export async function getOnchainListings(limit = 50): Promise<Listing[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.listings.slice(0, limit);
  }

  const listings = await readOnchainListings(limit);
  cache = { at: now, listings };
  return listings.slice(0, limit);
}

export async function getOnchainListingById(id: string): Promise<Listing | null> {
  const tokenId = id.startsWith('onchain-') ? id.replace(/^onchain-/, '') : '';
  if (!tokenId) return null;

  const listings = await getOnchainListings(200);
  return listings.find((listing) => listing.id === `onchain-${tokenId}`) || null;
}

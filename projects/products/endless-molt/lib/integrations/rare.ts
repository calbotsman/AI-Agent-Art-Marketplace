import { formatMicroEth, usdCentsToMicroEth } from '@/lib/pricing';
import { Listing } from '@/lib/types';

type RareChain = 'mainnet' | 'sepolia';
type RareCommandKind = 'bootstrap' | 'listing';

type ListingChainMetadata = {
  chain?: string | null;
  contract_address?: string | null;
  token_id?: string | number | null;
  token_uri?: string | null;
  mint_tx_hash?: string | null;
};

export interface RareBridgeCommand {
  id: string;
  label: string;
  note: string;
  command: string;
  kind: RareCommandKind;
}

export interface RareBridgePlan {
  listingId: string;
  listingTitle: string;
  listingUrl: string;
  chain: RareChain;
  docsUrl: string;
  packageUrl: string;
  configPath: string;
  requiresNode: string;
  actionableCount: number;
  warnings: string[];
  context: {
    chain: string | null;
    contractAddress: string | null;
    tokenId: string | null;
    tokenUri: string | null;
    mintTxHash: string | null;
    priceEth: string;
  };
  officialContracts: {
    mainnet: {
      factory: string;
      auction: string;
    };
    sepolia: {
      factory: string;
      auction: string;
    };
  };
  commands: RareBridgeCommand[];
}

const DEFAULT_SITE_URL = 'https://www.endlessmolt.xyz';
const RARE_DOCS_URL = 'https://rare.xyz/docs';
const RARE_PACKAGE_URL = 'https://www.npmjs.com/package/@rareprotocol/rare-cli';
const RARE_CONFIG_PATH = '~/.rare/config.json';
const RARE_NODE_REQUIREMENT = 'Node.js 22+';

const RARE_OFFICIAL_CONTRACTS = {
  mainnet: {
    factory: '0xAe8E375a268Ed6442bEaC66C6254d6De5AeD4aB1',
    auction: '0x6D7c44773C52D396F43c2D511B81aa168E9a7a42',
  },
  sepolia: {
    factory: '0x3c7526a0975156299ceef369b8ff3c01cc670523',
    auction: '0xC8Edc7049b233641ad3723D6C60019D1c8771612',
  },
} as const;

function shellQuote(value: string) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function normalizeString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function parseMetadata(raw: string | null): ListingChainMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ListingChainMetadata) : {};
  } catch {
    return {};
  }
}

function inferRareChain(rawChain: string | null, hasContractAddress: boolean): RareChain {
  const normalized = String(rawChain || '').toLowerCase();
  if (normalized.includes('sepolia')) return 'sepolia';
  if (normalized.includes('mainnet')) return 'mainnet';
  return hasContractAddress ? 'mainnet' : 'sepolia';
}

function listingPriceEth(listing: Listing): string {
  const isEth = String(listing.currency || '').toUpperCase() === 'ETH';
  const priceMicros = isEth ? listing.price : usdCentsToMicroEth(listing.price, 3000);
  return formatMicroEth(priceMicros);
}

function statusCommand(contractAddress: string, tokenId: string | null, chain: RareChain) {
  if (!tokenId) {
    return `rare status --contract ${contractAddress} --chain ${chain}`;
  }
  return `rare status --contract ${contractAddress} --token-id ${tokenId} --chain ${chain}`;
}

export function buildRareBridgePlan(listing: Listing, siteUrl = DEFAULT_SITE_URL): RareBridgePlan {
  const metadata = parseMetadata(listing.metadata);
  const contractAddress = normalizeString(metadata.contract_address);
  const tokenId = normalizeString(metadata.token_id);
  const tokenUri = normalizeString(metadata.token_uri);
  const mintTxHash = normalizeString(metadata.mint_tx_hash);
  const rawChain = normalizeString(metadata.chain);
  const chain = inferRareChain(rawChain, Boolean(contractAddress));
  const priceEth = listingPriceEth(listing);
  const listingUrl = `${siteUrl}/listings/${listing.id}`;

  const commands: RareBridgeCommand[] = [
    {
      id: 'install',
      label: 'Install Rare CLI',
      note: 'Official install command from Rare Protocol.',
      command: 'npm install -g @rareprotocol/rare-cli',
      kind: 'bootstrap',
    },
    {
      id: 'configure',
      label: `Configure ${chain}`,
      note: 'Use your own RPC. Rare stores keys in plaintext inside ~/.rare/config.json.',
      command: `rare configure --chain ${chain} --rpc-url https://your-rpc-endpoint.com`,
      kind: 'bootstrap',
    },
  ];

  if (contractAddress) {
    commands.push({
      id: 'import',
      label: 'Import Endless Molt collection',
      note: 'Registers the existing Endless Molt ERC-721 contract with Rare Protocol.',
      command: `rare import erc721 --contract ${contractAddress} --chain ${chain}`,
      kind: 'listing',
    });

    commands.push({
      id: 'status',
      label: 'Inspect on-chain status',
      note: 'Checks Rare-compatible contract and token state before transacting.',
      command: statusCommand(contractAddress, tokenId, chain),
      kind: 'listing',
    });
  }

  if (tokenUri) {
    commands.push({
      id: 'mirror-mint',
      label: 'Mirror this piece into Rare',
      note: 'Replace 0xYOUR_RARE_COLLECTION with a Rare-managed collection address if you want a parallel Rare mint.',
      command: [
        'rare mint \\',
        '  --contract 0xYOUR_RARE_COLLECTION \\',
        `  --token-uri ${shellQuote(tokenUri)} \\`,
        `  --chain ${chain}`,
      ].join('\n'),
      kind: 'listing',
    });
  }

  if (contractAddress && tokenId) {
    commands.push({
      id: 'auction-create',
      label: 'Create Rare auction',
      note: 'Uses the current Endless Molt listing price as the starting price and defaults to a 24h duration.',
      command: [
        'rare auction create \\',
        `  --contract ${contractAddress} \\`,
        `  --token-id ${tokenId} \\`,
        `  --starting-price ${priceEth} \\`,
        '  --duration 86400 \\',
        `  --chain ${chain}`,
      ].join('\n'),
      kind: 'listing',
    });

    commands.push({
      id: 'auction-status',
      label: 'Check Rare auction state',
      note: 'Useful before bidding, settling, or cancelling.',
      command: `rare auction status --contract ${contractAddress} --token-id ${tokenId} --chain ${chain}`,
      kind: 'listing',
    });
  }

  const warnings = [
    'Rare Protocol currently exposes deploy and auction flows on mainnet and sepolia only.',
    'Rare CLI requires Node.js 22+ and stores private keys in plaintext at ~/.rare/config.json.',
  ];

  if (!contractAddress) {
    warnings.push('This listing does not have an on-chain contract address yet, so import and auction commands are unavailable.');
  }

  if (!tokenUri) {
    warnings.push('This listing does not expose token_uri metadata yet, so Rare mirror-mint commands are unavailable.');
  }

  return {
    listingId: listing.id,
    listingTitle: listing.title,
    listingUrl,
    chain,
    docsUrl: RARE_DOCS_URL,
    packageUrl: RARE_PACKAGE_URL,
    configPath: RARE_CONFIG_PATH,
    requiresNode: RARE_NODE_REQUIREMENT,
    actionableCount: commands.filter((command) => command.kind === 'listing').length,
    warnings,
    context: {
      chain: rawChain,
      contractAddress,
      tokenId,
      tokenUri,
      mintTxHash,
      priceEth,
    },
    officialContracts: RARE_OFFICIAL_CONTRACTS,
    commands,
  };
}

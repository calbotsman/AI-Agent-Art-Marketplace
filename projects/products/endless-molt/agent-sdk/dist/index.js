"use strict";
/**
 * @endless-molt/agent-sdk
 * Self-acting NFT minting for Endless Molt agents.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndlessMolt = void 0;
exports.registerAgent = registerAgent;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const ethers_1 = require("ethers");
const DEFAULT_BASE_URL = 'https://www.endlessmolt.xyz';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NFT_CONTRACTS = {
    mainnet: '0x63464838F22630686b3EEC315442b4510aa4F440',
    sepolia: ZERO_ADDRESS,
};
const NFT_ABI = [
    'function mint(address to, string metadataURI, address creator) returns (uint256)',
    'event NFTMinted(uint256 indexed tokenId, address indexed creator, address indexed to, string metadataURI)',
];
const MIN_ARTWORK_TITLE_LENGTH = 3;
const MAX_ARTWORK_TITLE_LENGTH = 200;
const MIN_ARTIST_STATEMENT_LENGTH = 80;
const MAX_ARTIST_STATEMENT_LENGTH = 2000;
function slugifyAgentId(input) {
    const slug = input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
    return slug || `agent-${Math.random().toString(36).slice(2, 8)}`;
}
function trimTrailingSlash(value) {
    return value.replace(/\/+$/g, '');
}
function normalizePrivateKey(privateKey) {
    const trimmed = privateKey.trim();
    return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}
function parseAgentId(apiKey) {
    const candidate = apiKey.split(':')[0]?.trim();
    if (!candidate) {
        throw new Error('Agent API key must be in the form "agent_id:secret".');
    }
    return candidate;
}
function normalizeArtworkTitle(value) {
    return value.trim();
}
function normalizeArtistStatement(value) {
    return value.trim();
}
function resolveArtistStatement(options) {
    return normalizeArtistStatement(options.artistStatement || options.description || '');
}
function getArtworkSubmissionError(input) {
    const title = normalizeArtworkTitle(input.title);
    const artistStatement = normalizeArtistStatement(input.artistStatement);
    if (!title) {
        return 'Title is required before upload.';
    }
    if (title.length < MIN_ARTWORK_TITLE_LENGTH) {
        return `Title must be at least ${MIN_ARTWORK_TITLE_LENGTH} characters.`;
    }
    if (title.length > MAX_ARTWORK_TITLE_LENGTH) {
        return `Title must be ${MAX_ARTWORK_TITLE_LENGTH} characters or fewer.`;
    }
    if (!artistStatement) {
        return 'Artist statement is required before upload.';
    }
    if (artistStatement.length < MIN_ARTIST_STATEMENT_LENGTH) {
        return `Artist statement must be at least ${MIN_ARTIST_STATEMENT_LENGTH} characters.`;
    }
    if (artistStatement.length > MAX_ARTIST_STATEMENT_LENGTH) {
        return `Artist statement must be ${MAX_ARTIST_STATEMENT_LENGTH} characters or fewer.`;
    }
    return null;
}
function getExplorerBaseUrl(network) {
    return network === 'mainnet' ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
}
function getDefaultRpcUrl(network) {
    return network === 'mainnet' ? 'https://ethereum-rpc.publicnode.com' : 'https://rpc.sepolia.org';
}
function inferMimeType(filename) {
    const ext = node_path_1.default.extname(filename).toLowerCase();
    switch (ext) {
        case '.svg':
            return 'image/svg+xml';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.mp4':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        case '.glb':
            return 'model/gltf-binary';
        case '.html':
            return 'text/html';
        case '.json':
            return 'application/json';
        default:
            return 'application/octet-stream';
    }
}
async function parseResponseBody(response) {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return { error: text };
    }
}
function getResponseError(data, fallback) {
    const error = data?.error;
    if (typeof error === 'string' && error.trim())
        return error;
    const message = data?.message;
    if (typeof message === 'string' && message.trim())
        return message;
    return fallback;
}
function shouldRetryRegistrationWithExplicitId(data) {
    const details = data?.details;
    if (!Array.isArray(details))
        return false;
    return details.some((detail) => {
        if (!detail || typeof detail !== 'object')
            return false;
        const detailRecord = detail;
        const path = detailRecord.path;
        return Array.isArray(path) && path.length === 1 && path[0] === 'id';
    });
}
function buildMintRegistrationMessage(args) {
    return `Endless Molt register mint\nagent:${args.agentId.trim()}\nwallet:${args.walletAddress.trim().toLowerCase()}\ntx:${args.txHash
        .trim()
        .toLowerCase()}`;
}
async function loadArtwork(input) {
    if (input.imageFile) {
        if (typeof input.imageFile === 'string') {
            const filename = node_path_1.default.basename(input.imageFile);
            const bytes = await promises_1.default.readFile(input.imageFile);
            return {
                bytes,
                filename,
                contentType: inferMimeType(filename),
            };
        }
        return {
            bytes: Buffer.from(input.imageFile),
            filename: 'artwork',
            contentType: 'application/octet-stream',
        };
    }
    if (!input.imageUrl) {
        throw new Error('Provide imageFile or imageUrl. Endless Molt self-minting does not create a custodial placeholder for you.');
    }
    const res = await fetch(input.imageUrl);
    if (!res.ok) {
        throw new Error(`Failed to fetch artwork from ${input.imageUrl} (HTTP ${res.status})`);
    }
    const url = new URL(input.imageUrl);
    const filename = node_path_1.default.basename(url.pathname) || 'artwork';
    const bytes = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || inferMimeType(filename);
    return { bytes, filename, contentType };
}
async function registerAgent(input) {
    const baseUrl = trimTrailingSlash(input.baseUrl || DEFAULT_BASE_URL);
    const payload = {
        id: input.id?.trim() || undefined,
        name: input.name.trim(),
        email: input.email.trim(),
        bio: input.bio?.trim() || undefined,
        role: input.role,
        mission: input.mission.trim(),
        avatar_url: input.avatarUrl?.trim() || undefined,
    };
    let response = await fetch(`${baseUrl}/api/agents/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    let data = await parseResponseBody(response);
    if (!response.ok && !payload.id && shouldRetryRegistrationWithExplicitId(data)) {
        response = await fetch(`${baseUrl}/api/agents/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...payload,
                id: slugifyAgentId(input.name),
            }),
        });
        data = await parseResponseBody(response);
    }
    if (!response.ok) {
        throw new Error(getResponseError(data, `Agent registration failed (HTTP ${response.status})`));
    }
    const apiKey = typeof data?.api_key === 'string' ? data.api_key : '';
    const agent = typeof data?.agent === 'object' && data.agent ? data.agent : null;
    if (!apiKey || !agent) {
        throw new Error('Agent registration succeeded but no API key was returned.');
    }
    return { agent, apiKey };
}
class EndlessMolt {
    constructor(config) {
        this.apiKey = config.apiKey.trim();
        this.agentId = parseAgentId(this.apiKey);
        this.network = config.network || 'mainnet';
        this.baseUrl = trimTrailingSlash(config.baseUrl || DEFAULT_BASE_URL);
        const privateKey = normalizePrivateKey(config.privateKey);
        this.provider = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl || getDefaultRpcUrl(this.network));
        this.wallet = new ethers_1.ethers.Wallet(privateKey, this.provider);
        if (config.wallet) {
            const configuredWallet = ethers_1.ethers.getAddress(config.wallet);
            if (configuredWallet !== this.wallet.address) {
                throw new Error(`Configured wallet ${configuredWallet} does not match the supplied private key (${this.wallet.address}).`);
            }
        }
        const fallbackContract = NFT_CONTRACTS[this.network];
        const nftContract = config.nftContract || fallbackContract;
        this.nftContract = ethers_1.ethers.getAddress(nftContract);
        if (this.nftContract === ethers_1.ethers.getAddress(ZERO_ADDRESS)) {
            throw new Error(`No Endless Molt NFT contract is configured for ${this.network}. Provide nftContract explicitly.`);
        }
    }
    get address() {
        return this.wallet.address;
    }
    async getWalletStatus() {
        return {
            address: this.wallet.address,
            network: this.network,
            nftContract: this.nftContract,
            autonomous: true,
        };
    }
    async isVerified() {
        return true;
    }
    async uploadToIpfs(options) {
        const artwork = await loadArtwork(options);
        const title = normalizeArtworkTitle(options.title);
        const artistStatement = resolveArtistStatement(options);
        const submissionError = getArtworkSubmissionError({ title, artistStatement });
        if (submissionError) {
            throw new Error(submissionError);
        }
        const form = new FormData();
        const blobBytes = new Uint8Array(artwork.bytes);
        const blob = new Blob([blobBytes], { type: artwork.contentType });
        form.set('file', blob, artwork.filename);
        form.set('title', title);
        form.set('description', artistStatement);
        form.set('artist_statement', artistStatement);
        const response = await fetch(`${this.baseUrl}/api/ipfs/pin`, {
            method: 'POST',
            headers: {
                'X-API-Key': this.apiKey,
            },
            body: form,
        });
        const data = await parseResponseBody(response);
        if (!response.ok) {
            throw new Error(getResponseError(data, `IPFS upload failed (HTTP ${response.status})`));
        }
        const tokenUri = typeof data?.tokenUri === 'string' ? data.tokenUri : '';
        const imageUrl = typeof data?.image === 'string' ? data.image : '';
        const imageGatewayUrl = typeof data?.imageGateway === 'string' ? data.imageGateway : '';
        const storage = data?.storage === 'inline' ? 'inline' : 'pinata';
        if (!tokenUri || !imageUrl || !imageGatewayUrl) {
            throw new Error('IPFS upload succeeded but Endless Molt did not return the required token or image URLs.');
        }
        return {
            tokenUri,
            imageUrl,
            imageGatewayUrl,
            storage,
        };
    }
    async mint(options) {
        const title = normalizeArtworkTitle(options.title);
        const artistStatement = resolveArtistStatement(options);
        const submissionError = getArtworkSubmissionError({ title, artistStatement });
        if (submissionError) {
            throw new Error(submissionError);
        }
        const upload = await this.uploadToIpfs(options);
        const nft = new ethers_1.ethers.Contract(this.nftContract, NFT_ABI, this.wallet);
        const tx = await nft.mint(this.wallet.address, upload.tokenUri, this.wallet.address);
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
            throw new Error('Mint transaction did not confirm successfully.');
        }
        const iface = new ethers_1.ethers.Interface(NFT_ABI);
        let tokenId = '';
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed?.name === 'NFTMinted') {
                    tokenId = parsed.args[0].toString();
                    break;
                }
            }
            catch {
                // Ignore unrelated logs.
            }
        }
        if (!tokenId) {
            throw new Error('Mint confirmed but tokenId was not found in the NFTMinted event.');
        }
        const registrationMessage = buildMintRegistrationMessage({
            agentId: this.agentId,
            txHash: tx.hash,
            walletAddress: this.wallet.address,
        });
        const signature = await this.wallet.signMessage(registrationMessage);
        const registrationResponse = await fetch(`${this.baseUrl}/api/nfts/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
            },
            body: JSON.stringify({
                title,
                description: artistStatement,
                artist_statement: artistStatement,
                image_url: upload.imageGatewayUrl,
                price_eth: options.priceEth?.trim() || '0',
                tags: options.tags || options.traits?.map((trait) => `${trait.trait_type}:${String(trait.value)}`),
                tx_hash: tx.hash,
                wallet_address: this.wallet.address,
                signature,
            }),
        });
        const registrationData = await parseResponseBody(registrationResponse);
        if (!registrationResponse.ok) {
            throw new Error(getResponseError(registrationData, `Mint registration failed (HTTP ${registrationResponse.status})`));
        }
        const listingUrl = typeof registrationData?.listing_url === 'string' && registrationData.listing_url
            ? registrationData.listing_url
            : `${this.baseUrl}/listings/${tokenId}`;
        return {
            tokenId,
            txHash: tx.hash,
            tokenUri: upload.tokenUri,
            imageUrl: upload.imageUrl,
            imageGatewayUrl: upload.imageGatewayUrl,
            storage: upload.storage,
            etherscanUrl: `${getExplorerBaseUrl(this.network)}/tx/${tx.hash}`,
            galleryUrl: listingUrl,
            listingUrl,
        };
    }
    async mintAndList(options) {
        return this.mint(options);
    }
    async list() {
        throw new Error('Direct listing is disabled. Mint the work with EndlessMolt.mint(); the listing is created automatically.');
    }
    async createAuction() {
        throw new Error('Auctions are not live in the agent SDK yet.');
    }
    async getNFTs() {
        const response = await fetch(`${this.baseUrl}/api/agents/${this.agentId}`);
        const data = await parseResponseBody(response);
        if (!response.ok) {
            throw new Error(getResponseError(data, `Failed to fetch agent profile (HTTP ${response.status})`));
        }
        return Array.isArray(data?.listings) ? data.listings : [];
    }
}
exports.EndlessMolt = EndlessMolt;
exports.default = EndlessMolt;
//# sourceMappingURL=index.js.map
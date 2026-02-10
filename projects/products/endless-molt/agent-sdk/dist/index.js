"use strict";
/**
 * @endless-molt/agent-sdk
 * Simple SDK for AI agents to mint & sell NFTs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndlessMolt = void 0;
const ethers_1 = require("ethers");
// Contract addresses (updated after mainnet deployment)
const CONTRACTS = {
    mainnet: {
        nft: '0x0000000000000000000000000000000000000000', // Will update
        marketplace: '0x0000000000000000000000000000000000000000'
    },
    sepolia: {
        nft: '0xCB775D441729eD900DCD8766F4ae130D8613bAe2',
        marketplace: '0xD0834204Bde70B789d26DBA7B81591a793718B18'
    }
};
const NFT_ABI = [
    'function mint(address to, string metadataURI, address creator) returns (uint256)',
    'function verifiedAgents(address) view returns (bool)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function tokenURI(uint256 tokenId) view returns (string)'
];
const MARKETPLACE_ABI = [
    'function listToken(address nftContract, uint256 tokenId, uint256 price)',
    'function buyToken(bytes32 listingId) payable',
    'function listings(bytes32 listingId) view returns (tuple(address seller, address nftContract, uint256 tokenId, uint256 price, bool active))'
];
class EndlessMolt {
    constructor(config) {
        this.network = config.network || 'mainnet';
        // Setup provider
        const rpcUrl = config.rpcUrl || (this.network === 'mainnet'
            ? 'https://cloudflare-eth.com'
            : 'https://ethereum-sepolia-rpc.publicnode.com');
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
        // Setup wallet
        this.wallet = new ethers_1.ethers.Wallet(config.privateKey, this.provider);
        this.contracts = CONTRACTS[this.network];
        console.log(`🎨 EndlessMolt SDK initialized on ${this.network}`);
        console.log(`📡 Wallet: ${this.wallet.address}`);
    }
    /**
     * Check if the agent wallet is verified to mint
     */
    async isVerified() {
        const nft = new ethers_1.ethers.Contract(this.contracts.nft, NFT_ABI, this.provider);
        return await nft.verifiedAgents(this.wallet.address);
    }
    /**
     * Upload image to IPFS and create metadata
     */
    async createMetadata(options) {
        if (options.imageFile) {
            // Upload to IPFS (would need IPFS integration)
            throw new Error('File upload not implemented yet. Use imageUrl for now.');
        }
        if (!options.imageUrl) {
            // Create simple on-chain SVG
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
        <rect width="100%" height="100%" fill="#000"/>
        <text x="512" y="400" text-anchor="middle" fill="#fff" font-size="48">${options.title}</text>
        <text x="512" y="500" text-anchor="middle" fill="#666" font-size="24">by AI Agent</text>
      </svg>`;
            options.imageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        }
        const metadata = {
            name: options.title,
            description: options.description,
            image: options.imageUrl,
            attributes: options.traits || [
                { trait_type: 'Artist Type', value: 'AI Agent' },
                { trait_type: 'Network', value: this.network }
            ]
        };
        // Return base64 encoded JSON
        const encoded = Buffer.from(JSON.stringify(metadata)).toString('base64');
        return `data:application/json;base64,${encoded}`;
    }
    /**
     * Mint an NFT
     */
    async mint(options) {
        console.log(`🔨 Minting "${options.title}"...`);
        // Check verification
        const verified = await this.isVerified();
        if (!verified) {
            console.warn('⚠️  Wallet not verified. Minting may fail unless you are the contract owner.');
        }
        // Create metadata
        const metadataUri = await this.createMetadata(options);
        console.log(`📝 Metadata: ${metadataUri.slice(0, 100)}...`);
        // Mint NFT
        const nft = new ethers_1.ethers.Contract(this.contracts.nft, NFT_ABI, this.wallet);
        const tx = await nft.mint(this.wallet.address, // to
        metadataUri, // metadataURI
        this.wallet.address // creator
        );
        console.log(`✅ Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        // Extract token ID from events
        const mintEvent = receipt.logs.find((log) => {
            try {
                const parsed = nft.interface.parseLog(log);
                return parsed?.name === 'Transfer' && parsed.args.from === ethers_1.ethers.ZeroAddress;
            }
            catch {
                return false;
            }
        });
        let tokenId = '0';
        if (mintEvent) {
            const parsed = nft.interface.parseLog(mintEvent);
            tokenId = parsed?.args.tokenId.toString();
        }
        console.log(`🎉 Mint confirmed! Token ID: ${tokenId}`);
        const etherscanUrl = this.network === 'mainnet'
            ? `https://etherscan.io/token/${this.contracts.nft}?a=${tokenId}`
            : `https://sepolia.etherscan.io/token/${this.contracts.nft}?a=${tokenId}`;
        const galleryUrl = `https://endless-molt.vercel.app/listings/${tokenId}`;
        return {
            tokenId,
            txHash: tx.hash,
            etherscanUrl,
            galleryUrl
        };
    }
    /**
     * List an NFT for sale
     */
    async list(tokenId, priceEth) {
        console.log(`💰 Listing Token ID ${tokenId} for ${priceEth} ETH...`);
        const marketplace = new ethers_1.ethers.Contract(this.contracts.marketplace, MARKETPLACE_ABI, this.wallet);
        const priceWei = ethers_1.ethers.parseEther(priceEth);
        const tx = await marketplace.listToken(this.contracts.nft, tokenId, priceWei);
        console.log(`✅ Listing submitted: ${tx.hash}`);
        await tx.wait();
        console.log(`🛒 Listed successfully!`);
        return tx.hash;
    }
    /**
     * Mint and immediately list for sale
     */
    async mintAndList(options) {
        const { tokenId, txHash: mintHash } = await this.mint(options);
        const listingHash = await this.list(tokenId, options.price);
        return { tokenId, listingHash };
    }
    /**
     * Get wallet ETH balance
     */
    async getBalance() {
        const balance = await this.provider.getBalance(this.wallet.address);
        return ethers_1.ethers.formatEther(balance);
    }
}
exports.EndlessMolt = EndlessMolt;
// Export for convenience
exports.default = EndlessMolt;
//# sourceMappingURL=index.js.map
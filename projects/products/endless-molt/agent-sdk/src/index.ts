/**
 * @endless-molt/agent-sdk
 * Simple SDK for AI agents to mint & sell NFTs
 */

import { ethers } from 'ethers';
import axios from 'axios';

export interface MintOptions {
  title: string;
  description: string;
  imageUrl?: string;
  imageFile?: Buffer;
  price?: string; // ETH amount, e.g. "0.1"
  traits?: Array<{ trait_type: string; value: string }>;
}

export interface EndlessMoltConfig {
  privateKey: string;
  network?: 'mainnet' | 'sepolia';
  rpcUrl?: string;
}

export interface MintResult {
  tokenId: string;
  txHash: string;
  etherscanUrl: string;
  galleryUrl: string;
}

// Contract addresses (updated after mainnet deployment)
const CONTRACTS = {
  mainnet: {
    nft: '0xCB775D441729eD900DCD8766F4ae130D8613bAe2',
    marketplace: '0xD0834204Bde70B789d26DBA7B81591a793718B18'
  },
  sepolia: {
    nft: '0xCB775D441729eD900DCD8766F4ae130D8613bAe2',
    marketplace: '0xD0834204Bde70B789d26DBA7B81591a793718B18'
  }
};

const NFT_ABI = [
  'function mint(address to, string metadataURI, address creator) returns (uint256)',
  'function approve(address to, uint256 tokenId)',
  'function verifiedAgents(address) view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)'
];

const MARKETPLACE_ABI = [
  'function listNFT(address nftContract, uint256 tokenId, uint256 price) returns (bytes32)',
  'function buyNFT(bytes32 listingId) payable',
  'function getListing(bytes32 listingId) view returns (tuple(address seller, address nftContract, uint256 tokenId, uint256 price, bool active))',
  'event Listed(bytes32 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)',
  'event Sale(bytes32 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 platformFee, uint256 buyerFee, uint256 royaltyAmount)'
];

export class EndlessMolt {
  private wallet: ethers.Wallet;
  private provider: ethers.Provider;
  private network: 'mainnet' | 'sepolia';
  private contracts: typeof CONTRACTS.mainnet;

  constructor(config: EndlessMoltConfig) {
    this.network = config.network || 'mainnet';
    
    // Setup provider
    const rpcUrl = config.rpcUrl || (
      this.network === 'mainnet' 
        ? 'https://cloudflare-eth.com'
        : 'https://ethereum-sepolia-rpc.publicnode.com'
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Setup wallet
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.contracts = CONTRACTS[this.network];
    
    console.log(`🎨 EndlessMolt SDK initialized on ${this.network}`);
    console.log(`📡 Wallet: ${this.wallet.address}`);
  }

  /**
   * Check if the agent wallet is verified to mint
   */
  async isVerified(): Promise<boolean> {
    const nft = new ethers.Contract(this.contracts.nft, NFT_ABI, this.provider);
    return await nft.verifiedAgents(this.wallet.address);
  }

  /**
   * Upload image to IPFS and create metadata
   */
  private async createMetadata(options: MintOptions): Promise<string> {
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
  async mint(options: MintOptions): Promise<MintResult> {
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
    const nft = new ethers.Contract(this.contracts.nft, NFT_ABI, this.wallet);
    const tx = await nft.mint(
      this.wallet.address,  // to
      metadataUri,          // metadataURI
      this.wallet.address   // creator
    );

    console.log(`✅ Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();

    // Extract token ID from events
    const mintEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = nft.interface.parseLog(log);
        return parsed?.name === 'Transfer' && parsed.args.from === ethers.ZeroAddress;
      } catch { return false; }
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
  async list(tokenId: string, priceEth: string): Promise<{ txHash: string; listingId: string }> {
    console.log(`💰 Listing Token ID ${tokenId} for ${priceEth} ETH...`);

    const nft = new ethers.Contract(this.contracts.nft, NFT_ABI, this.wallet);
    const marketplace = new ethers.Contract(this.contracts.marketplace, MARKETPLACE_ABI, this.wallet);
    const priceWei = ethers.parseEther(priceEth);

    // Ensure marketplace is approved to transfer the token.
    console.log('🔓 Approving marketplace transfer...');
    const approveTx = await nft.approve(this.contracts.marketplace, tokenId);
    await approveTx.wait();

    const tx = await marketplace.listNFT(this.contracts.nft, tokenId, priceWei);
    console.log(`✅ Listing submitted: ${tx.hash}`);
    const receipt = await tx.wait();

    // Extract listingId from event.
    let listingId = '';
    try {
      const iface = new ethers.Interface(MARKETPLACE_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'Listed') {
            listingId = String(parsed.args[0]);
            break;
          }
        } catch {
          // ignore unrelated logs
        }
      }
    } catch {
      // ignore
    }

    if (!listingId) {
      throw new Error('Listing confirmed but listingId was not found in logs');
    }

    console.log(`🛒 Listed successfully! listingId=${listingId}`);
    return { txHash: tx.hash, listingId };
  }

  /**
   * Buy a listed NFT.
   */
  async buy(listingId: string): Promise<string> {
    console.log(`🧾 Buying listing ${listingId}...`);

    const marketplace = new ethers.Contract(this.contracts.marketplace, MARKETPLACE_ABI, this.wallet);
    const listing = await marketplace.getListing(listingId);
    const priceWei = listing?.price as bigint;
    if (!priceWei || priceWei <= 0n) {
      throw new Error('Listing price unavailable');
    }

    const tx = await marketplace.buyNFT(listingId, { value: priceWei });
    console.log(`✅ Purchase submitted: ${tx.hash}`);
    await tx.wait();
    console.log('🎉 Purchase confirmed.');
    return tx.hash;
  }

  /**
   * Mint and immediately list for sale
   */
  async mintAndList(options: MintOptions & { price: string }): Promise<{ tokenId: string; listingHash: string }> {
    const { tokenId, txHash: mintHash } = await this.mint(options);
    const { txHash: listingHash } = await this.list(tokenId, options.price);
    
    return { tokenId, listingHash };
  }

  /**
   * Get wallet ETH balance
   */
  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }
}

// Export for convenience
export default EndlessMolt;

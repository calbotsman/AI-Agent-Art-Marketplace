/**
 * Endless Molt Agent SDK
 * Dead simple NFT minting for AI agents
 */

import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, mainnet } from 'viem/chains';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

interface AgentConfig {
  apiKey: string;
  wallet: string;
  privateKey?: string;
  network?: 'sepolia' | 'mainnet';
  baseUrl?: string;
}

interface MintMetadata {
  title: string;
  description: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  autoList?: boolean;
  price?: string;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  supply: number;
  artwork: string | Buffer;
}

export class EndlessMoltAgent {
  private config: AgentConfig;
  private baseUrl: string;

  constructor(config: AgentConfig) {
    this.config = {
      network: 'sepolia',
      baseUrl: 'https://endlessmolt.xyz',
      ...config
    };
    this.baseUrl = this.config.baseUrl!;
  }

  /**
   * Mint an NFT from any file
   */
  async mint(
    file: string | Buffer,
    metadata: MintMetadata
  ): Promise<{
    tokenId: string;
    txHash: string;
    url: string;
    ipfsHash: string;
  }> {
    try {
      // 1. Upload to IPFS
      console.log('📤 Uploading to IPFS...');
      const ipfsHash = await this.uploadToIPFS(file, metadata);

      // 2. Mint NFT
      console.log('⛏️  Minting NFT...');
      const mintResult = await this.mintNFT(ipfsHash);

      // 3. Auto-list if requested
      if (metadata.autoList && metadata.price) {
        console.log('🏪 Listing on marketplace...');
        await this.list(mintResult.tokenId, { price: metadata.price });
      }

      console.log('✅ Success!');
      return mintResult;
    } catch (error: any) {
      console.error('❌ Mint failed:', error.message);
      throw error;
    }
  }

  /**
   * List NFT on marketplace
   */
  async list(
    tokenId: string,
    options: { price: string; currency?: string }
  ): Promise<{ listingId: string; url: string }> {
    const response = await fetch(`${this.baseUrl}/api/marketplace/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        tokenId,
        price: parseEther(options.price).toString(),
        currency: options.currency || 'ETH'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to list: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      listingId: data.listingId,
      url: `${this.baseUrl}/listings/${data.listingId}`
    };
  }

  /**
   * Create an auction
   */
  async createAuction(
    tokenId: string,
    options: {
      reservePrice: string;
      duration: number;
      buyNowPrice?: string;
    }
  ): Promise<{ auctionId: string; url: string }> {
    const response = await fetch(`${this.baseUrl}/api/auctions/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        tokenId,
        reservePrice: parseEther(options.reservePrice).toString(),
        duration: options.duration,
        buyNowPrice: options.buyNowPrice
          ? parseEther(options.buyNowPrice).toString()
          : undefined
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create auction: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      auctionId: data.auctionId,
      url: `${this.baseUrl}/auctions/${data.auctionId}`
    };
  }

  /**
   * Create ERC20 art token
   */
  async createToken(
    metadata: TokenMetadata
  ): Promise<{ address: string; txHash: string }> {
    // Upload artwork
    const ipfsHash = await this.uploadToIPFS(metadata.artwork, {
      title: metadata.name,
      description: `Limited edition art token: ${metadata.name}`
    });

    // Create token via smart contract
    const response = await fetch(`${this.baseUrl}/api/tokens/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        name: metadata.name,
        symbol: metadata.symbol,
        maxSupply: metadata.supply,
        artworkURI: `ipfs://${ipfsHash}`
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create token: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Get agent's NFTs
   */
  async getNFTs(): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${this.config.wallet}/nfts`,
      {
        headers: {
          'X-API-Key': this.config.apiKey
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get NFTs: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Get marketplace stats
   */
  async getStats(): Promise<{
    totalVolume: string;
    totalSales: number;
    floorPrice: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/stats`);
    return await response.json();
  }

  // Private methods

  private async uploadToIPFS(
    file: string | Buffer,
    metadata: Partial<MintMetadata>
  ): Promise<string> {
    const form = new FormData();

    // Add file
    if (typeof file === 'string') {
      form.append('file', fs.createReadStream(file), {
        filename: path.basename(file)
      });
    } else {
      form.append('file', file, { filename: 'artwork' });
    }

    // Add metadata
    form.append('metadata', JSON.stringify(metadata));

    const response = await fetch(`${this.baseUrl}/api/ipfs/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${await response.text()}`);
    }

    const data = await response.json();
    return data.ipfsHash;
  }

  private async mintNFT(ipfsHash: string): Promise<{
    tokenId: string;
    txHash: string;
    url: string;
    ipfsHash: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/nft/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        tokenURI: `ipfs://${ipfsHash}`,
        wallet: this.config.wallet
      })
    });

    if (!response.ok) {
      throw new Error(`Mint failed: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      tokenId: data.tokenId,
      txHash: data.txHash,
      url: `${this.baseUrl}/listings/${data.tokenId}`,
      ipfsHash
    };
  }
}

// Export for convenience
export default EndlessMoltAgent;

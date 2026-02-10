/**
 * @endless-molt/agent-sdk
 * Simple SDK for AI agents to mint & sell NFTs
 */
export interface MintOptions {
    title: string;
    description: string;
    imageUrl?: string;
    imageFile?: Buffer;
    price?: string;
    traits?: Array<{
        trait_type: string;
        value: string;
    }>;
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
export declare class EndlessMolt {
    private wallet;
    private provider;
    private network;
    private contracts;
    constructor(config: EndlessMoltConfig);
    /**
     * Check if the agent wallet is verified to mint
     */
    isVerified(): Promise<boolean>;
    /**
     * Upload image to IPFS and create metadata
     */
    private createMetadata;
    /**
     * Mint an NFT
     */
    mint(options: MintOptions): Promise<MintResult>;
    /**
     * List an NFT for sale
     */
    list(tokenId: string, priceEth: string): Promise<string>;
    /**
     * Mint and immediately list for sale
     */
    mintAndList(options: MintOptions & {
        price: string;
    }): Promise<{
        tokenId: string;
        listingHash: string;
    }>;
    /**
     * Get wallet ETH balance
     */
    getBalance(): Promise<string>;
}
export default EndlessMolt;
//# sourceMappingURL=index.d.ts.map
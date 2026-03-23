/**
 * @endless-molt/agent-sdk
 * Self-acting NFT minting for Endless Molt agents.
 */
export type AgentRole = 'artist' | 'curator' | 'critic' | 'patron';
export interface AgentRegisterOptions {
    id?: string;
    name: string;
    email: string;
    bio?: string;
    role: AgentRole;
    mission: string;
    avatarUrl?: string;
    baseUrl?: string;
}
export interface RegisteredAgent {
    agent: {
        id: string;
        name: string;
        email: string;
        bio?: string | null;
        role?: AgentRole | null;
        mission?: string | null;
        avatar_url?: string | null;
    };
    apiKey: string;
}
export interface Trait {
    trait_type: string;
    value: string | number;
}
export interface MintOptions {
    title: string;
    description: string;
    artistStatement?: string;
    imageUrl?: string;
    imageFile?: string | Buffer;
    priceEth?: string;
    tags?: string[];
    traits?: Trait[];
}
export interface UploadResult {
    tokenUri: string;
    imageUrl: string;
    imageGatewayUrl: string;
    storage: 'pinata' | 'inline';
}
export interface WalletStatus {
    address: string;
    network: 'mainnet' | 'sepolia';
    nftContract: string;
    autonomous: true;
}
export interface MintResult {
    tokenId: string;
    txHash: string;
    tokenUri: string;
    imageUrl: string;
    imageGatewayUrl: string;
    storage: 'pinata' | 'inline';
    etherscanUrl: string;
    galleryUrl: string;
    listingUrl: string;
}
export interface EndlessMoltConfig {
    apiKey: string;
    privateKey: string;
    wallet?: string;
    network?: 'mainnet' | 'sepolia';
    rpcUrl?: string;
    baseUrl?: string;
    nftContract?: string;
}
export declare function registerAgent(input: AgentRegisterOptions): Promise<RegisteredAgent>;
export declare class EndlessMolt {
    private readonly apiKey;
    private readonly agentId;
    private readonly wallet;
    private readonly provider;
    private readonly network;
    private readonly nftContract;
    private readonly baseUrl;
    constructor(config: EndlessMoltConfig);
    get address(): string;
    getWalletStatus(): Promise<WalletStatus>;
    isVerified(): Promise<boolean>;
    uploadToIpfs(options: Pick<MintOptions, 'title' | 'description' | 'artistStatement' | 'imageFile' | 'imageUrl'>): Promise<UploadResult>;
    mint(options: MintOptions): Promise<MintResult>;
    mintAndList(options: MintOptions): Promise<MintResult>;
    list(): Promise<never>;
    createAuction(): Promise<never>;
    getNFTs(): Promise<unknown[]>;
}
export default EndlessMolt;
//# sourceMappingURL=index.d.ts.map
/**
 * Type definitions for database models
 */

export type AgentRole = 'artist' | 'curator' | 'critic' | 'patron';
export type AgentPostType = 'status' | 'artwork' | 'announcement' | 'share';
export type AgentPostVisibility = 'public' | 'followers' | 'private';
export type AgentSignalType = 'endorse' | 'support' | 'cite';

export interface Agent {
  id: string;
  name: string;
  email: string | null;
  bio: string | null;
  role: AgentRole | null;
  mission: string | null;
  avatar_url: string | null;
  api_key_hash: string;
  status: 'active' | 'suspended' | 'deleted';
  reputation_score: number;
  total_sales: number;
  total_revenue: number;
  wallet_address?: string | null;
  total_volume?: number;
  nfts_minted?: number;
  nfts_sold?: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  name: string | null;
  provider: 'email' | 'google' | 'github';
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  // Stored as integer micro-ETH (1e-6 ETH) when `currency === 'ETH'`.
  // Legacy rows may still be USD cents; the UI converts to ETH-only for display.
  price: number;
  currency: string;
  image_url: string;
  thumbnail_url: string | null;
  preview_url: string | null;
  tags: string | null; // JSON array
  metadata: string | null; // JSON object
  status: 'active' | 'sold' | 'removed' | 'draft' | 'minted' | 'in_auction';
  sale_type?: 'fixed_price' | 'auction' | 'both';
  nft_id?: string | null;
  blockchain_listed?: number;
  list_tx_hash?: string | null;
  views: number;
  featured: number;
  created_at: string;
  updated_at: string;
}

export interface NFT {
  id: string;
  token_id: number;
  contract_address: string;
  listing_id: string | null;
  agent_id: string;
  owner_address: string;
  creator_address: string;
  metadata_uri: string;
  metadata_json: string | null;
  mint_tx_hash: string | null;
  mint_block: number | null;
  minted_at: string | null;
  royalty_percentage: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  agent_id: string;
  listing_id: string;
  amount: number;
  platform_fee: number;
  agent_payout: number;
  payment_intent_id: string | null;
  payment_status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'refunded';
  download_url: string | null;
  download_expires: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  order_id: string;
  user_id: string;
  agent_id: string;
  listing_id: string;
  rating: number;
  review: string | null;
  created_at: string;
}

export interface Favorite {
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface AgentPost {
  id: string;
  agent_id: string;
  content: string;
  media_urls: string | null;
  listing_id?: string | null;
  target_agent_id?: string | null;
  post_type: AgentPostType;
  visibility: AgentPostVisibility;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
}

export interface AgentSignal {
  id: string;
  agent_id: string;
  listing_id: string | null;
  target_agent_id: string | null;
  target_post_id: string | null;
  signal_type: AgentSignalType;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingEmbedding {
  listing_id: string;
  embedding: Buffer;
  model: string;
  created_at: string;
}

export interface ListingComment {
  id: string;
  listing_id: string;
  agent_id: string;
  content: string;
  created_at: string;
}

// View types
export interface AgentStats {
  id: string;
  name: string;
  reputation_score: number;
  listing_count: number;
  order_count: number;
  total_earnings: number;
  avg_rating: number;
  review_count: number;
}

export interface ListingStats {
  id: string;
  title: string;
  price: number;
  views: number;
  status: string;
  featured: number;
  purchase_count: number;
  favorite_count: number;
  avg_rating: number;
  review_count: number;
}

// API types
export interface CreateAgentInput {
  id: string;
  name: string;
  email: string;
  bio?: string;
  role: AgentRole;
  mission: string;
  avatar_url?: string;
  api_key: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  provider?: 'email' | 'google' | 'github';
}

export interface CreateListingInput {
  agent_id: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  image_url: string;
  thumbnail_url?: string;
  preview_url?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: 'active' | 'draft' | 'minted' | 'in_auction';
  sale_type?: 'fixed_price' | 'auction' | 'both';
  nft_id?: string;
  blockchain_listed?: number;
  list_tx_hash?: string | null;
}

export interface CreateMintedListingInput {
  agent_id: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  image_url: string;
  thumbnail_url?: string;
  preview_url?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  token_id: number;
  contract_address: string;
  owner_address: string;
  creator_address: string;
  metadata_uri: string;
  metadata_json?: Record<string, unknown>;
  mint_tx_hash: string;
  mint_block?: number;
  minted_at?: string;
}

export interface CreateOrderInput {
  user_id: string;
  listing_id: string;
  amount: number;
}

export interface CreateListingCommentInput {
  listing_id: string;
  agent_id: string;
  content: string;
}

export interface CreateAgentPostInput {
  agent_id: string;
  content: string;
  media_urls?: string[];
  listing_id?: string;
  target_agent_id?: string;
  post_type?: AgentPostType;
  visibility?: AgentPostVisibility;
}

export interface CreateAgentSignalInput {
  agent_id: string;
  listing_id?: string;
  target_agent_id?: string;
  target_post_id?: string;
  signal_type: AgentSignalType;
  note?: string;
}

export interface CreateRatingInput {
  order_id: string;
  user_id: string;
  agent_id: string;
  listing_id: string;
  rating: number;
  review?: string;
}

// Search and filter types
export interface ListingFilters {
  agent_id?: string;
  status?: string;
  min_price?: number;
  max_price?: number;
  tags?: string[];
  featured?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchQuery {
  q: string;
  filters?: ListingFilters;
}

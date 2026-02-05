/**
 * Type definitions for database models
 */

export interface Agent {
  id: string;
  name: string;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  api_key_hash: string;
  status: 'active' | 'suspended' | 'deleted';
  reputation_score: number;
  total_sales: number;
  total_revenue: number;
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
  price: number;
  currency: string;
  image_url: string;
  thumbnail_url: string | null;
  preview_url: string | null;
  tags: string | null; // JSON array
  metadata: string | null; // JSON object
  status: 'active' | 'sold' | 'removed' | 'draft';
  views: number;
  featured: number;
  created_at: string;
  updated_at: string;
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
  image_url: string;
  thumbnail_url?: string;
  preview_url?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  status?: 'active' | 'draft';
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

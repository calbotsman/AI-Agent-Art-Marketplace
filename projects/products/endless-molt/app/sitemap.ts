import type { MetadataRoute } from 'next';
import { getAllAgents, getListings } from '@/lib/queries';
import { query } from '@/lib/db';

const SITE_URL = 'https://www.endlessmolt.xyz';

// This route reads from SQLite, so keep it on the Node.js runtime.
export const runtime = 'nodejs';

// Recompute periodically (helps Vercel caching without hammering DB on every request).
export const revalidate = 3600; // 1 hour

function safeDate(value: string | undefined | null) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/listings`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/agents`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/moltbook`, lastModified: now, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${SITE_URL}/moltbook/feed.xml`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE_URL}/join`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    // Keep these bounded so sitemaps don't explode. When we outgrow this,
    // we should switch to paginated sitemap indexes.
    const agents = await getAllAgents(2000);
    const listings = await getListings({ limit: 2000 });
    const posts = ((await query(
      `SELECT id, updated_at
       FROM posts
       WHERE visibility = 'public'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [500, 0],
    )) || []) as Array<{ id: string; updated_at: string }>;

    const dynamic: MetadataRoute.Sitemap = [
      ...agents.map((agent) => ({
        url: `${SITE_URL}/agents/${agent.id}`,
        lastModified: safeDate(agent.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...listings.map((listing) => ({
        url: `${SITE_URL}/listings/${listing.id}`,
        lastModified: safeDate(listing.updated_at),
        changeFrequency: 'weekly' as const,
        priority: listing.featured === 1 ? 0.8 : 0.7,
      })),
      ...posts.map((post) => ({
        url: `${SITE_URL}/moltbook/posts/${post.id}`,
        lastModified: safeDate(post.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.4,
      })),
    ];

    return [...staticUrls, ...dynamic];
  } catch {
    // If DB is cold/misconfigured, never fail the sitemap route.
    return staticUrls;
  }
}

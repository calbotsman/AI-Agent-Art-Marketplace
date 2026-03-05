/**
 * MoltBook RSS feed.
 *
 * Goal: make MoltBook content subscribable + give crawlers fresh URLs.
 */

import { query } from '@/lib/db';

export const runtime = 'nodejs';

const SITE_URL = 'https://www.endlessmolt.xyz';

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateText(value: string, maxLen: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function safeDateRfc822(value: string | undefined | null) {
  if (!value) return new Date().toUTCString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

type FeedRow = {
  id: string;
  agent_id: string;
  content: string;
  media_urls: string | null;
  post_type: string;
  visibility: string;
  comment_count: number;
  created_at: string;
  updated_at: string;
  agent_name: string | null;
};

export async function GET() {
  let rows: FeedRow[] = [];
  try {
    rows = (await query(
      `SELECT f.*, a.name as agent_name
       FROM feed_activity f
       LEFT JOIN agents a ON a.id = f.agent_id
       WHERE f.visibility = 'public'
       ORDER BY f.created_at DESC
       LIMIT $1 OFFSET $2`,
      [50, 0],
    )) as FeedRow[];
  } catch {
    rows = [];
  }

  const now = new Date().toUTCString();
  const channelTitle = 'MoltBook (Endless Molt)';
  const channelLink = `${SITE_URL}/moltbook`;
  const channelDescription = 'MoltBook is the public logbook: agents post work, humans recruit them, collectors follow signal.';
  const selfLink = `${SITE_URL}/moltbook/feed.xml`;

  const itemsXml = rows
    .map((row) => {
      const snippet = truncateText(row.content || '', 72);
      const title = row.agent_name ? `${row.agent_name}: ${snippet || 'Post'}` : snippet || 'MoltBook post';
      const url = `${SITE_URL}/moltbook/posts/${row.id}`;
      const pubDate = safeDateRfc822(row.created_at);
      const description = truncateText(row.content || '', 5000);

      return [
        '<item>',
        `<title>${xmlEscape(title)}</title>`,
        `<link>${xmlEscape(url)}</link>`,
        `<guid isPermaLink="true">${xmlEscape(url)}</guid>`,
        `<pubDate>${xmlEscape(pubDate)}</pubDate>`,
        `<category>${xmlEscape(row.post_type || 'status')}</category>`,
        `<description>${xmlEscape(description)}</description>`,
        '</item>',
      ].join('');
    })
    .join('');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">` +
    `<channel>` +
    `<title>${xmlEscape(channelTitle)}</title>` +
    `<link>${xmlEscape(channelLink)}</link>` +
    `<description>${xmlEscape(channelDescription)}</description>` +
    `<atom:link href="${xmlEscape(selfLink)}" rel="self" type="application/rss+xml" />` +
    `<lastBuildDate>${xmlEscape(now)}</lastBuildDate>` +
    itemsXml +
    `</channel>` +
    `</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      // Cache at the edge but allow quick updates.
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}


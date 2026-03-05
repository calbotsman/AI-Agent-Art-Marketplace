# Search Console Setup (Manual)

This repo can ship `robots.txt` + `sitemap.xml`, but **search engines still need a manual one-time setup** to accelerate discovery.

## Google Search Console

1. Add property:
   - Preferred: **Domain property** for `endlessmolt.xyz` (covers all protocols/subdomains).
2. Verify ownership (DNS is the normal path).
3. Submit sitemap:
   - Sitemap URL: `https://www.endlessmolt.xyz/sitemap.xml`
4. After deploy, confirm:
   - `https://www.endlessmolt.xyz/robots.txt` is `200`
   - `https://www.endlessmolt.xyz/sitemap.xml` is `200`
5. If pages are stuck, use:
   - URL Inspection -> Request indexing for `/`, `/listings`, `/moltbook`

## Bing Webmaster Tools

1. Add site: `https://www.endlessmolt.xyz`
2. Verify ownership (DNS is typical).
3. Submit sitemap:
   - `https://www.endlessmolt.xyz/sitemap.xml`

## What To Watch

- Index coverage: errors like “Submitted URL not found (404)” usually means deploy didn’t include the routes.
- Soft 404 / low-quality signals: avoid indexing placeholder seed pages (we set `noindex`).
- Crawl budget: ensure internal links exist (footer + MoltBook permalinks help).


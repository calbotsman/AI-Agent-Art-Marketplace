# Cloudflare Pages Deployment Guide

## Quick Setup (5 minutes)

### Prerequisites
- GitHub repo: ✅ https://github.com/calbotsman/AI-Agent-Art-Marketplace
- Cloudflare account: Check 1Password for credentials

### Step 1: Prepare Next.js for Cloudflare Pages

No changes needed! Cloudflare Pages supports Next.js out of the box.

### Step 2: Connect to Cloudflare Pages

1. Go to: https://dash.cloudflare.com/
2. Navigate to "Workers & Pages" > "Create application" > "Pages"
3. Connect to GitHub
4. Select repository: `calbotsman/AI-Agent-Art-Marketplace`
5. Configure build settings:
   - Framework preset: `Next.js`
   - Build command: `npm run build`
   - Build output directory: `.next`
   - Root directory: `/projects/products/endless-molt`
   - Environment variables:
     ```
     NODE_VERSION=20
     ```

### Step 3: Deploy

Click "Save and Deploy" - first build takes ~3-5 minutes.

### Step 4: Custom Domain (Optional)

Once deployed, you can add custom domain:
1. Go to project settings > "Custom domains"
2. Add `endlessmolt.xyz` or subdomain
3. Cloudflare handles SSL automatically

## Build Configuration

Create `wrangler.toml` in project root (optional):

```toml
name = "endless-molt"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[build.upload]
format = "service-worker"
```

## Environment Variables

Add these in Cloudflare Pages dashboard:
- `NEXT_PUBLIC_CHAIN_ID` = `8453` (Base mainnet) or `84532` (Base Sepolia)
- `DATABASE_URL` = Your database connection string (if using external DB)

## Automatic Deployments

Every push to `main` or `marketplace-deploy` branch will trigger automatic deployment.

## Preview Deployments

Pull requests get preview URLs automatically.

## Monitoring

- Build logs: Cloudflare Pages dashboard
- Analytics: Included free
- Performance: Web Analytics in Cloudflare

## Alternative: GitHub Pages (Static Only)

If you prefer GitHub Pages for a static export:

1. Add to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  output: 'export',
  // ... rest of config
};
```

2. Create `.github/workflows/deploy.yml`
3. Limitations: No API routes, no dynamic features

**Recommendation: Use Cloudflare Pages for full Next.js support!**
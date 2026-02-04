# 🚨 CAL'S CRITICAL PRIORITY TASKS

**THESE MUST BE DONE FIRST - BEFORE NFT WORK**

---

## ✅ GitHub Status: WORKING
Already fixed and pushed successfully. You're good to commit/push.

---

## 🔴 PRIORITY 1: Cloudflare Setup (30-45 min)

### Credentials Location
1Password item: "Cloudflare"
- Account uses GitHub OAuth
- Email: calbotsman@proton.me

### Option A: Web UI (Recommended - Faster)
```bash
# 1. Get credentials from 1Password
op item get "Cloudflare" --format json

# 2. Open browser and login
open "https://dash.cloudflare.com/"
# Login with GitHub OAuth

# 3. Add Site
# - Click "Add a Site"
# - Enter: endlessmolt.xyz
# - Select Free plan
# - Cloudflare will give you 2 nameservers (SAVE THESE!)
# - Example:
#   ns1.cloudflare.com
#   ns2.cloudflare.com

# 4. Configure DNS (Quick Setup)
# - Add A record: @ -> [Your server IP or Vercel IP]
# - Add CNAME: www -> endlessmolt.xyz
# - Enable "Proxy" (orange cloud)

# 5. Copy the nameservers for GoDaddy step
```

### Option B: Wrangler CLI (If Web UI doesn't work)
```bash
# Already installed: wrangler

# Login (opens browser)
wrangler login

# This should work since Cloudflare uses GitHub OAuth
# Follow prompts to authorize
```

### What You Need to Save:
- Cloudflare nameservers (2 of them)
- Zone ID (from Cloudflare dashboard)
- Account ID (from Cloudflare dashboard)

**Send Telegram:** "✅ Cloudflare connected! Nameservers: [list]. Moving to GoDaddy..."

---

## 🔴 PRIORITY 2: GoDaddy Domain Setup (15-30 min)

### Credentials Location
1Password item: "GoDaddy"
- Username: calbotsman@proton.me
- Password: hvp6HAE.maw7xtm_ype

### Steps:

```bash
# 1. Get credentials from 1Password
op item get "GoDaddy" --format json

# 2. Login to GoDaddy
open "https://sso.godaddy.com/"
# Use credentials from 1Password

# 3. Navigate to Domain Management
# - Click "Domains"
# - Click "endlessmolt.xyz"
# - Click "DNS" or "Manage DNS"

# 4. Update Nameservers
# - Find "Nameservers" section
# - Click "Change"
# - Select "Custom"
# - Enter the 2 Cloudflare nameservers from above:
#   Nameserver 1: ns1.cloudflare.com (or whatever Cloudflare gave you)
#   Nameserver 2: ns2.cloudflare.com (or whatever Cloudflare gave you)
# - Click "Save"

# 5. Wait for DNS propagation (15-60 minutes)
```

### Verify It's Working:
```bash
# Check nameservers (wait 5-10 min after changing)
dig endlessmolt.xyz NS

# Should show Cloudflare nameservers
# If still shows GoDaddy NS, wait longer (DNS propagation)

# Check if domain resolves
dig endlessmolt.xyz

# Test in browser (after DNS propagates)
curl -I https://endlessmolt.xyz
```

**Send Telegram:** "✅ GoDaddy configured! Domain pointing to Cloudflare. DNS propagating (15-60 min)..."

---

## ✅ PRIORITY 3: Verify & Deploy NFT Marketplace

**Only after Cloudflare + GoDaddy are done!**

Then continue with NFT marketplace work (see CAL_NIGHT_SHIFT.md)

---

## 🚨 If You Get Stuck

### Cloudflare Issues:
- **Can't login with GitHub OAuth:** Try creating an API token instead
  - Dashboard → My Profile → API Tokens → Create Token
  - Use "Edit zone DNS" template
  - Save token to 1Password for future use

- **Domain not verifying:** This is normal, it verifies after nameservers update
  - Add the site first, get nameservers
  - Update GoDaddy with those nameservers
  - Verification happens automatically (can take an hour)

### GoDaddy Issues:
- **Can't find DNS settings:**
  - Go to: https://dcc.godaddy.com/domains
  - Click endlessmolt.xyz
  - Click "DNS" tab
  - Scroll to "Nameservers"

- **Custom nameservers disabled:**
  - Make sure domain is not locked
  - Make sure domain is not expired
  - Contact support if blocked

### DNS Not Propagating:
- This is NORMAL - takes 15-60 minutes (sometimes longer)
- Don't panic
- Continue with NFT work while waiting
- Check back every 30 minutes

---

## 📨 Telegram Updates Required

**When starting:**
"🌙 Cal here - Priority tasks: GitHub ✅ | Cloudflare [starting] | GoDaddy [pending]"

**After Cloudflare:**
"✅ Cloudflare connected! Nameservers: [list them]. Moving to GoDaddy..."

**After GoDaddy:**
"✅ GoDaddy configured! Domain pointing to Cloudflare nameservers. DNS propagating (15-60 min)..."

**After verification:**
"✅ DNS propagated! endlessmolt.xyz is live on Cloudflare! Starting NFT marketplace work..."

---

## 🎯 Success Criteria

### Must Complete Tonight:
- ✅ GitHub working (already done)
- ✅ Cloudflare has endlessmolt.xyz site added
- ✅ GoDaddy nameservers updated to Cloudflare
- ✅ DNS propagation started (verification can happen later)

### Nice to Have:
- ✅ DNS fully propagated
- ✅ Domain resolves to Cloudflare
- ✅ SSL certificate active

---

## ⏰ Time Estimate

- Cloudflare setup: 30-45 min
- GoDaddy nameserver update: 15-30 min
- DNS propagation: 15-60 min (wait time, not work time)

**Total active work: ~1 hour**
**Total wait time: +30 min average**

Then proceed to NFT marketplace testing/deployment.

---

## 📝 Document Everything

Create: `DEPLOYMENT_STATUS.md`

```markdown
# Deployment Status - Feb 3-4, 2026

## Infrastructure Setup
- [x] GitHub: Working
- [x] Cloudflare: Connected
  - Nameservers: [list]
  - Zone ID: [id]
- [x] GoDaddy: Nameservers updated
  - DNS propagation: [status]

## NFT Marketplace
- [ ] Smart contracts compiled
- [ ] Tests passing
- [ ] Deployed to Sepolia

## Issues
[Any issues encountered]

## Next Steps
[What's next]
```

---

**DO THESE FIRST! Then NFT work. 🚨**

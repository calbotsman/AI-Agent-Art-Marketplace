# URGENT INSTRUCTIONS FOR CAL - START NOW

**From:** Josh (via Claude Sonnet 4.5)
**To:** Cal
**Time:** Feb 3, 2026 @ 5:40 PM
**Priority:** URGENT - Josh is stepping away

## 🚨 IMMEDIATE TASKS (Do Now While Josh is Away)

### Task #0: GitHub, Cloudflare, and GoDaddy Setup

Josh needs these connected ASAP. All credentials are in 1Password.

### Step-by-Step Instructions:

#### 1. Test GitHub Push (Verify it works)
```bash
cd ~/clawd
git status
git push origin night-sprint-agent-selector

# If it works, send Telegram:
# "✅ GitHub push working! Moving to Cloudflare..."
```

#### 2. Get Cloudflare Credentials from 1Password
```bash
# Use the 1password skill
op signin  # Should already be signed in
op item list | grep -i "cloudflare\|endless\|molt"

# Get the Cloudflare API token
op item get "Cloudflare" --fields label=api_token

# Or search for it
op item list --categories "API Credential"

# Get account details
op item get "Cloudflare" --format json
```

**What you need:**
- Cloudflare API Token
- Cloudflare Account ID
- Zone ID (if exists)

#### 3. Connect Cloudflare to endlessmolt.xyz

**Option A: Via Cloudflare CLI**
```bash
# Install if needed
npm install -g wrangler

# Login with API token from 1Password
wrangler login

# Add zone
# Follow Cloudflare docs
```

**Option B: Via Web UI** (if CLI doesn't work)
- Go to https://dash.cloudflare.com/
- Add site: endlessmolt.xyz
- Copy the nameservers Cloudflare gives you
- You'll need these for GoDaddy

**Send Telegram:** "✅ Cloudflare connected! Got nameservers: [list them]. Moving to GoDaddy..."

#### 4. Get GoDaddy Credentials from 1Password
```bash
# Find GoDaddy credentials
op item list | grep -i "godaddy\|domain"
op item get "GoDaddy" --format json

# Get API key or login credentials
op item get "GoDaddy" --fields label=api_key
op item get "GoDaddy" --fields label=username,label=password
```

#### 5. Connect GoDaddy Domain to Cloudflare

**You need to:**
1. Point endlessmolt.xyz nameservers to Cloudflare nameservers
2. Or configure DNS records directly

**Via GoDaddy API:**
```bash
# GoDaddy API docs: https://developer.godaddy.com/
# Update nameservers to Cloudflare's
```

**Via GoDaddy Web UI:**
- Login to GoDaddy (use credentials from 1Password)
- Go to DNS management for endlessmolt.xyz
- Update nameservers to Cloudflare's nameservers

**Send Telegram:** "✅ GoDaddy connected! Domain pointing to Cloudflare. DNS propagating..."

#### 6. Verify Setup
```bash
# Check DNS
dig endlessmolt.xyz

# Check if pointing to Cloudflare
nslookup endlessmolt.xyz

# Test once DNS propagates (may take 15 minutes)
curl https://endlessmolt.xyz
```

**Send Telegram:** "✅ ALL DONE! GitHub push works, Cloudflare connected, GoDaddy domain configured. endlessmolt.xyz is live (DNS propagating)!"

---

## 🎯 After Deployment Tasks (Then Do This)

Move to shopping cart implementation:

1. Read HANDOFF_TO_CAL.md
2. Use coding-agent skill to implement shopping cart
3. Create CartContext, CartButton, cart page
4. Test it works
5. Commit to GitHub
6. Send Telegram: "✅ Shopping cart done!"

---

## 📱 Telegram Messages to Send

**As you work:**
- "Starting deployment tasks now!"
- "✅ GitHub push verified"
- "✅ Cloudflare connected, nameservers: [list]"
- "✅ GoDaddy configured"
- "✅ ALL DONE! Everything connected. Moving to shopping cart..."

**Important:** Send a message for EACH completed step!

---

## 🔐 1Password Tips

### List all items:
```bash
op item list
```

### Search for specific items:
```bash
op item list | grep -i "cloudflare"
op item list | grep -i "godaddy"
op item list | grep -i "endless"
```

### Get specific fields:
```bash
op item get "Item Name" --fields label=username
op item get "Item Name" --fields label=password
op item get "Item Name" --fields label=api_key
```

### Get entire item as JSON:
```bash
op item get "Item Name" --format json
```

### If not signed in:
```bash
op signin
```

---

## 🆘 If You Get Stuck

1. **Can't find credentials in 1Password:**
   - Try: `op item list | grep -i "domain"`
   - Try: `op item list | grep -i "api"`
   - List all: `op item list`
   - Send Telegram: "Looking for [credential], found these items: [list]. Which one should I use?"

2. **GitHub push fails:**
   - Check: `git remote -v`
   - Try: `gh auth status`
   - Send Telegram: "GitHub push failed with error: [error]. Trying to fix..."

3. **Cloudflare/GoDaddy web UI needed:**
   - Send Telegram: "Need to use web UI for [service]. Here's what I need to do: [steps]. Can you help?"

4. **DNS not propagating:**
   - This is normal, takes 15-60 minutes
   - Send Telegram: "DNS configured, waiting for propagation (15-60 min). Moving to shopping cart while we wait..."

---

## ✅ Success Criteria

You're done when:
- ✅ GitHub push works
- ✅ Cloudflare account has endlessmolt.xyz
- ✅ GoDaddy domain points to Cloudflare
- ✅ Telegram message sent: "All done!"

Then move to shopping cart implementation.

---

## 🚀 START NOW

Cal, Josh is stepping away. Read this file and start working on Task #0 immediately. Use your 1password skill to get credentials. Send Telegram updates as you work. You've got this!

Run this to start:
```bash
openclaw agent --message "Josh stepped away. I'm starting Task #0 now: GitHub, Cloudflare, and GoDaddy setup. Reading INSTRUCTIONS_FOR_CAL_NOW.md. Will send Telegram updates. Starting with GitHub push test..."
```

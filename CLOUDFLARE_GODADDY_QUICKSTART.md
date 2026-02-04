# Cloudflare + GoDaddy Setup - 10 Minute Guide

**You're doing this manually (fastest option)**

---

## Step 1: Cloudflare (5 minutes)

### Login
1. Go to: https://dash.cloudflare.com/
2. Click "Log in with GitHub"
3. (You're already authenticated)

### Add Domain
1. Click "**+ Add a site**" (top right or left sidebar)
2. Enter domain: **endlessmolt.xyz**
3. Click "**Add site**"
4. Select "**Free**" plan
5. Click "**Continue**"

### Get Nameservers
Cloudflare will show you 2 nameservers. **COPY THESE!**

Example (yours will be different):
```
lily.ns.cloudflare.com
reza.ns.cloudflare.com
```

**Write them down or keep the page open.**

### Quick DNS Setup (Optional - can do later)
- You'll see DNS records page
- For now, just click "**Continue**" (skip DNS for now)
- We'll configure DNS after domain is connected

---

## Step 2: GoDaddy (2 minutes)

### Login
1. Go to: https://dcc.godaddy.com/domains
2. Login with:
   - Email: calbotsman@proton.me
   - Password: (get from 1Password: `op item get "GoDaddy" --fields password`)

### Update Nameservers
1. Find **endlessmolt.xyz** in your domain list
2. Click the domain name
3. Click "**DNS**" tab (or "**Manage DNS**")
4. Scroll down to "**Nameservers**" section
5. Click "**Change**" or "**Edit**"
6. Select "**I'll use my own nameservers**" or "**Custom**"
7. Enter the 2 Cloudflare nameservers you copied:
   ```
   Nameserver 1: lily.ns.cloudflare.com
   Nameserver 2: reza.ns.cloudflare.com
   ```
   (Use your actual nameservers from Cloudflare!)
8. Click "**Save**"

---

## Step 3: Verify (Wait 15-60 minutes)

### Check DNS Propagation
```bash
# Check nameservers (run this in terminal)
dig endlessmolt.xyz NS

# Should show Cloudflare nameservers after propagation
```

### What to Expect:
- **First 15 min:** Probably still shows GoDaddy nameservers
- **After 30 min:** Should show Cloudflare nameservers
- **After 60 min:** Definitely should be updated

### Test Domain
```bash
# Once DNS propagates
curl -I https://endlessmolt.xyz
```

---

## ✅ You're Done!

**What happens next:**
- DNS propagates (automatic, 15-60 min)
- Cloudflare verifies domain ownership (automatic)
- Domain is live on Cloudflare
- SSL certificate auto-generates (24 hours)

**Cal can now:**
- Focus on NFT marketplace testing
- Deploy smart contracts to testnet
- Continue Phase 2 development

---

## 🚨 Troubleshooting

**Cloudflare says "Domain already exists":**
- Someone else might have added it
- Check your Cloudflare accounts (maybe already added?)
- Try removing and re-adding

**GoDaddy won't save nameservers:**
- Check domain isn't locked
- Check domain hasn't expired
- Try logging out and back in

**DNS not propagating after 2 hours:**
- This is rare but possible
- Check you entered nameservers correctly (no typos)
- Check GoDaddy saved the changes (go back and verify)

---

## 📨 Send Cal a Message

Once done, let Cal know:
"✅ Cloudflare + GoDaddy setup complete. Nameservers updated. Cal can focus on NFT work."

Or just let Cal check DNS status autonomously.

---

**Total time: ~10 minutes + wait time for DNS**

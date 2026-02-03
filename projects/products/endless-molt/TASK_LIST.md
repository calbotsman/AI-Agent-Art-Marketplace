# Endless Molt Task List

**Last Updated:** 2026-02-03 5:40 PM
**Owner:** Cal (Autonomous Agent)

## 🔥 URGENT - Deploy & Connect (Do First!)

### [ ] #0 - GitHub, Cloudflare, and GoDaddy Setup
- **Assigned to:** Cal (Main Agent)
- **Status:** NOT STARTED - START NOW
- **Estimated:** 2 hours
- **Blocked by:** None
- **PRIORITY:** HIGHEST - Josh is stepping away, get this done first!

**What to do:**
1. **Test GitHub Push**
   - Make a test commit to verify push works
   - Command: `git push origin night-sprint-agent-selector`

2. **Get Cloudflare Credentials from 1Password**
   - Use 1password skill: `op read "Cloudflare API Token"` or similar
   - Search 1Password for "Cloudflare" or "endless" or "molt"
   - Get API token and account details

3. **Connect Cloudflare**
   - Set up Cloudflare for endlessmolt.xyz
   - Configure DNS settings
   - Enable SSL/TLS
   - Documentation: Use web or API

4. **Get GoDaddy Credentials from 1Password**
   - Use 1password skill to find GoDaddy credentials
   - Search for "GoDaddy" or domain credentials

5. **Connect GoDaddy Domain**
   - Point endlessmolt.xyz nameservers to Cloudflare
   - Or configure DNS records directly

6. **Send Telegram When Complete**
   - Message: "✅ All done! GitHub, Cloudflare, and GoDaddy connected. endlessmolt.xyz is live!"

**Resources:**
- All credentials in 1Password
- Use `op` CLI (1password skill)
- GitHub: Already authenticated
- Cloudflare: https://dash.cloudflare.com/
- GoDaddy: Domain management

**IMPORTANT:** Send Telegram message when each step completes AND when all done!

---

## 🔥 High Priority (After Deployment)

### [ ] #1 - Shopping Cart Implementation
- **Assigned to:** Builder Agent
- **Status:** Not Started
- **Estimated:** 4 hours
- **Blocked by:** #0
- **Description:** Implement full shopping cart with:
  - CartContext with localStorage
  - CartButton component with badge
  - Cart page with checkout flow
  - Add/remove item functionality
- **Files to create:**
  - `lib/cart-context.tsx`
  - `components/CartButton.tsx`
  - `components/CartItem.tsx`
  - `app/cart/page.tsx`
- **Reference:** See HANDOFF_TO_CAL.md Section "Shopping Cart"
- **TELEGRAM:** Send message when complete: "✅ Shopping cart done!"

### [ ] #2 - User Authentication UI
- **Assigned to:** Builder Agent
- **Status:** Not Started
- **Estimated:** 3 hours
- **Blocked by:** #1
- **Description:** Complete NextAuth.js setup:
  - Fix NextAuth.js configuration
  - Create signin page
  - Create signup page
  - Add SessionProvider to layout
- **Files to create/edit:**
  - `app/api/auth/[...nextauth]/route.ts` (fix)
  - `app/auth/signin/page.tsx`
  - `app/auth/signup/page.tsx`
  - `app/layout.tsx` (add SessionProvider)
- **Reference:** See HANDOFF_TO_CAL.md Section "User Authentication UI"
- **TELEGRAM:** Send message when complete: "✅ User auth done!"

## 🎯 Medium Priority

### [ ] #3 - Admin Dashboard
- **Assigned to:** Builder Agent
- **Status:** Not Started
- **Estimated:** 4 hours
- **Blocked by:** #1, #2
- **Description:** Create admin dashboard
- **TELEGRAM:** Send message when complete: "✅ Admin dashboard done!"

### [ ] #4 - Image Upload Integration
- **Assigned to:** Builder Agent
- **Status:** Not Started
- **Estimated:** 2 hours
- **Blocked by:** None
- **TELEGRAM:** Send message when complete: "✅ Image upload done!"

## 📌 Low Priority

### [ ] #5 - Final QA Testing
- **Assigned to:** QA Agent
- **Status:** Not Started
- **Estimated:** 2 hours
- **Blocked by:** #1, #2, #3, #4
- **TELEGRAM:** Send message when complete: "✅ QA testing complete!"

### [ ] #6 - Performance Optimization
- **Assigned to:** Builder Agent
- **Status:** Not Started
- **Estimated:** 2 hours
- **Blocked by:** #5
- **TELEGRAM:** Send message when complete: "✅ Performance optimized!"

## ✅ Completed

### [x] #-1 - Phase 1 Foundation
- **Completed:** 2026-02-03
- **By:** Claude Sonnet 4.5 (via Claude Code)
- **What was done:**
  - Complete database schema (7 tables, FTS5 search)
  - 12+ API endpoints with authentication
  - Server-side rendered frontend (homepage, browse, detail, profiles)
  - Demo data seeded (2 agents, 4 listings, 2 buyers)
  - Production build verified
- **Commit:** 65b217d

---

## 📊 Progress Summary

- **Total Tasks:** 8
- **Completed:** 1 (12.5%)
- **In Progress:** 0
- **Not Started:** 7 (87.5%)
- **Estimated Time Remaining:** ~19 hours

## 🎯 IMMEDIATE NEXT ACTION

**Cal - START NOW:**
1. Read this task list
2. Work on #0 - GitHub, Cloudflare, GoDaddy setup
3. Use 1password skill to get credentials
4. Send Telegram updates as you complete each step
5. Send final "All done!" message when complete

Then move to #1 (Shopping Cart)

## 📝 Notes for Cal

- Josh is stepping away - work autonomously
- All credentials are in 1Password - use `op` CLI
- Send Telegram messages for each completed task
- GitHub is already authenticated (gh CLI working)
- Push to branch: night-sprint-agent-selector
- After deployment tasks, move to shopping cart

**REMEMBER:** Send Telegram message when EACH task completes and when ALL done!

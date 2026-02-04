# 🎨 DESIGN SYSTEM UPDATE - URGENT

**Updated:** 23:08 PM
**From:** Day shift
**Priority:** HIGH

---

## 🔄 Major Change: Exact Verse.Works CSS

User wants **EXACT verse.works styling**, not just "inspired by."

**I've updated `app/globals.css` with their precise CSS system.**

---

## ✅ What Changed

### New CSS System (From verse.works)

**Colors:**
- Background: `#fff` (light) / `#121212` (dark)
- Text: `#060606` (light) / `#fff` (dark)
- Secondary text: `rgba(0, 0, 0, 0.6)` (light) / `rgba(255, 255, 255, 0.7)` (dark)
- Surface: `#f7f7f7` (light) / `#1c1c1c` (dark)
- Accent blue: `#3c4b9a`

**Typography (VERY LIGHT WEIGHTS):**
```css
h1: 300 6rem/1.167 (font-weight 300!)
h2: 300 3.75rem/1.2 (font-weight 300!)
h3: 400 3rem/1.167
h4: 400 2.125rem/1.235
h5: 400 1.5rem/1.334
h6: 500 1.25rem/1.6
body: 400 1rem/1.5
```

**Spacing:**
- Base unit: `8px`
- Use multiples: `--spacing-xs` (8px), `--spacing-sm` (16px), `--spacing-md` (24px), `--spacing-lg` (32px)

**Shadows:**
- Single shadow: `0 5px 10px rgb(6 6 6 / 0.1)`

---

## 🎯 How to Use It

### In Components:

**Old way (DON'T USE):**
```tsx
<h1 className="text-6xl font-bold">Title</h1>
<div className="bg-primary">...</div>
```

**New way (USE THIS):**
```tsx
<h1>Title</h1> {/* CSS already applied via globals.css */}
<div className="bg-surface">...</div> {/* Use CSS variables */}
```

### Available CSS Variables:

**Colors:**
- `var(--background)`
- `var(--foreground)`
- `var(--text-primary)`
- `var(--text-secondary)`
- `var(--surface)`
- `var(--border)`
- `var(--accent-blue)`

**Spacing:**
- `var(--spacing-xs)` → 8px
- `var(--spacing-sm)` → 16px
- `var(--spacing-md)` → 24px
- `var(--spacing-lg)` → 32px
- `var(--spacing-xl)` → 48px
- `var(--spacing-2xl)` → 64px

**Typography (use directly):**
- `<h1>` → automatically styled (300 weight, 6rem)
- `<h2>` → automatically styled (300 weight, 3.75rem)
- No need for font-weight classes!

### Utility Classes (Now Available):

```css
.section → padding: 64px 0
.content-container → max-width: 1280px, centered
.button → verse.works button style
.card → verse.works card style
.divider → 1px border line
```

---

## 🚫 What NOT to Use Anymore

**Avoid:**
- ❌ `font-bold`, `font-semibold` → Use semantic HTML (`<h1>`, `<h2>`)
- ❌ `text-[color]` → Use CSS variables
- ❌ Hardcoded colors → Use CSS variables
- ❌ Random spacing → Use spacing system
- ❌ Custom shadows → Use `var(--shadow)`

---

## 🎨 Apply to All Components

### Homepage (app/page.tsx)

**Current:**
```tsx
<h1 className="text-6xl font-light">Where AI Creates Art</h1>
```

**Should be:**
```tsx
<h1>Where AI Creates Art</h1>
```

The CSS handles everything!

### Components to Update:

1. **Header.tsx**
   - Remove font-weight classes
   - Use CSS variables for colors
   - Apply `.button` class to buttons

2. **ListingCard.tsx**
   - Use `.card` class
   - Use `var(--shadow)`
   - Light font weights (300-400)

3. **FeaturedCarousel.tsx**
   - Use CSS variables
   - Light typography

4. **Footer.tsx**
   - Use `.divider` for borders
   - Text secondary color: `var(--text-secondary)`

---

## 📋 Your Action Items

1. **Update `app/page.tsx`:**
   - Remove all Tailwind font-weight classes
   - Use semantic HTML (h1, h2, p)
   - Apply CSS variables for colors

2. **Update all components:**
   - Header, ListingCard, FeaturedCarousel, Footer
   - Use utility classes (`.button`, `.card`, `.section`)
   - CSS variables for colors

3. **Test both themes:**
   - Light mode (default)
   - Dark mode (toggle)
   - Everything should look clean and minimal

4. **Commit when done:**
   ```bash
   git add app/globals.css app/page.tsx components/*.tsx
   git commit -m "feat: apply exact verse.works CSS system

   - Replicated verse.works typography (300/400 weights)
   - Applied spacing system (8px base)
   - Updated all components to use CSS variables
   - Removed Tailwind font classes
   - Light, minimal aesthetic matching verse.works"
   git push origin marketplace-deploy
   ```

---

## 🎯 Success Criteria

When done, the site should:
- ✅ Look EXACTLY like verse.works (typography, spacing, colors)
- ✅ Very light font weights (300 for h1/h2)
- ✅ Consistent 8px spacing
- ✅ Single shadow style
- ✅ Clean, minimal aesthetic
- ✅ Dark mode works perfectly

---

## 💡 Key Principles

**Verse.works aesthetic:**
1. **Lightness** - Font weights 300-400, generous whitespace
2. **Simplicity** - Minimal UI, no decorations
3. **Consistency** - 8px spacing grid, single shadow
4. **Typography-focused** - Let text breathe, big headings

---

**This is HIGH PRIORITY. Update design system across all components NOW.**

**Delete this file after reading and implementing.**

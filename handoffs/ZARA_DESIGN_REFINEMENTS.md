# Zara Gate – Design Refinements (prep for next render)

**Brand tone:** quiet‑luxury, city‑night calm. Minimal, restrained, soft contrast; emphasis on typography + negative space.

---

## 1) Typography System (specs + usage constraints)
**Pairing:**
- **Display serif:** *Canela* (or *Noe Display* as alt). If limited to open‑source, use *Cormorant Garamond*.
- **Text sans:** *Söhne* (or *Neue Haas Grotesk*). Open‑source alt: *Inter* / *Source Sans 3*.

**Weights (keep light):**
- Display: 300 / 400 only
- Text: 300 / 400 / 500 (avoid 600+)

**Type scale (px / line‑height / tracking):**
- **H1** 56 / 64 / ‑0.02em (Display 300)
- **H2** 40 / 48 / ‑0.01em (Display 300)
- **H3** 28 / 36 / 0 (Display 400)
- **Body‑L** 18 / 28 / 0 (Text 300)
- **Body** 16 / 24 / 0 (Text 300)
- **Small** 13 / 20 / 0.01em (Text 400)
- **Overline/Label** 11 / 16 / 0.12em, uppercase (Text 500)

**Usage constraints:**
- Headings are serif only; body/labels are sans only.
- No bold UI; emphasize with size, spacing, or color (not weight).
- Max line length: 56–64 chars for body.
- Maintain 4px baseline grid; vertical spacing increments of 8px.

---

## 2) Logo Geometry (construction + clear space)
**Concept:** Moon + gate/portal silhouette. Calm, architectural, slightly celestial.

**Geometry:**
- Base grid: **8×8** units.
- **Moon circle:** diameter **8u**, centered on grid.
- **Gate aperture:** rectangle **4u** wide × **5.5u** tall, centered; top corners radius **1u** (soft arch).
- **Gate inset:** bottom sits **1u** above circle baseline to create floating effect.
- **Stroke weight (if outlined):** **0.5u**; rounded cap.

**Proportions:**
- Aperture width = **0.5×** moon diameter.
- Aperture height = **0.69×** moon diameter.
- Arch radius = **0.125×** moon diameter.

**Clear space:**
- Minimum clear space = **1× gate width** on all sides.

**Lockup:**
- Wordmark set in Display serif; tracking ‑0.02em.
- Symbol height equals **cap‑height of wordmark × 1.25**.

---

## 3) Layout Tweaks (grid + spacing)
**Grid:** 12 columns, **72–80px** side margins on desktop, **24px** on mobile.

**Spacing:**
- Section padding: **96px** desktop / **64px** mobile.
- Component spacing: **24–32px** between content blocks.
- Button padding: **12px vertical / 20px horizontal**; radius **12px**.

**Alignment:**
- Keep hero text to **560–640px** width.
- Use left alignment for most content; center alignment only in hero.
- Avoid dense clusters: no more than **3 elements** per row unless muted.

**Visual tone:**
- Background: deep graphite (#0F1115) or soft off‑white (#F7F6F2).
- Accents: muted silver (#C8C7C2) + moonlight blue (#8FA6BF).
- Shadows: minimal, soft blur only; no hard outlines.

---

## 4) Deliverable checklist (per Zara rule)
- Typography specs (pairing, weights, scale, usage constraints)
- Logo geometry (grid, proportions, clear space)
- Layout system (grid, spacing, alignment)
- Palette with primary + accent + neutrals

Prepared for direct application in next render.
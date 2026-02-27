import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = '/Users/calbotsman/clawd/studio/PROJECTS/solvida/2026-02-20-design-session-01';
const srcDir = path.join(root, 'artifacts/designer/renders-src');
const outDir = path.join(root, 'artifacts/designer/renders');

const globalCss = `
  :root {
    --bg: #f6f3ee;
    --ink: #15171b;
    --soft-ink: #404552;
    --accent: #d89f3a;
    --border: rgba(21,23,27,0.14);
    --space-1: 8px;
    --space-2: 16px;
    --space-3: 24px;
    --space-4: 32px;
    --space-5: 48px;
    --space-6: 64px;
  }

  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: var(--bg);
    color: var(--ink);
    font-family: "Inter", "Source Sans 3", "Helvetica Neue", Arial, sans-serif;
  }

  h1, h2, h3 {
    font-family: "Cormorant Garamond", "Times New Roman", Georgia, serif;
    margin: 0;
    letter-spacing: -0.02em;
    line-height: 1.06;
    font-weight: 400;
  }

  p { margin: 0; }

  .grain {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      radial-gradient(circle at 18% 22%, rgba(255,255,255,0.55), transparent 42%),
      radial-gradient(circle at 84% 12%, rgba(255,255,255,0.25), transparent 32%),
      radial-gradient(circle at 50% 80%, rgba(0,0,0,0.03), transparent 55%);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    border: 1px solid var(--border);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink);
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(2px);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
`;

function pageDoc(title, width, height, bodyHtml, extraCss = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${width}, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>${globalCss}\n${extraCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function labelPage({ flavor, subtitle, topColor, bottomColor, accent, ingredients, claim }) {
  const extraCss = `
    .label {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      background: linear-gradient(180deg, ${topColor} 0%, ${topColor} 62%, ${bottomColor} 62%, ${bottomColor} 100%);
      overflow: hidden;
    }

    .label-inner {
      position: relative;
      z-index: 2;
      height: 100%;
      padding: 84px 86px 72px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: var(--space-4);
    }

    .row-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .wordmark {
      font-size: 30px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(21,23,27,0.84);
      font-family: "Inter", "Source Sans 3", sans-serif;
      font-weight: 500;
    }

    .hero {
      display: grid;
      align-content: center;
      gap: 20px;
      width: min(840px, 100%);
    }

    .flavor {
      font-size: clamp(104px, 12.5vw, 156px);
      line-height: 0.95;
      color: #111319;
    }

    .subtitle {
      font-size: 34px;
      line-height: 1.2;
      color: rgba(17,19,25,0.72);
      max-width: 730px;
      font-weight: 300;
    }

    .footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .ingredients {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      max-width: 700px;
    }

    .ingredients .chip {
      color: rgba(246,243,238,0.9);
      border-color: rgba(246,243,238,0.24);
      background: rgba(9,11,14,0.16);
      backdrop-filter: blur(3px);
    }

    .claim {
      font-size: 13px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(246,243,238,0.88);
      background: linear-gradient(180deg, color-mix(in oklab, ${accent} 85%, white 15%) 0%, ${accent} 100%);
      padding: 13px 18px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,0.1);
      white-space: nowrap;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }

    .arc {
      position: absolute;
      width: 72%;
      aspect-ratio: 1/1;
      border: 1px solid rgba(255,255,255,0.35);
      border-radius: 50%;
      right: -16%;
      top: -24%;
      z-index: 1;
    }

    .arc-2 {
      position: absolute;
      width: 66%;
      aspect-ratio: 1/1;
      border: 1px solid rgba(255,255,255,0.26);
      border-radius: 50%;
      right: -9%;
      top: -16%;
      z-index: 1;
    }
  `;

  const chips = ingredients.map((item) => `<span class="chip">${item}</span>`).join('');

  const body = `
  <main class="label">
    <div class="grain"></div>
    <div class="arc"></div>
    <div class="arc-2"></div>
    <section class="label-inner">
      <div class="row-top">
        <p class="wordmark">SOL VIDA</p>
        <span class="badge">Hydration + Glow</span>
      </div>
      <div class="hero">
        <h1 class="flavor">${flavor}</h1>
        <p class="subtitle">${subtitle}</p>
      </div>
      <div class="footer">
        <div class="ingredients">${chips}</div>
        <span class="claim">${claim}</span>
      </div>
    </section>
  </main>`;

  return { body, extraCss };
}

function igPostPage() {
  const extraCss = `
    .canvas {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      background: linear-gradient(180deg, #f8f4ec 0%, #f8f4ec 58%, #d4b180 58%, #ab8453 100%);
    }

    .wrap {
      position: relative;
      z-index: 2;
      height: 100%;
      padding: 78px 72px;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }

    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      font-size: 22px;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      font-weight: 500;
    }

    .headline {
      align-self: center;
      max-width: 880px;
      display: grid;
      gap: 18px;
    }

    .headline h1 {
      font-size: 124px;
      line-height: 0.92;
      color: #111319;
    }

    .headline p {
      font-size: 36px;
      line-height: 1.2;
      max-width: 760px;
      color: rgba(17,19,25,0.72);
      font-weight: 300;
    }

    .bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
    }

    .ingredients {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .ingredients .chip {
      color: rgba(246,243,238,0.92);
      border-color: rgba(246,243,238,0.28);
      background: rgba(10,12,15,0.12);
    }

    .cta {
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      border: 1px solid rgba(246,243,238,0.34);
      background: rgba(17,19,25,0.25);
      color: rgba(246,243,238,0.92);
      padding: 12px 18px;
      border-radius: 999px;
    }

    .orb {
      position: absolute;
      width: 560px;
      height: 560px;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 35%, rgba(255,255,255,0.62), rgba(255,255,255,0.12) 46%, transparent 72%);
      right: -160px;
      top: -110px;
    }
  `;

  const body = `
  <main class="canvas">
    <div class="orb"></div>
    <div class="grain"></div>
    <section class="wrap">
      <div class="top">
        <p class="brand">SOL VIDA</p>
        <span class="badge">Low Sugar</span>
      </div>
      <div class="headline">
        <h1>Citrus Glow</h1>
        <p>Clean flavor and steady hydration for daily momentum.</p>
      </div>
      <div class="bottom">
        <div class="ingredients">
          <span class="chip">Citrus</span>
          <span class="chip">Turmeric</span>
          <span class="chip">Sea Salt</span>
        </div>
        <span class="cta">Shop Sol Vida</span>
      </div>
    </section>
  </main>`;

  return { body, extraCss };
}

function landingHeroPage() {
  const extraCss = `
    .hero {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(circle at 84% -8%, rgba(255,255,255,0.42), transparent 48%),
        linear-gradient(180deg, #f4f1eb 0%, #f1ece3 100%);
    }

    .grid {
      position: relative;
      z-index: 2;
      height: 100%;
      display: grid;
      grid-template-columns: minmax(620px, 1.2fr) 1fr;
      gap: 52px;
      align-items: center;
      padding: 86px 92px;
    }

    .left {
      display: grid;
      gap: 26px;
      max-width: 680px;
    }

    .eyebrow {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: rgba(21,23,27,0.66);
    }

    .left h1 {
      font-size: 88px;
      line-height: 0.95;
      color: #13151a;
    }

    .sub {
      font-size: 28px;
      line-height: 1.25;
      color: rgba(21,23,27,0.72);
      max-width: 560px;
      font-weight: 300;
    }

    .cta-row {
      display: flex;
      gap: 14px;
      align-items: center;
      margin-top: 4px;
    }

    .btn {
      font-size: 13px;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      padding: 14px 20px;
      border-radius: 999px;
      border: 1px solid rgba(21,23,27,0.16);
    }

    .btn-primary {
      background: #15171b;
      color: #f4f1eb;
      border-color: #15171b;
    }

    .btn-secondary {
      background: rgba(255,255,255,0.65);
      color: #15171b;
    }

    .proof {
      display: grid;
      gap: 10px;
      margin-top: 8px;
    }

    .proof p {
      font-size: 15px;
      color: rgba(21,23,27,0.74);
      letter-spacing: 0.02em;
    }

    .right {
      height: 100%;
      min-height: 650px;
      display: grid;
      align-content: center;
      gap: 18px;
    }

    .pack {
      height: 178px;
      border-radius: 24px;
      border: 1px solid rgba(21,23,27,0.12);
      background: linear-gradient(180deg, #f8f4ec 0%, #f8f4ec 62%, #8e7d62 62%, #6f5c44 100%);
      padding: 20px 24px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      box-shadow: 0 18px 40px rgba(18, 18, 20, 0.09);
    }

    .pack .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: rgba(21,23,27,0.72);
    }

    .pack h3 {
      align-self: center;
      font-size: 54px;
      line-height: 0.94;
      color: #121419;
    }

    .pack .meta {
      font-size: 11px;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      color: rgba(244,241,235,0.86);
    }

    .shape {
      position: absolute;
      inset: auto -160px -200px auto;
      width: 620px;
      height: 620px;
      border-radius: 50%;
      border: 1px solid rgba(21,23,27,0.1);
    }
  `;

  const body = `
  <main class="hero">
    <div class="grain"></div>
    <div class="shape"></div>
    <section class="grid">
      <div class="left">
        <p class="eyebrow">SOL VIDA / QUIET SOLAR UTILITY</p>
        <h1>Calm energy, clearly made.</h1>
        <p class="sub">Flavor-forward hydration with low sugar and ingredient clarity designed for real daily routines.</p>
        <div class="cta-row">
          <button class="btn btn-primary">Shop Sol Vida</button>
          <button class="btn btn-secondary">View Ingredients</button>
        </div>
        <div class="proof">
          <p>Low sugar formulas with explicit ingredient hierarchy.</p>
          <p>System-first design across packaging, social, and web.</p>
        </div>
      </div>
      <div class="right">
        <article class="pack">
          <div class="row"><span>SOL VIDA</span><span>LOW SUGAR</span></div>
          <h3>Citrus Glow</h3>
          <p class="meta">Citrus / Turmeric / Sea Salt</p>
        </article>
        <article class="pack" style="background: linear-gradient(180deg, #f3edf0 0%, #f3edf0 62%, #7e6574 62%, #5f4a58 100%);">
          <div class="row"><span>SOL VIDA</span><span>LOW SUGAR</span></div>
          <h3>Berry Focus</h3>
          <p class="meta">Blueberry / Ginseng / Sea Salt</p>
        </article>
        <article class="pack" style="background: linear-gradient(180deg, #ecf4ef 0%, #ecf4ef 62%, #5c7a67 62%, #47604f 100%);">
          <div class="row"><span>SOL VIDA</span><span>LOW SUGAR</span></div>
          <h3>Mint Lift</h3>
          <p class="meta">Mint / Matcha / Sea Salt</p>
        </article>
      </div>
    </section>
  </main>`;

  return { body, extraCss };
}

const labelDefs = [
  {
    name: 'solvida-label-citrus-glow',
    width: 1200,
    height: 1800,
    data: {
      flavor: 'Citrus\\nGlow',
      subtitle: 'Clean flavor and steady hydration for daily momentum.',
      topColor: '#f7f3e8',
      bottomColor: '#7d6a4f',
      accent: '#d89f3a',
      ingredients: ['Citrus', 'Turmeric', 'Sea Salt'],
      claim: 'Low Sugar • 2g'
    }
  },
  {
    name: 'solvida-label-berry-focus',
    width: 1200,
    height: 1800,
    data: {
      flavor: 'Berry\\nFocus',
      subtitle: 'Balanced hydration support with a bright berry profile.',
      topColor: '#f4edf1',
      bottomColor: '#665266',
      accent: '#b26db6',
      ingredients: ['Blueberry', 'Ginseng', 'Sea Salt'],
      claim: 'Low Sugar • 2g'
    }
  },
  {
    name: 'solvida-label-mint-lift',
    width: 1200,
    height: 1800,
    data: {
      flavor: 'Mint\\nLift',
      subtitle: 'Cooling flavor with functional hydration and clean finish.',
      topColor: '#ecf4ef',
      bottomColor: '#4f6657',
      accent: '#5c9f7f',
      ingredients: ['Mint', 'Matcha', 'Sea Salt'],
      claim: 'Low Sugar • 2g'
    }
  }
];

const pages = [];

for (const def of labelDefs) {
  const { body, extraCss } = labelPage(def.data);
  pages.push({
    name: def.name,
    width: def.width,
    height: def.height,
    html: pageDoc(def.name, def.width, def.height, body, extraCss)
  });
}

const ig = igPostPage();
pages.push({
  name: 'solvida-ig-post-citrus-glow',
  width: 1080,
  height: 1350,
  html: pageDoc('solvida-ig-post-citrus-glow', 1080, 1350, ig.body, ig.extraCss)
});

const hero = landingHeroPage();
pages.push({
  name: 'solvida-landing-hero',
  width: 1600,
  height: 900,
  html: pageDoc('solvida-landing-hero', 1600, 900, hero.body, hero.extraCss)
});

await fs.mkdir(srcDir, { recursive: true });
await fs.mkdir(outDir, { recursive: true });

for (const page of pages) {
  await fs.writeFile(path.join(srcDir, `${page.name}.html`), page.html, 'utf8');
}

const browser = await chromium.launch({ headless: true });
for (const pageDef of pages) {
  const page = await browser.newPage({ viewport: { width: pageDef.width, height: pageDef.height }, deviceScaleFactor: 2 });
  const filePath = `file://${path.join(srcDir, `${pageDef.name}.html`)}`;
  await page.goto(filePath, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });
  await page.screenshot({ path: path.join(outDir, `${pageDef.name}.png`), fullPage: true });
  await page.close();
}
await browser.close();

console.log(`Rendered ${pages.length} PNG files to ${outDir}`);

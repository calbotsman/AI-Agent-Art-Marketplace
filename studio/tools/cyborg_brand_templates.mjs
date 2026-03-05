const DEFAULT_LOGO_FONT_FAMILIES = ['Cormorant Garamond', 'Inter'];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uniqueList(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const token = trimmed.toLowerCase();
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    out.push(trimmed);
  }
  return out;
}

export function buildGoogleFontsUrl(families = []) {
  const unique = uniqueList(families);
  if (!unique.length) {
    return '';
  }
  const encoded = unique
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@300;400;500;600;700;800;900`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${encoded}&display=swap`;
}

function logoVariantStyle(variant) {
  if (variant === 'stacked') {
    return {
      container: "logo-container stacked",
      scale: 0.86,
      weight: 700,
      spacing: '8px',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
    };
  }
  if (variant === 'minimal') {
    return {
      container: "logo-container minimal",
      scale: 0.72,
      weight: 400,
      spacing: '6px',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
    };
  }
  if (variant === 'badge') {
    return {
      container: "logo-container badge",
      scale: 0.65,
      weight: 700,
      spacing: '12px',
      letterSpacing: '0.03em',
      textTransform: 'none',
    };
  }
  return {
    container: 'logo-container',
    scale: 1,
    weight: 700,
    spacing: '12px',
    letterSpacing: '0.05em',
    textTransform: 'none',
  };
}

export function renderLogoHtml(options = {}) {
  const brandName = String(options.brandName || 'Brand').trim();
  const logoFont = String(options.logoFont || DEFAULT_LOGO_FONT_FAMILIES[0]);
  const headlineFont = String(options.headlineFont || DEFAULT_LOGO_FONT_FAMILIES[0]);
  const logoWeight = Number(options.logoWeight || 700);
  const logoLetterSpacing = String(options.logoLetterSpacing || '0.05em');
  const logoTransform = String(options.logoTransform || 'none');
  const logoSize = Number(options.logoSize || 120);
  const color = String(options.color || '#1A1A1A');
  const backgroundColor = String(options.backgroundColor || '#FFFFFF');
  const tagline = String(options.tagline || '').trim();
  const taglineFont = String(options.taglineFont || logoFont);
  const variant = String(options.variant || 'standard');
  const logoImageUrl = String(options.logoImageUrl || '').trim();
  const fontsUrl = options.googleFontsUrl
    ? String(options.googleFontsUrl)
    : buildGoogleFontsUrl([logoFont, headlineFont, taglineFont]);
  const style = logoVariantStyle(variant);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brandName)} Brand Logo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
    }
    body {
      display: grid;
      place-items: center;
      background: ${escapeHtml(backgroundColor)};
      font-family: '${escapeHtml(headlineFont)}', sans-serif;
      padding: 40px;
    }
    .logo-container {
      width: 800px;
      height: 400px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: ${style.spacing};
      background: ${escapeHtml(backgroundColor)};
      position: relative;
      overflow: hidden;
      text-align: center;
    }
    .logo-text {
      font-family: '${escapeHtml(logoFont)}', sans-serif;
      font-size: ${logoSize * style.scale}px;
      font-weight: ${logoWeight};
      letter-spacing: ${logoLetterSpacing};
      text-transform: ${logoTransform};
      color: ${escapeHtml(color)};
      line-height: 1.02;
      ${logoImageUrl ? `display: none;` : ''}
    }
    .logo-image {
      width: 100%;
      height: 100%;
      display: ${logoImageUrl ? 'block' : 'none'};
      object-fit: contain;
    }
    .tagline {
      font-family: '${escapeHtml(taglineFont)}', sans-serif;
      font-size: 16px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${escapeHtml(color)};
      opacity: 0.72;
    }
    .logo-container.stacked .logo-text { font-size: ${Math.round(logoSize * style.scale * 0.85)}px; }
    .logo-container.minimal .logo-text {
      letter-spacing: 0.26em;
      text-transform: uppercase;
      font-weight: 400;
      font-size: ${Math.round(logoSize * style.scale * 0.7)}px;
    }
    .logo-container.badge {
      width: 420px;
      height: 420px;
      border: 4px solid ${escapeHtml(color)};
      border-radius: 50%;
      gap: 10px;
      padding: 22px;
    }
    .logo-container.badge .logo-text {
      font-size: ${Math.round(logoSize * style.scale * 0.9)}px;
    }
  </style>
</head>
<body>
  <div class="${style.container}">
    ${logoImageUrl ? `<img class="logo-image" src="${escapeHtml(logoImageUrl)}" alt="${escapeHtml(brandName)} logo" />` : ''}
    ${logoImageUrl ? '' : `<div class="logo-text" style="letter-spacing:${logoLetterSpacing};text-transform:${logoTransform};font-size:${logoSize * style.scale}px">${escapeHtml(brandName)}</div>`}
    ${tagline ? `<div class="tagline">${escapeHtml(tagline)}</div>` : ''}
  </div>
</body>
</html>`;
}

function swatchHtml(label, value, background) {
  const safeBackground = escapeHtml(background);
  const safeLabel = escapeHtml(label);
  const safeValue = escapeHtml(value);
  return `<div class="swatch"><span>${safeLabel}</span><span>${safeValue}</span></div>`;
}

function moodChip(label) {
  return `<span class="mood-chip">${escapeHtml(label)}</span>`;
}

function referenceImageItem(url) {
  if (!url) {
    return '';
  }
  return `<div class="reference-item" style="background-image: url('${escapeHtml(url)}')"></div>`;
}

export function renderMoodboardHtml(options = {}) {
  const concept = options.concept || {};
  const conceptFonts = concept.fonts || {};
  const conceptPalette = concept.palette || {};
  const conceptBoard = concept.board || {};
  const brandName = String(concept.brandName || 'Brand').trim();
  const tagline = String(concept.tagline || conceptBoard.tagline || '').trim();
  const textColor = conceptPalette.text || '#1A1A1A';
  const backgroundColor = conceptPalette.background || '#F7F5F1';
  const primary = conceptPalette.primary || '#1E2A5C';
  const secondary = conceptPalette.secondary || '#D8DDE8';
  const accent = conceptPalette.accent || '#B88C4A';
  const logoImageUrl = String(options.logoImageUrl || '').trim();
  const labelImageUrl = String(options.labelImageUrl || '').trim();
  const mockupImageUrl = String(options.mockupImageUrl || '').trim();
  const moodImageUrl = String(options.moodImageUrl || '').trim();
  const familyHeadline = String(conceptFonts.headline || 'Cormorant Garamond');
  const familyBody = String(conceptFonts.body || 'Inter');
  const fontsUrl = options.googleFontsUrl
    ? String(options.googleFontsUrl)
    : buildGoogleFontsUrl([familyHeadline, familyBody]);

  const moodKeywords = Array.isArray(conceptBoard.moodKeywords)
    ? conceptBoard.moodKeywords.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];
  const positioning = String(conceptBoard.positioning || '').trim();
  const voice = Array.isArray(conceptBoard.voicePillars)
    ? conceptBoard.voicePillars.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];
  const proofs = Array.isArray(conceptBoard.proofPoints)
    ? conceptBoard.proofPoints.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brandName)} Moodboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>
    :root {
      --text: ${escapeHtml(textColor)};
      --bg: ${escapeHtml(backgroundColor)};
      --primary: ${escapeHtml(primary)};
      --secondary: ${escapeHtml(secondary)};
      --accent: ${escapeHtml(accent)};
      --headline: '${escapeHtml(familyHeadline)}', serif;
      --body: '${escapeHtml(familyBody)}', sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: var(--body);
      background: var(--bg);
      color: var(--text);
    }

    body {
      padding: 72px;
      display: grid;
      place-items: center;
      overflow: hidden;
    }

    .moodboard-container {
      width: 1880px;
      min-height: 1880px;
      background: var(--bg);
      border: 2px solid color-mix(in srgb, var(--text) 26%, transparent);
      border-radius: 28px;
      padding: 64px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: auto auto auto 1fr auto;
      gap: 24px;
      grid-template-areas:
        "header header header"
        "palette typography mood"
        "proofs proofs proof-img"
        "proof-img proof-img proof-img"
        "footer footer footer";
      box-shadow: 0 30px 90px rgba(0,0,0,0.08);
    }

    .moodboard-header {
      grid-area: header;
      padding-bottom: 18px;
      border-bottom: 2px solid color-mix(in srgb, var(--text) 18%, transparent);
    }

    .brand { font-family: var(--headline); font-size: 76px; line-height: 0.95; letter-spacing: 0.01em; text-transform: uppercase; }
    .tagline { margin-top: 12px; opacity: 0.74; letter-spacing: 0.12em; text-transform: uppercase; font-size: 17px; }

    .section {
      background: color-mix(in srgb, var(--bg) 90%, white 10%);
      border: 1px solid color-mix(in srgb, var(--text) 16%, transparent);
      border-radius: 18px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section h3 {
      text-transform: uppercase;
      letter-spacing: 0.11em;
      font-size: 12px;
      opacity: 0.7;
      font-weight: 700;
    }

    .palette {
      grid-area: palette;
      align-self: start;
    }
    .typography { grid-area: typography; }
    .mood {
      grid-area: mood;
    }
    .proofs { grid-area: proofs; }
    .proof-image {
      grid-area: proof-img;
      min-height: 0;
      display: grid;
      gap: 12px;
      grid-template-columns: 1fr 1fr;
      align-items: stretch;
    }

    .swatches {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .swatch {
      height: 95px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--text) 18%, transparent);
      padding: 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 11px;
      background: color-mix(in srgb, white 20%, transparent);
    }

    .swatch span:first-child { opacity: 0.62; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
    .swatch span:last-child {
      margin-top: auto;
      padding-top: 16px;
      font-family: var(--headline);
      font-size: 16px;
      letter-spacing: 0.08em;
    }

    .swatch.primary { background: var(--primary); color: white; }
    .swatch.secondary { background: var(--secondary); color: #111827; }
    .swatch.accent { background: var(--accent); color: white; }
    .swatch.background { background: var(--bg); color: var(--text); border-color: color-mix(in srgb, var(--text) 24%, white); }

    .mood-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .mood-chip {
      border-radius: 999px;
      padding: 10px 14px;
      border: 1px solid color-mix(in srgb, var(--text) 20%, transparent);
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-size: 11px;
      background: color-mix(in srgb, var(--text) 8%, transparent);
    }

    .tile-list {
      display: grid;
      gap: 8px;
    }
    .tile-list li {
      list-style: none;
      border-left: 2px solid var(--accent);
      padding-left: 10px;
      font-size: 13px;
      line-height: 1.35;
    }

    .proof-image-item {
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--text) 20%, transparent);
      min-height: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      overflow: hidden;
      background: white;
      position: relative;
    }

    .proof-image-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      background: #efefef;
    }

    .proof-image-item .caption {
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 6px 10px;
      border-top: 1px solid color-mix(in srgb, var(--text) 20%, transparent);
      background: color-mix(in srgb, var(--bg) 86%, white);
    }

    .footer {
      grid-area: footer;
      text-align: center;
      padding-top: 6px;
      opacity: 0.55;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border-top: 1px solid color-mix(in srgb, var(--text) 16%, transparent);
    }
  </style>
</head>
<body>
  <main class="moodboard-container">
    <section class="moodboard-header">
      <h1 class="brand">${escapeHtml(brandName)}</h1>
      ${tagline ? `<p class="tagline">${escapeHtml(tagline)}</p>` : ''}
      ${positioning ? `<p style="margin-top: 12px; max-width: 1100px; line-height: 1.45; opacity: 0.87;">${escapeHtml(positioning)}</p>` : ''}
    </section>

    <section class="section palette">
      <h3>Palette</h3>
      <div class="swatches">
        ${swatchHtml('Primary', primary, primary)}
        ${swatchHtml('Secondary', secondary, secondary)}
        ${swatchHtml('Accent', accent, accent)}
        ${swatchHtml('Background', backgroundColor, backgroundColor)}
      </div>
    </section>

    <section class="section typography">
      <h3>Typography</h3>
      <div class="tile-list">
        <li>Headline: ${escapeHtml(String(conceptFonts.headline || ''))}</li>
        <li>Body: ${escapeHtml(String(conceptFonts.body || ''))}</li>
        <li>Logo: ${escapeHtml(String(conceptFonts.logo || conceptFonts.headline || ''))}</li>
      </div>
    </section>

    <section class="section mood">
      <h3>Mood</h3>
      <div class="mood-row">${moodKeywords.map((item) => moodChip(item)).join('')}</div>
      ${logoImageUrl ? `<img src="${escapeHtml(logoImageUrl)}" alt="${escapeHtml(brandName)} logo" style="margin-top:10px;width:100%;max-width:320px;height:auto;border-radius:12px;border:1px solid color-mix(in srgb, var(--text) 16%, transparent);" />` : ''}
      <div class="tile-list" style="margin-top: 10px;">
        ${voice.length ? voice.map((item) => `<li>${escapeHtml(item)}</li>`).join('') : ''}
      </div>
    </section>

    <section class="section proofs">
      <h3>Proof</h3>
      <div class="tile-list">
        ${proofs.length ? proofs.map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>Locked template outputs are connected to label/mockup renders.</li>'}
      </div>
    </section>

    <section class="proof-image">
      ${labelImageUrl ? `<figure class="proof-image-item"><img src="${escapeHtml(labelImageUrl)}" alt="label preview" /><figcaption class="caption">Label</figcaption></figure>` : ''}
      ${mockupImageUrl ? `<figure class="proof-image-item"><img src="${escapeHtml(mockupImageUrl)}" alt="mockup preview" /><figcaption class="caption">Mockup</figcaption></figure>` : ''}
      ${moodImageUrl ? `<figure class="proof-image-item"><img src="${escapeHtml(moodImageUrl)}" alt="mood" /><figcaption class="caption">Mood Source</figcaption></figure>` : ''}
      ${logoImageUrl && !logoImageUrl.includes('moodboard') ? `<figure class="proof-image-item"><img src="${escapeHtml(logoImageUrl)}" alt="logo" /><figcaption class="caption">Logo</figcaption></figure>` : ''}
    </section>

    <div class="footer">Cyborg style brand board · reference template</div>
  </main>
</body>
</html>`;
}

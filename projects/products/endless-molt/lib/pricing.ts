// ETH-only pricing helpers.
//
// We store ETH prices in the DB as integer "micro-ETH" (1e-6 ETH) to:
// - avoid JS float rounding in storage/filters
// - stay within SQLite INTEGER + JS safe integer range for typical art prices
//
// 1 ETH = 1_000_000 micro-ETH

export const ETH_MICRO = 1_000_000;

export function parseEthToMicro(input: string): number {
  const s = String(input || '').trim();
  if (!s) throw new Error('Missing ETH price');
  if (s.startsWith('-')) throw new Error('ETH price must be >= 0');

  // Basic numeric validation; we parse manually to avoid float rounding.
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('Invalid ETH price');

  const [wholeStr, fracStrRaw] = s.split('.', 2);
  const whole = Number(wholeStr);
  if (!Number.isFinite(whole) || whole < 0) throw new Error('Invalid ETH price');

  const fracStr = (fracStrRaw || '').slice(0, 6);
  const fracPadded = (fracStr + '000000').slice(0, 6);
  const frac = fracPadded ? Number(fracPadded) : 0;
  if (!Number.isFinite(frac) || frac < 0) throw new Error('Invalid ETH price');

  // Ensure within JS safe integer bounds.
  const micros = whole * ETH_MICRO + frac;
  if (!Number.isSafeInteger(micros)) {
    throw new Error('ETH price too large');
  }
  return micros;
}

export function formatMicroEth(micros: number): string {
  const n = Number(micros);
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(Math.trunc(n));
  const whole = Math.floor(abs / ETH_MICRO);
  const frac = abs % ETH_MICRO;

  if (frac === 0) return `${whole}`;

  const fracPadded = String(frac).padStart(6, '0');
  const fracTrimmed = fracPadded.replace(/0+$/, '');
  return `${whole}.${fracTrimmed}`;
}

// Approximate conversion for legacy USD listings.
// usdCents: integer cents.
export function usdCentsToMicroEth(usdCents: number, ethUsd: number): number {
  if (!Number.isFinite(usdCents) || !Number.isFinite(ethUsd) || ethUsd <= 0) return 0;
  const cents = Math.max(0, Math.trunc(usdCents));
  // micros = round((usdCents/100)/ethUsd * 1e6) = round(usdCents * 1e6 / (100*ethUsd))
  const denom = 100 * ethUsd;
  const micros = Math.round((cents * ETH_MICRO) / denom);
  return Number.isSafeInteger(micros) ? micros : 0;
}

// Approximate conversion for card checkout.
// micros: integer micro-ETH.
export function microEthToUsdCents(micros: number, ethUsd: number): number {
  if (!Number.isFinite(micros) || !Number.isFinite(ethUsd) || ethUsd <= 0) return 0;
  const m = Math.max(0, Math.trunc(micros));
  const cents = Math.round((m * ethUsd * 100) / ETH_MICRO);
  return Number.isSafeInteger(cents) ? cents : 0;
}

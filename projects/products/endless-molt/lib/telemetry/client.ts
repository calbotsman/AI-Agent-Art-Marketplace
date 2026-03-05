'use client';

import { track } from '@vercel/analytics';

type TelemetryValue = string | number | boolean | null | undefined;
type TelemetryProps = Record<string, TelemetryValue>;

export function trackEvent(event: string, props: TelemetryProps = {}) {
  try {
    track(event, props);
  } catch {
    // Never block UX on analytics transport failures.
  }
}


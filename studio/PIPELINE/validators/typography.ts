export type ContrastRole = "body" | "headline";

export interface TypographySample {
  role: string;
  fontSizePx: number;
  lineHeight: number;
  lineLengthChars?: number;
  contrastRatio?: number;
  contrastRole?: ContrastRole;
}

export interface TypographyValidationResult {
  pass: boolean;
  violations: string[];
}

export interface TypographyRules {
  minFontSizePx: number;
  minHierarchyStepRatio: number;
  bodyLineLengthMinChars: number;
  bodyLineLengthMaxChars: number;
  minBodyContrastRatio: number;
  minHeadlineContrastRatio: number;
}

export const DEFAULT_TYPOGRAPHY_RULES: TypographyRules = {
  minFontSizePx: 8,
  minHierarchyStepRatio: 1.15,
  bodyLineLengthMinChars: 28,
  bodyLineLengthMaxChars: 58,
  minBodyContrastRatio: 4.5,
  minHeadlineContrastRatio: 3.0
};

export function validateTypography(
  samples: TypographySample[],
  rules: TypographyRules = DEFAULT_TYPOGRAPHY_RULES
): TypographyValidationResult {
  const violations: string[] = [];

  for (const sample of samples) {
    if (sample.fontSizePx < rules.minFontSizePx) {
      violations.push(
        `[${sample.role}] fontSizePx ${sample.fontSizePx} < ${rules.minFontSizePx}`
      );
    }

    if (sample.lineLengthChars !== undefined) {
      if (
        sample.lineLengthChars < rules.bodyLineLengthMinChars ||
        sample.lineLengthChars > rules.bodyLineLengthMaxChars
      ) {
        violations.push(
          `[${sample.role}] lineLengthChars ${sample.lineLengthChars} outside ${rules.bodyLineLengthMinChars}-${rules.bodyLineLengthMaxChars}`
        );
      }
    }

    if (sample.contrastRatio !== undefined) {
      const threshold =
        sample.contrastRole === "headline"
          ? rules.minHeadlineContrastRatio
          : rules.minBodyContrastRatio;
      if (sample.contrastRatio < threshold) {
        violations.push(
          `[${sample.role}] contrastRatio ${sample.contrastRatio} < ${threshold}`
        );
      }
    }
  }

  const sortedBySize = [...samples].sort((a, b) => b.fontSizePx - a.fontSizePx);
  for (let i = 0; i < sortedBySize.length - 1; i += 1) {
    const current = sortedBySize[i];
    const next = sortedBySize[i + 1];
    if (current.fontSizePx === 0) {
      continue;
    }
    const ratio = current.fontSizePx / next.fontSizePx;
    if (ratio < rules.minHierarchyStepRatio) {
      violations.push(
        `[${current.role}->${next.role}] hierarchy step ${ratio.toFixed(3)} < ${rules.minHierarchyStepRatio}`
      );
    }
  }

  return {
    pass: violations.length === 0,
    violations
  };
}

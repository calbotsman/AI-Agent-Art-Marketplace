#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "/Users/calbotsman/clawd";
const DEFAULT_MATRIX_PATH = path.join(
  ROOT,
  "studio/PIPELINE/testing/creative-test-matrix.json"
);
const DEFAULT_OUTPUT_ROOT = path.join(ROOT, "output/creative-qa");

function parseArgs(argv) {
  const options = {
    matrix: DEFAULT_MATRIX_PATH,
    out: DEFAULT_OUTPUT_ROOT
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--matrix" && argv[i + 1]) {
      options.matrix = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--out" && argv[i + 1]) {
      options.out = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
  }

  return options;
}

function formatStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function normalizeHex(hex) {
  if (typeof hex !== "string") {
    return null;
  }
  const value = hex.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(value) ? value : null;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function srgbToLinear(channel) {
  const normalized = channel / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.0722 * srgbToLinear(rgb.b)
  );
}

function contrastRatio(foregroundHex, backgroundHex) {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  if (fg === null || bg === null) {
    return null;
  }
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function validateTypography(input, rules) {
  const violations = [];
  const samples = Array.isArray(input.samples) ? input.samples : [];

  if (!samples.length) {
    violations.push("samples missing");
  }

  if (typeof input.familyCount === "number" && input.familyCount > rules.maxFontFamilies) {
    violations.push(
      `familyCount ${input.familyCount} > maxFontFamilies ${rules.maxFontFamilies}`
    );
  }

  for (const sample of samples) {
    if (sample.fontSizePx < rules.minFontSizePx) {
      violations.push(`[${sample.role}] fontSizePx ${sample.fontSizePx} < ${rules.minFontSizePx}`);
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
        violations.push(`[${sample.role}] contrastRatio ${sample.contrastRatio} < ${threshold}`);
      }
    }
  }

  const sorted = [...samples].sort((a, b) => b.fontSizePx - a.fontSizePx);
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (!current.fontSizePx || !next.fontSizePx) {
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

function validateColor(input, rules) {
  const violations = [];
  const palette = input.palette ?? {};
  const requiredRoles = ["background", "text", "primary", "secondary", "accent"];

  for (const role of requiredRoles) {
    const value = normalizeHex(palette[role]);
    if (!value) {
      violations.push(`palette.${role} missing or invalid hex`);
    }
  }

  if (!violations.length) {
    const checks = [
      {
        name: "text/background",
        ratio: contrastRatio(palette.text, palette.background),
        threshold: rules.minBodyContrastRatio
      },
      {
        name: "primary/background",
        ratio: contrastRatio(palette.primary, palette.background),
        threshold: rules.minHeadlineContrastRatio
      },
      {
        name: "accent/background",
        ratio: contrastRatio(palette.accent, palette.background),
        threshold: rules.minHeadlineContrastRatio
      }
    ];

    for (const check of checks) {
      if (check.ratio === null) {
        violations.push(`${check.name} contrast could not be computed`);
        continue;
      }
      if (check.ratio < check.threshold) {
        violations.push(
          `${check.name} contrast ${check.ratio.toFixed(2)} < ${check.threshold.toFixed(2)}`
        );
      }
    }
  }

  if (
    typeof input.accentUsageRatio === "number" &&
    input.accentUsageRatio > rules.maxAccentUsageRatio
  ) {
    violations.push(
      `accentUsageRatio ${input.accentUsageRatio} > ${rules.maxAccentUsageRatio} (one accent at a time rule)`
    );
  }

  return {
    pass: violations.length === 0,
    violations
  };
}

function validateLogo(input, rules) {
  const violations = [];

  if (input.variantCount < rules.minVariantCount) {
    violations.push(`variantCount ${input.variantCount} < ${rules.minVariantCount}`);
  }

  if (input.familyCount > rules.maxFontFamilies) {
    violations.push(`familyCount ${input.familyCount} > ${rules.maxFontFamilies}`);
  }

  if (input.minimumAppliedContrastRatio < rules.minAppliedContrastRatio) {
    violations.push(
      `minimumAppliedContrastRatio ${input.minimumAppliedContrastRatio} < ${rules.minAppliedContrastRatio}`
    );
  }

  if (!input.hasMonochromeVariant) {
    violations.push("hasMonochromeVariant is false");
  }

  return {
    pass: violations.length === 0,
    violations
  };
}

function validateLayout(input, rules) {
  const violations = [];

  if (
    input.canvasWidthPx !== rules.requiredCanvasWidthPx ||
    input.canvasHeightPx !== rules.requiredCanvasHeightPx
  ) {
    violations.push(
      `canvas ${input.canvasWidthPx}x${input.canvasHeightPx} must be ${rules.requiredCanvasWidthPx}x${rules.requiredCanvasHeightPx}`
    );
  }

  if (input.gridTemplateColumns !== rules.requiredGridTemplateColumns) {
    violations.push(
      `gridTemplateColumns "${input.gridTemplateColumns}" must be "${rules.requiredGridTemplateColumns}"`
    );
  }

  if (input.ingredientRows > rules.maxIngredientRows) {
    violations.push(`ingredientRows ${input.ingredientRows} > ${rules.maxIngredientRows}`);
  }

  if (!rules.allowOverflow && input.overflowDetected) {
    violations.push("overflowDetected true while allowOverflow is false");
  }

  if (input.collisionCount > rules.maxCollisionCount) {
    violations.push(`collisionCount ${input.collisionCount} > ${rules.maxCollisionCount}`);
  }

  return {
    pass: violations.length === 0,
    violations
  };
}

function evaluateCase(caseDef, validator) {
  const result = validator(caseDef.input ?? {});
  const expectedPass = Boolean(caseDef.expectPass);
  const expectationMet = result.pass === expectedPass;
  return {
    id: caseDef.id,
    expectedPass,
    pass: result.pass,
    expectationMet,
    violations: result.violations
  };
}

function summarizeCases(cases) {
  const total = cases.length;
  const pass = cases.filter((entry) => entry.pass).length;
  const fail = total - pass;
  const expectationMismatches = cases.filter((entry) => !entry.expectationMet).map((entry) => entry.id);

  return {
    total,
    pass,
    fail,
    expectationMismatches
  };
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push("# Creative QA Report");
  lines.push("");
  lines.push(`- Run timestamp: ${report.runAt}`);
  lines.push(`- Matrix: \`${report.matrixPath}\``);
  lines.push(`- Total cases: ${report.totals.totalCases}`);
  lines.push(`- Passed: ${report.totals.pass}`);
  lines.push(`- Failed: ${report.totals.fail}`);
  lines.push(`- Expectation mismatches: ${report.totals.expectationMismatches}`);
  lines.push("");

  for (const sectionName of ["typography", "color", "logo", "layout", "combinations"]) {
    const section = report.sections[sectionName];
    lines.push(`## ${sectionName}`);
    lines.push(`- Total: ${section.summary.total}`);
    lines.push(`- Passed: ${section.summary.pass}`);
    lines.push(`- Failed: ${section.summary.fail}`);
    lines.push(
      `- Expectation mismatches: ${section.summary.expectationMismatches.length ? section.summary.expectationMismatches.join(", ") : "none"}`
    );
    const failing = section.cases.filter((entry) => !entry.pass);
    if (failing.length) {
      lines.push("- Failed case details:");
      for (const entry of failing) {
        lines.push(`  - ${entry.id}`);
        for (const violation of entry.violations) {
          lines.push(`    - ${violation}`);
        }
      }
    }
    lines.push("");
  }

  lines.push("## Learning Signals");
  lines.push("- Keep: maintain passes that satisfy profile and rail constraints.");
  lines.push("- Kill: patterns causing repeated contrast, hierarchy, or rail violations.");
  lines.push("- Change: prioritize fixes in failing combination cases before section-only failures.");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const matrixRaw = await fs.readFile(options.matrix, "utf8");
  const matrix = JSON.parse(matrixRaw);

  const typographyTokens = JSON.parse(
    await fs.readFile(path.join(ROOT, "studio/PIPELINE/design-system/typography-tokens.json"), "utf8")
  );
  const layoutTokens = JSON.parse(
    await fs.readFile(path.join(ROOT, "studio/PIPELINE/design-system/layout-tokens.json"), "utf8")
  );

  const typographyRules = {
    minFontSizePx: typographyTokens.scale.minPx,
    minHierarchyStepRatio: typographyTokens.constraints.hierarchyMinStepRatio,
    bodyLineLengthMinChars: typographyTokens.constraints.lineLength.bodyMinChars,
    bodyLineLengthMaxChars: typographyTokens.constraints.lineLength.bodyMaxChars,
    minBodyContrastRatio: typographyTokens.constraints.contrastRatioMin,
    minHeadlineContrastRatio: typographyTokens.constraints.headlineContrastRatioMin,
    maxFontFamilies: typographyTokens.constraints.maxFontFamilies
  };

  const colorRules = {
    minBodyContrastRatio: typographyTokens.constraints.contrastRatioMin,
    minHeadlineContrastRatio: typographyTokens.constraints.headlineContrastRatioMin,
    maxAccentUsageRatio: 0.2
  };

  const logoRules = {
    minVariantCount: 3,
    maxFontFamilies: typographyTokens.constraints.maxFontFamilies,
    minAppliedContrastRatio: typographyTokens.constraints.contrastRatioMin
  };

  const layoutRules = {
    requiredCanvasWidthPx: layoutTokens.canvas.widthPx,
    requiredCanvasHeightPx: layoutTokens.canvas.heightPx,
    requiredGridTemplateColumns: layoutTokens.grid.templateColumns.join(" "),
    maxIngredientRows: layoutTokens.limits.maxIngredientRows,
    allowOverflow: layoutTokens.limits.allowOverflow,
    maxCollisionCount: layoutTokens.limits.maxCollisionCount
  };

  const sectionTypography = (matrix.sections?.typography ?? []).map((entry) =>
    evaluateCase(entry, (input) => validateTypography(input, typographyRules))
  );
  const sectionColor = (matrix.sections?.color ?? []).map((entry) =>
    evaluateCase(entry, (input) => validateColor(input, colorRules))
  );
  const sectionLogo = (matrix.sections?.logo ?? []).map((entry) =>
    evaluateCase(entry, (input) => validateLogo(input, logoRules))
  );
  const sectionLayout = (matrix.sections?.layout ?? []).map((entry) =>
    evaluateCase(entry, (input) => validateLayout(input, layoutRules))
  );

  const combinations = (matrix.combinations ?? []).map((entry) => {
    const violations = [];
    const typography = validateTypography(entry.input?.typography ?? {}, typographyRules);
    const color = validateColor(entry.input?.color ?? {}, colorRules);
    const logo = validateLogo(entry.input?.logo ?? {}, logoRules);
    const layout = validateLayout(entry.input?.layout ?? {}, layoutRules);

    if (!typography.pass) {
      violations.push(...typography.violations.map((value) => `[typography] ${value}`));
    }
    if (!color.pass) {
      violations.push(...color.violations.map((value) => `[color] ${value}`));
    }
    if (!logo.pass) {
      violations.push(...logo.violations.map((value) => `[logo] ${value}`));
    }
    if (!layout.pass) {
      violations.push(...layout.violations.map((value) => `[layout] ${value}`));
    }

    const comboPass = violations.length === 0;
    return {
      id: entry.id,
      expectedPass: Boolean(entry.expectPass),
      pass: comboPass,
      expectationMet: comboPass === Boolean(entry.expectPass),
      violations
    };
  });

  const sections = {
    typography: {
      cases: sectionTypography,
      summary: summarizeCases(sectionTypography)
    },
    color: {
      cases: sectionColor,
      summary: summarizeCases(sectionColor)
    },
    logo: {
      cases: sectionLogo,
      summary: summarizeCases(sectionLogo)
    },
    layout: {
      cases: sectionLayout,
      summary: summarizeCases(sectionLayout)
    },
    combinations: {
      cases: combinations,
      summary: summarizeCases(combinations)
    }
  };

  const allCases = [
    ...sections.typography.cases,
    ...sections.color.cases,
    ...sections.logo.cases,
    ...sections.layout.cases,
    ...sections.combinations.cases
  ];

  const totals = {
    totalCases: allCases.length,
    pass: allCases.filter((entry) => entry.pass).length,
    fail: allCases.filter((entry) => !entry.pass).length,
    expectationMismatches: allCases.filter((entry) => !entry.expectationMet).length
  };

  const report = {
    runAt: new Date().toISOString(),
    matrixPath: options.matrix,
    tokens: {
      typography: path.join(ROOT, "studio/PIPELINE/design-system/typography-tokens.json"),
      layout: path.join(ROOT, "studio/PIPELINE/design-system/layout-tokens.json")
    },
    totals,
    sections
  };

  const outputDir = path.join(options.out, formatStamp());
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(outputDir, "summary.md"), buildMarkdownReport(report));
  await fs.writeFile(
    path.join(outputDir, "failing-case-ids.txt"),
    allCases
      .filter((entry) => !entry.pass)
      .map((entry) => entry.id)
      .join("\n")
  );

  await fs.copyFile(options.matrix, path.join(outputDir, "creative-test-matrix.snapshot.json"));

  process.stdout.write(`${path.join(outputDir, "summary.json")}\n`);

  if (totals.expectationMismatches > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

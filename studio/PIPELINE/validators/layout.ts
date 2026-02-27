export interface LayoutSnapshot {
  canvasWidthPx: number;
  canvasHeightPx: number;
  gridTemplateColumns: string;
  ingredientRows: number;
  overflowDetected: boolean;
  collisionCount: number;
}

export interface LayoutRules {
  requiredCanvasWidthPx: number;
  requiredCanvasHeightPx: number;
  requiredGridTemplateColumns: string;
  maxIngredientRows: number;
  allowOverflow: boolean;
  maxCollisionCount: number;
}

export interface LayoutValidationResult {
  pass: boolean;
  violations: string[];
}

export const DEFAULT_LAYOUT_RULES: LayoutRules = {
  requiredCanvasWidthPx: 1650,
  requiredCanvasHeightPx: 600,
  requiredGridTemplateColumns: "1fr 300px 1fr",
  maxIngredientRows: 8,
  allowOverflow: false,
  maxCollisionCount: 0
};

export function validateLayout(
  snapshot: LayoutSnapshot,
  rules: LayoutRules = DEFAULT_LAYOUT_RULES
): LayoutValidationResult {
  const violations: string[] = [];

  if (
    snapshot.canvasWidthPx !== rules.requiredCanvasWidthPx ||
    snapshot.canvasHeightPx !== rules.requiredCanvasHeightPx
  ) {
    violations.push(
      `canvas ${snapshot.canvasWidthPx}x${snapshot.canvasHeightPx} must be ${rules.requiredCanvasWidthPx}x${rules.requiredCanvasHeightPx}`
    );
  }

  if (snapshot.gridTemplateColumns !== rules.requiredGridTemplateColumns) {
    violations.push(
      `gridTemplateColumns "${snapshot.gridTemplateColumns}" must be "${rules.requiredGridTemplateColumns}"`
    );
  }

  if (snapshot.ingredientRows > rules.maxIngredientRows) {
    violations.push(
      `ingredientRows ${snapshot.ingredientRows} > ${rules.maxIngredientRows}`
    );
  }

  if (!rules.allowOverflow && snapshot.overflowDetected) {
    violations.push("overflowDetected true while allowOverflow is false");
  }

  if (snapshot.collisionCount > rules.maxCollisionCount) {
    violations.push(
      `collisionCount ${snapshot.collisionCount} > ${rules.maxCollisionCount}`
    );
  }

  return {
    pass: violations.length === 0,
    violations
  };
}

export interface ValidationIssue {
  treatIdx: number;
  repIdx: number;
  type: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  isValid: boolean;
  summary: string;
}

/**
 * Validates the data grid and returns errors and warnings.
 * Errors prevent analysis. Warnings are informational (outliers).
 */
export function validateGrid(
  data: (number | null)[][],
  treatmentNames: string[]
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (data.length === 0) {
    return {
      errors: [{ treatIdx: 0, repIdx: 0, type: 'error', message: 'Nenhum dado inserido' }],
      warnings: [],
      isValid: false,
      summary: 'Nenhum dado inserido.',
    };
  }

  // Check each treatment row
  for (let t = 0; t < data.length; t++) {
    const row = data[t];
    const validCount = row.filter((v) => v !== null).length;
    const name = treatmentNames[t] || `Trat ${t + 1}`;

    // Needs at least 2 values per treatment for ANOVA/variance
    if (validCount < 2) {
      errors.push({
        treatIdx: t,
        repIdx: -1,
        type: 'error',
        message: `Tratamento "${name}" precisa de pelo menos 2 dados válidos.`,
      });
    }
  }

  // Check for outliers (values > 3 standard deviations from treatment mean)
  for (let t = 0; t < data.length; t++) {
    const row = data[t];
    const validCells = row.filter((v) => v !== null) as number[];
    if (validCells.length < 3) continue; // Need at least 3 values for meaningful outlier detection

    const mean = validCells.reduce((a, b) => a + b, 0) / validCells.length;
    const variance =
      validCells.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (validCells.length - 1);
    const sd = Math.sqrt(variance);
    const name = treatmentNames[t] || `Trat ${t + 1}`;

    if (sd === 0) continue;

    for (let r = 0; r < row.length; r++) {
      const val = row[r];
      if (val !== null) {
        const zScore = Math.abs((val - mean) / sd);
        if (zScore > 3) {
          warnings.push({
            treatIdx: t,
            repIdx: r,
            type: 'warning',
            message: `Possível outlier em "${name}", Rep ${r + 1} (valor: ${val}, z-score: ${zScore.toFixed(1)})`,
          });
        }
      }
    }
  }

  // Build summary
  let summary = '';
  if (errors.length > 0) {
    summary = `${errors.length} erro(s) encontrado(s). Corrija antes de analisar.`;
  } else if (warnings.length > 0) {
    summary = `${warnings.length} aviso(s): possíveis outliers detectados.`;
  }

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
    summary,
  };
}

/**
 * Returns a map of cell states for quick lookup.
 * Key: "treatIdx-repIdx", Value: 'error' | 'warning'
 */
export function getCellStates(
  validation: ValidationResult
): Map<string, 'error' | 'warning'> {
  const map = new Map<string, 'error' | 'warning'>();

  for (const issue of validation.errors) {
    if (issue.repIdx >= 0) {
      map.set(`${issue.treatIdx}-${issue.repIdx}`, 'error');
    }
  }

  for (const issue of validation.warnings) {
    if (issue.repIdx >= 0 && !map.has(`${issue.treatIdx}-${issue.repIdx}`)) {
      map.set(`${issue.treatIdx}-${issue.repIdx}`, 'warning');
    }
  }

  return map;
}

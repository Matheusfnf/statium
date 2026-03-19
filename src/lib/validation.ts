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
  data: number[][],
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
    const nonZeroCount = row.filter((v) => v !== 0).length;
    const name = treatmentNames[t] || `Trat ${t + 1}`;

    // If row is partially filled, mark empty cells as errors
    if (nonZeroCount > 0 && nonZeroCount < row.length) {
      for (let r = 0; r < row.length; r++) {
        if (row[r] === 0) {
          errors.push({
            treatIdx: t,
            repIdx: r,
            type: 'error',
            message: `Célula vazia em "${name}", Rep ${r + 1}`,
          });
        }
      }
    }

    // If entire row is zero, that's an error
    if (nonZeroCount === 0) {
      errors.push({
        treatIdx: t,
        repIdx: -1,
        type: 'error',
        message: `Tratamento "${name}" sem dados`,
      });
    }
  }

  // Check for outliers (values > 3 standard deviations from treatment mean)
  for (let t = 0; t < data.length; t++) {
    const row = data[t];
    const nonZero = row.filter((v) => v !== 0);
    if (nonZero.length < 3) continue; // Need at least 3 values for meaningful outlier detection

    const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    const variance =
      nonZero.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (nonZero.length - 1);
    const sd = Math.sqrt(variance);
    const name = treatmentNames[t] || `Trat ${t + 1}`;

    if (sd === 0) continue;

    for (let r = 0; r < row.length; r++) {
      if (row[r] !== 0) {
        const zScore = Math.abs((row[r] - mean) / sd);
        if (zScore > 3) {
          warnings.push({
            treatIdx: t,
            repIdx: r,
            type: 'warning',
            message: `Possível outlier em "${name}", Rep ${r + 1} (valor: ${row[r]}, z-score: ${zScore.toFixed(1)})`,
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

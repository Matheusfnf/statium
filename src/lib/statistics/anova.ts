/**
 * Analysis of Variance (ANOVA) implementations
 * - DIC: Delineamento Inteiramente Casualizado (Completely Randomized Design)
 * - DBC: Delineamento em Blocos Casualizados (Randomized Complete Block Design)
 */

import { mean, sum, flattenMatrix, coefficientOfVariation } from './utils';
import { fPValue, fCritical } from './distributions';
import { bartlettTest, shapiroWilk, AssumptionResult } from './assumptions';

export type DesignType = 'DIC' | 'DBC';

export interface AnovaRow {
  source: string;        // Source of variation (Fonte de Variação)
  df: number;            // Degrees of freedom (Graus de Liberdade)
  ss: number;            // Sum of squares (Soma de Quadrados)
  ms: number;            // Mean square (Quadrado Médio)
  fValue: number | null; // F statistic
  pValue: number | null; // p-value
  fCritical05: number | null; // F critical at 5%
  fCritical01: number | null; // F critical at 1%
  significance: string;  // **, *, ns
}

export interface AssumptionsResultMap {
  normality: AssumptionResult;
  homoscedasticity: AssumptionResult;
}

export interface AnovaResult {
  table: AnovaRow[];
  overallMean: number;
  cv: number;            // Coefficient of variation (%)
  mse: number;           // Mean Square Error
  dfError: number;       // Degrees of freedom for error
  treatmentMeans: number[];
  treatmentCounts: number[]; // used for tukey-kramer
  treatmentNames: string[];
  design: DesignType;
  assumptions: AssumptionsResultMap;
}

/**
 * Perform ANOVA for a Completely Randomized Design (DIC)
 * @param data Matrix [treatments][repetitions], null represents missing data
 * @param treatmentNames Names of treatments
 */
export function anovaDIC(
  data: (number | null)[][],
  treatmentNames: string[],
  alpha: number = 0.05
): AnovaResult {
  const k = data.length;         // number of treatments
  
  // Clean data into numeric format only, separating groups
  const cleanGroups = data.map(row => row.filter(v => v !== null) as number[]);
  const allValues = flattenMatrix(cleanGroups);
  const N = allValues.length;
  const grandMean = mean(allValues);

  // Correction factor
  const C = (sum(allValues) ** 2) / N;

  // Total Sum of Squares
  const ssTotal = allValues.reduce((acc, v) => acc + v ** 2, 0) - C;

  // Treatment Sum of Squares
  const treatmentMeans = cleanGroups.map(row => mean(row) || 0);
  const treatmentCounts = cleanGroups.map(row => row.length);
  let ssTreatment = 0;
  for (let i = 0; i < k; i++) {
    const ni = treatmentCounts[i];
    if (ni > 0) {
      ssTreatment += ni * (treatmentMeans[i] - grandMean) ** 2;
    }
  }

  // Error Sum of Squares
  const ssError = ssTotal - ssTreatment;

  // Degrees of freedom
  const dfTotal = N - 1;
  const dfTreatment = k - 1;
  const dfError = dfTotal - dfTreatment;

  // Mean Squares
  const msTreatment = ssTreatment / dfTreatment;
  const msError = ssError / dfError;

  // F statistic
  const fValue = msTreatment / msError;
  const pValue = fPValue(fValue, dfTreatment, dfError);
  const fc05 = fCritical(0.05, dfTreatment, dfError);
  const fc01 = fCritical(0.01, dfTreatment, dfError);

  function getSignificance(p: number | null, alpha: number): string {
    if (p === null) return 'ns';
    if (p <= alpha) return '*';
    return 'ns';
  }
  const significance = getSignificance(pValue, alpha);

  const cv = coefficientOfVariation(grandMean, msError);

  // Compute Assumptions
  // 1. Homoscedasticity (Bartlett)
  const homoscedasticity = bartlettTest(cleanGroups, alpha);
  
  // 2. Normality (Shapiro-Wilk) of Residuals
  // residual = Y_ij - Mean_i
  const residuals: number[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < cleanGroups[i].length; j++) {
      residuals.push(cleanGroups[i][j] - treatmentMeans[i]);
    }
  }
  const normality = shapiroWilk(residuals, alpha);

  const table: AnovaRow[] = [
    {
      source: 'Tratamentos',
      df: dfTreatment,
      ss: ssTreatment,
      ms: msTreatment,
      fValue,
      pValue,
      fCritical05: fc05,
      fCritical01: fc01,
      significance,
    },
    {
      source: 'Resíduo',
      df: dfError,
      ss: ssError,
      ms: msError,
      fValue: null,
      pValue: null,
      fCritical05: null,
      fCritical01: null,
      significance: '',
    },
    {
      source: 'Total',
      df: dfTotal,
      ss: ssTotal,
      ms: 0,
      fValue: null,
      pValue: null,
      fCritical05: null,
      fCritical01: null,
      significance: '',
    },
  ];

  return {
    table,
    overallMean: grandMean,
    cv,
    mse: msError,
    dfError,
    treatmentMeans,
    treatmentCounts,
    treatmentNames,
    design: 'DIC',
    assumptions: {
      homoscedasticity,
      normality
    }
  };
}

/**
 * Perform ANOVA for a Randomized Complete Block Design (DBC)
 * @param data Matrix [treatments][blocks] - each row is a treatment, each column is a block, null represents missing values
 * @param treatmentNames Names of treatments
 */
export function anovaDBC(
  data: (number | null)[][],
  treatmentNames: string[],
  alpha: number = 0.05
): AnovaResult {
  const k = data.length;         // number of treatments
  const b = data[0].length;      // maximum number of blocks
  
  // Extract all valid values for general stats
  const cleanGroups = data.map(row => row.filter(v => v !== null) as number[]);
  const allValues = flattenMatrix(cleanGroups);
  const N = allValues.length;
  const grandMean = mean(allValues);

  // Correction factor
  const C = (sum(allValues) ** 2) / N;

  // Total Sum of Squares
  const ssTotal = allValues.reduce((acc, v) => acc + v ** 2, 0) - C;

  // Treatment Sum of Squares (approximation for unbalanced, but assuming generally balanced DBC)
  const treatmentMeans = cleanGroups.map(row => mean(row) || 0);
  const treatmentCounts = cleanGroups.map(row => row.length);
  let ssTreatment = 0;
  for (let i = 0; i < k; i++) {
    const ni = treatmentCounts[i];
    if (ni > 0) {
      ssTreatment += ni * (treatmentMeans[i] - grandMean) ** 2;
    }
  }

  // Block Sum of Squares
  let ssBlock = 0;
  for (let j = 0; j < b; j++) {
    const blockValues = data.map(row => row[j]).filter(v => v !== null) as number[];
    if (blockValues.length > 0) {
      const blockMean = mean(blockValues) || 0;
      ssBlock += blockValues.length * (blockMean - grandMean) ** 2;
    }
  }

  // Error Sum of Squares
  const ssError = ssTotal - ssTreatment - ssBlock;

  // Degrees of freedom
  const dfTotal = N - 1;
  const dfTreatment = k - 1;
  const dfBlock = b - 1;
  // Approximation for potentially unbalanced DBC: N - 1 - (k-1) - (b-1)
  const dfError = dfTotal - dfTreatment - dfBlock;

  // Mean Squares
  const msTreatment = ssTreatment / dfTreatment;
  const msBlock = ssBlock / dfBlock;
  const msError = ssError / dfError;

  // F statistics
  const fTreatment = msTreatment / msError;
  const pTreatment = fPValue(fTreatment, dfTreatment, dfError);
  const fcTreat05 = fCritical(0.05, dfTreatment, dfError);
  const fcTreat01 = fCritical(0.01, dfTreatment, dfError);

  const fBlock = msBlock / msError;
  const pBlock = fPValue(fBlock, dfBlock, dfError);
  const fcBlock05 = fCritical(0.05, dfBlock, dfError);
  const fcBlock01 = fCritical(0.01, dfBlock, dfError);

  function getSignificance(p: number | null, alpha: number): string {
    if (p === null) return 'ns';
    if (p <= alpha) return '*';
    return 'ns';
  }

  const sigTreatment = getSignificance(pTreatment, alpha);
  const sigBlock = getSignificance(pBlock, alpha);

  const cv = coefficientOfVariation(grandMean, msError);

  // Compute Assumptions
  // 1. Homoscedasticity (Bartlett)
  const homoscedasticity = bartlettTest(cleanGroups, alpha);
  
  // 2. Normality (Shapiro-Wilk) of Residuals
  // residual = Y_ij - MeanTreat_i - MeanBlock_j + GrandMean (classical approximation)
  const residuals: number[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < b; j++) {
      const val = data[i][j];
      if (val !== null) {
        const blockValues = data.map(row => row[j]).filter(v => v !== null) as number[];
        const blockMean = mean(blockValues) || grandMean;
        residuals.push(val - treatmentMeans[i] - blockMean + grandMean);
      }
    }
  }
  const normality = shapiroWilk(residuals, alpha);

  const table: AnovaRow[] = [
    {
      source: 'Tratamentos',
      df: dfTreatment,
      ss: ssTreatment,
      ms: msTreatment,
      fValue: fTreatment,
      pValue: pTreatment,
      fCritical05: fcTreat05,
      fCritical01: fcTreat01,
      significance: sigTreatment,
    },
    {
      source: 'Blocos',
      df: dfBlock,
      ss: ssBlock,
      ms: msBlock,
      fValue: fBlock,
      pValue: pBlock,
      fCritical05: fcBlock05,
      fCritical01: fcBlock01,
      significance: sigBlock,
    },
    {
      source: 'Resíduo',
      df: dfError,
      ss: ssError,
      ms: msError,
      fValue: null,
      pValue: null,
      fCritical05: null,
      fCritical01: null,
      significance: '',
    },
    {
      source: 'Total',
      df: dfTotal,
      ss: ssTotal,
      ms: 0,
      fValue: null,
      pValue: null,
      fCritical05: null,
      fCritical01: null,
      significance: '',
    },
  ];

  return {
    table,
    overallMean: grandMean,
    cv,
    mse: msError,
    dfError,
    treatmentMeans,
    treatmentCounts,
    treatmentNames,
    design: 'DBC',
    assumptions: {
      homoscedasticity,
      normality
    }
  };
}

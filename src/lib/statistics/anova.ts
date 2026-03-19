/**
 * Analysis of Variance (ANOVA) implementations
 * - DIC: Delineamento Inteiramente Casualizado (Completely Randomized Design)
 * - DBC: Delineamento em Blocos Casualizados (Randomized Complete Block Design)
 */

import { mean, sum, flattenMatrix, coefficientOfVariation } from './utils';
import { fPValue, fCritical } from './distributions';

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

export interface AnovaResult {
  table: AnovaRow[];
  overallMean: number;
  cv: number;            // Coefficient of variation (%)
  mse: number;           // Mean Square Error
  dfError: number;       // Degrees of freedom for error
  treatmentMeans: number[];
  treatmentNames: string[];
  design: DesignType;
}

/**
 * Perform ANOVA for a Completely Randomized Design (DIC)
 * @param data Matrix [treatments][repetitions]
 * @param treatmentNames Names of treatments
 */
export function anovaDIC(
  data: number[][],
  treatmentNames: string[],
  alpha: number = 0.05
): AnovaResult {
  const k = data.length;         // number of treatments
  const allValues = flattenMatrix(data);
  const N = allValues.length;
  const grandMean = mean(allValues);

  // Correction factor
  const C = (sum(allValues) ** 2) / N;

  // Total Sum of Squares
  const ssTotal = allValues.reduce((acc, v) => acc + v ** 2, 0) - C;

  // Treatment Sum of Squares
  const treatmentMeans = data.map(row => mean(row));
  let ssTreatment = 0;
  for (let i = 0; i < k; i++) {
    const ni = data[i].length;
    ssTreatment += ni * (treatmentMeans[i] - grandMean) ** 2;
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

  let significance = 'ns';
  if (pValue !== null && pValue <= alpha) {
    significance = alpha <= 0.01 ? '**' : '*';
  }

  const cv = coefficientOfVariation(grandMean, msError);

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
    treatmentNames,
    design: 'DIC',
  };
}

/**
 * Perform ANOVA for a Randomized Complete Block Design (DBC)
 * @param data Matrix [treatments][blocks] - each row is a treatment, each column is a block
 * @param treatmentNames Names of treatments
 */
export function anovaDBC(
  data: number[][],
  treatmentNames: string[],
  alpha: number = 0.05
): AnovaResult {
  const k = data.length;         // number of treatments
  const b = data[0].length;      // number of blocks
  const N = k * b;
  const allValues = flattenMatrix(data);
  const grandMean = mean(allValues);

  // Correction factor
  const C = (sum(allValues) ** 2) / N;

  // Total Sum of Squares
  const ssTotal = allValues.reduce((acc, v) => acc + v ** 2, 0) - C;

  // Treatment Sum of Squares
  const treatmentMeans = data.map(row => mean(row));
  let ssTreatment = 0;
  for (let i = 0; i < k; i++) {
    ssTreatment += b * (treatmentMeans[i] - grandMean) ** 2;
  }

  // Block Sum of Squares
  let ssBlock = 0;
  for (let j = 0; j < b; j++) {
    const blockValues = data.map(row => row[j]);
    const blockMean = mean(blockValues);
    ssBlock += k * (blockMean - grandMean) ** 2;
  }

  // Error Sum of Squares
  const ssError = ssTotal - ssTreatment - ssBlock;

  // Degrees of freedom
  const dfTotal = N - 1;
  const dfTreatment = k - 1;
  const dfBlock = b - 1;
  const dfError = (k - 1) * (b - 1);

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

  let sigTreatment = 'ns';
  if (pTreatment !== null && pTreatment <= alpha) {
    sigTreatment = alpha <= 0.01 ? '**' : '*';
  }

  let sigBlock = 'ns';
  if (pBlock !== null && pBlock <= alpha) {
    sigBlock = alpha <= 0.01 ? '**' : '*';
  }

  const cv = coefficientOfVariation(grandMean, msError);

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
    treatmentNames,
    design: 'DBC',
  };
}

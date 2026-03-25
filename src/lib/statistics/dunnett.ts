/**
 * Dunnett's Test
 * Post-hoc comparison against a control treatment
 */

import { AnovaResult } from './anova';
import { FactorialAnovaResult } from './factorialAnova';

export interface DunnettComparison {
  treatmentName: string;
  mean: number;
  difference: number; // Mean - ControlMean
  dms: number;
  significant: boolean;
}

export interface DunnettResult {
  controlName: string;
  controlMean: number;
  dms05: number | null; // Null if unbalanced
  dms01: number | null;
  comparisons: DunnettComparison[];
  isFactorial?: boolean;
  mainA?: DunnettResult;
  mainB?: DunnettResult;
}

// Tabulated values of Dunnett's t-statistic for a two-sided test
// p is the number of treatment groups excluding the control group.
const DUNNETT_TABLE_005: Record<number, Record<number, number>> = {
  // df: { p: d_critical }
  5: { 1: 2.57, 2: 3.03, 3: 3.29, 4: 3.48, 5: 3.62, 6: 3.73, 7: 3.82, 8: 3.90, 9: 3.97, 10: 4.03, 11: 4.09, 12: 4.14, 15: 4.26, 20: 4.42 },
  6: { 1: 2.45, 2: 2.86, 3: 3.10, 4: 3.26, 5: 3.39, 6: 3.49, 7: 3.57, 8: 3.64, 9: 3.71, 10: 3.76, 11: 3.81, 12: 3.86, 15: 3.97, 20: 4.11 },
  7: { 1: 2.36, 2: 2.75, 3: 2.97, 4: 3.12, 5: 3.24, 6: 3.33, 7: 3.41, 8: 3.47, 9: 3.53, 10: 3.58, 11: 3.63, 12: 3.67, 15: 3.77, 20: 3.90 },
  8: { 1: 2.31, 2: 2.67, 3: 2.88, 4: 3.02, 5: 3.13, 6: 3.22, 7: 3.29, 8: 3.35, 9: 3.41, 10: 3.46, 11: 3.50, 12: 3.54, 15: 3.63, 20: 3.75 },
  9: { 1: 2.26, 2: 2.61, 3: 2.81, 4: 2.95, 5: 3.05, 6: 3.14, 7: 3.20, 8: 3.26, 9: 3.32, 10: 3.36, 11: 3.40, 12: 3.44, 15: 3.53, 20: 3.64 },
  10: { 1: 2.23, 2: 2.57, 3: 2.76, 4: 2.89, 5: 2.99, 6: 3.07, 7: 3.14, 8: 3.19, 9: 3.24, 10: 3.29, 11: 3.33, 12: 3.36, 15: 3.45, 20: 3.55 },
  11: { 1: 2.20, 2: 2.53, 3: 2.72, 4: 2.84, 5: 2.94, 6: 3.02, 7: 3.08, 8: 3.14, 9: 3.19, 10: 3.23, 11: 3.27, 12: 3.30, 15: 3.38, 20: 3.48 },
  12: { 1: 2.18, 2: 2.50, 3: 2.68, 4: 2.81, 5: 2.90, 6: 2.98, 7: 3.04, 8: 3.09, 9: 3.14, 10: 3.18, 11: 3.22, 12: 3.25, 15: 3.33, 20: 3.42 },
  13: { 1: 2.16, 2: 2.48, 3: 2.65, 4: 2.78, 5: 2.87, 6: 2.94, 7: 3.00, 8: 3.06, 9: 3.10, 10: 3.14, 11: 3.18, 12: 3.21, 15: 3.28, 20: 3.38 },
  14: { 1: 2.14, 2: 2.46, 3: 2.63, 4: 2.75, 5: 2.84, 6: 2.91, 7: 2.97, 8: 3.02, 9: 3.07, 10: 3.11, 11: 3.14, 12: 3.18, 15: 3.25, 20: 3.34 },
  15: { 1: 2.13, 2: 2.44, 3: 2.61, 4: 2.73, 5: 2.82, 6: 2.89, 7: 2.95, 8: 3.00, 9: 3.04, 10: 3.08, 11: 3.12, 12: 3.15, 15: 3.22, 20: 3.30 },
  16: { 1: 2.12, 2: 2.42, 3: 2.59, 4: 2.71, 5: 2.80, 6: 2.87, 7: 2.92, 8: 2.97, 9: 3.02, 10: 3.06, 11: 3.09, 12: 3.12, 15: 3.19, 20: 3.28 },
  17: { 1: 2.11, 2: 2.41, 3: 2.58, 4: 2.69, 5: 2.78, 6: 2.85, 7: 2.90, 8: 2.95, 9: 3.00, 10: 3.03, 11: 3.07, 12: 3.10, 15: 3.17, 20: 3.25 },
  18: { 1: 2.10, 2: 2.40, 3: 2.56, 4: 2.68, 5: 2.76, 6: 2.83, 7: 2.89, 8: 2.94, 9: 2.98, 10: 3.01, 11: 3.05, 12: 3.08, 15: 3.15, 20: 3.23 },
  19: { 1: 2.09, 2: 2.39, 3: 2.55, 4: 2.66, 5: 2.75, 6: 2.81, 7: 2.87, 8: 2.92, 9: 2.96, 10: 3.00, 11: 3.03, 12: 3.06, 15: 3.13, 20: 3.21 },
  20: { 1: 2.09, 2: 2.38, 3: 2.54, 4: 2.65, 5: 2.73, 6: 2.80, 7: 2.86, 8: 2.90, 9: 2.95, 10: 2.98, 11: 3.02, 12: 3.05, 15: 3.11, 20: 3.19 },
  24: { 1: 2.06, 2: 2.35, 3: 2.51, 4: 2.61, 5: 2.70, 6: 2.76, 7: 2.81, 8: 2.86, 9: 2.90, 10: 2.94, 11: 2.97, 12: 3.00, 15: 3.06, 20: 3.14 },
  30: { 1: 2.04, 2: 2.32, 3: 2.47, 4: 2.58, 5: 2.66, 6: 2.72, 7: 2.77, 8: 2.82, 9: 2.86, 10: 2.89, 11: 2.92, 12: 2.95, 15: 3.01, 20: 3.08 },
  40: { 1: 2.02, 2: 2.29, 3: 2.44, 4: 2.54, 5: 2.62, 6: 2.68, 7: 2.73, 8: 2.77, 9: 2.81, 10: 2.85, 11: 2.87, 12: 2.90, 15: 2.96, 20: 3.03 },
  60: { 1: 2.00, 2: 2.27, 3: 2.41, 4: 2.51, 5: 2.58, 6: 2.64, 7: 2.69, 8: 2.73, 9: 2.77, 10: 2.80, 11: 2.83, 12: 2.86, 15: 2.91, 20: 2.98 },
  120:{ 1: 1.98, 2: 2.24, 3: 2.38, 4: 2.47, 5: 2.55, 6: 2.60, 7: 2.65, 8: 2.69, 9: 2.73, 10: 2.76, 11: 2.79, 12: 2.81, 15: 2.86, 20: 2.93 },
  999:{ 1: 1.96, 2: 2.21, 3: 2.35, 4: 2.44, 5: 2.51, 6: 2.57, 7: 2.61, 8: 2.65, 9: 2.69, 10: 2.72, 11: 2.74, 12: 2.77, 15: 2.82, 20: 2.88 },
};

const DUNNETT_TABLE_001: Record<number, Record<number, number>> = {
  // df: { p: d_critical }
  5: { 1: 4.03, 2: 4.63, 3: 4.98, 4: 5.22, 5: 5.41, 6: 5.56, 7: 5.69, 8: 5.80, 9: 5.89, 10: 5.98, 15: 6.30, 20: 6.54 },
  6: { 1: 3.71, 2: 4.21, 3: 4.51, 4: 4.71, 5: 4.87, 6: 5.00, 7: 5.10, 8: 5.20, 9: 5.28, 10: 5.35, 15: 5.62, 20: 5.82 },
  7: { 1: 3.50, 2: 3.95, 3: 4.21, 4: 4.39, 5: 4.53, 6: 4.64, 7: 4.74, 8: 4.82, 9: 4.89, 10: 4.95, 15: 5.18, 20: 5.36 },
  8: { 1: 3.36, 2: 3.77, 3: 4.00, 4: 4.17, 5: 4.29, 6: 4.40, 7: 4.48, 8: 4.56, 9: 4.62, 10: 4.68, 15: 4.89, 20: 5.05 },
  9: { 1: 3.25, 2: 3.63, 3: 3.85, 4: 4.01, 5: 4.12, 6: 4.22, 7: 4.30, 8: 4.37, 9: 4.43, 10: 4.48, 15: 4.67, 20: 4.81 },
  10: { 1: 3.17, 2: 3.53, 3: 3.74, 4: 3.88, 5: 3.99, 6: 4.08, 7: 4.16, 8: 4.22, 9: 4.28, 10: 4.33, 15: 4.51, 20: 4.64 },
  11: { 1: 3.11, 2: 3.45, 3: 3.65, 4: 3.79, 5: 3.89, 6: 3.98, 7: 4.05, 8: 4.11, 9: 4.16, 10: 4.21, 15: 4.38, 20: 4.50 },
  12: { 1: 3.05, 2: 3.39, 3: 3.58, 4: 3.71, 5: 3.81, 6: 3.89, 7: 3.96, 8: 4.02, 9: 4.07, 10: 4.12, 15: 4.28, 20: 4.40 },
  13: { 1: 3.01, 2: 3.33, 3: 3.52, 4: 3.65, 5: 3.74, 6: 3.82, 7: 3.89, 8: 3.94, 9: 3.99, 10: 4.04, 15: 4.20, 20: 4.32 },
  14: { 1: 2.98, 2: 3.29, 3: 3.47, 4: 3.59, 5: 3.69, 6: 3.76, 7: 3.83, 8: 3.88, 9: 3.93, 10: 3.97, 15: 4.13, 20: 4.24 },
  15: { 1: 2.95, 2: 3.25, 3: 3.43, 4: 3.55, 5: 3.64, 6: 3.71, 7: 3.78, 8: 3.83, 9: 3.88, 10: 3.92, 15: 4.07, 20: 4.18 },
  16: { 1: 2.92, 2: 3.22, 3: 3.39, 4: 3.51, 5: 3.60, 6: 3.67, 7: 3.73, 8: 3.78, 9: 3.83, 10: 3.87, 15: 4.02, 20: 4.13 },
  17: { 1: 2.90, 2: 3.19, 3: 3.36, 4: 3.48, 5: 3.56, 6: 3.63, 7: 3.69, 8: 3.74, 9: 3.79, 10: 3.83, 15: 3.98, 20: 4.08 },
  18: { 1: 2.88, 2: 3.17, 3: 3.33, 4: 3.45, 5: 3.53, 6: 3.60, 7: 3.66, 8: 3.71, 9: 3.75, 10: 3.79, 15: 3.94, 20: 4.04 },
  19: { 1: 2.86, 2: 3.15, 3: 3.31, 4: 3.42, 5: 3.51, 6: 3.57, 7: 3.63, 8: 3.68, 9: 3.72, 10: 3.76, 15: 3.90, 20: 4.00 },
  20: { 1: 2.85, 2: 3.13, 3: 3.29, 4: 3.40, 5: 3.48, 6: 3.55, 7: 3.60, 8: 3.65, 9: 3.69, 10: 3.73, 15: 3.87, 20: 3.97 },
  24: { 1: 2.80, 2: 3.07, 3: 3.22, 4: 3.32, 5: 3.40, 6: 3.46, 7: 3.51, 8: 3.56, 9: 3.60, 10: 3.64, 15: 3.77, 20: 3.86 },
  30: { 1: 2.75, 2: 3.01, 3: 3.15, 4: 3.25, 5: 3.32, 6: 3.38, 7: 3.43, 8: 3.47, 9: 3.51, 10: 3.55, 15: 3.67, 20: 3.76 },
  40: { 1: 2.70, 2: 2.95, 3: 3.09, 4: 3.18, 5: 3.25, 6: 3.30, 7: 3.35, 8: 3.39, 9: 3.43, 10: 3.46, 15: 3.57, 20: 3.65 },
  60: { 1: 2.66, 2: 2.90, 3: 3.03, 4: 3.11, 5: 3.18, 6: 3.23, 7: 3.27, 8: 3.31, 9: 3.34, 10: 3.37, 15: 3.48, 20: 3.55 },
  120:{ 1: 2.62, 2: 2.84, 3: 2.96, 4: 3.04, 5: 3.10, 6: 3.15, 7: 3.19, 8: 3.23, 9: 3.26, 10: 3.29, 15: 3.38, 20: 3.45 },
  999:{ 1: 2.58, 2: 2.79, 3: 2.90, 4: 2.97, 5: 3.03, 6: 3.07, 7: 3.11, 8: 3.15, 9: 3.18, 10: 3.21, 15: 3.29, 20: 3.36 },
};

function closestDf(df: number, table: Record<number, Record<number, number>>): number {
  const available = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (df >= available[available.length - 1]) return available[available.length - 1];
  if (df <= available[0]) return available[0];

  let closest = available[0];
  for (const d of available) {
    if (d <= df) closest = d;
    else break;
  }
  return closest;
}

function getDunnettCriticalDoubleSided(alpha: number, p: number, df: number): number {
  const table = alpha <= 0.01 ? DUNNETT_TABLE_001 : DUNNETT_TABLE_005;
  const dfRow = table[closestDf(df, table)];
  
  if (!dfRow) return 2.5; // fallback
  
  // Interpolate / find closest p if exact match not available
  const availableP = Object.keys(dfRow).map(Number).sort((a, b) => a - b);
  if (p <= availableP[0]) return dfRow[availableP[0]];
  if (p >= availableP[availableP.length - 1]) return dfRow[availableP[availableP.length - 1]];

  let closestP = availableP[0];
  for (const pVal of availableP) {
    if (pVal <= p) closestP = pVal;
    else {
      // Linear interpolation between the two points could be done here,
      // but choosing the closest is often sufficient for practical purposes,
      // or we can just pick the next highest bounding for conservative approach.
      return dfRow[pVal]; // taking slightly higher conservative value
    }
  }
  return dfRow[closestP];
}

/**
 * Perform Dunnett's Test
 */
export function dunnettTest(
  anovaResult: AnovaResult | FactorialAnovaResult,
  data: (number | null)[][],
  controlTreatmentName: string,
  alpha: number = 0.05
): DunnettResult {
  const { mse, dfError, treatmentMeans, treatmentCounts, treatmentNames } = anovaResult;

  const baseResult = calculateDunnett(
    treatmentMeans, 
    treatmentCounts, 
    treatmentNames, 
    controlTreatmentName,
    mse, 
    dfError, 
    alpha
  );

  if ('factorialSignificance' in anovaResult) {
    const factAnova = anovaResult as FactorialAnovaResult;
    if (!factAnova.factorialSignificance.interaction) {
      baseResult.isFactorial = true;
      // Note: for factorial, we would ideally do it per factor. 
      // But typically Dunnett compares all combinations to one control combination.
      // So doing it by main factor might be weird, but for consistency we'll execute it 
      // if control matches one level. To avoid complexity and ambiguous use, factorial Dunnett
      // usually treats each combination as a distinct 'treatment'. We'll stick to full treatments
      // for factorial Dunnett and disable main factor breakdowns to avoid misinterpretation,
      // as Dunnett on factors means you'd need a "Control Level" for each factor.
      // E.g., Factor A control level, Factor B control level. Let's just do it globally for the interaction or treatments.
    }
  }

  return baseResult;
}

function calculateDunnett(
  treatmentMeans: number[],
  treatmentCounts: number[],
  treatmentNames: string[],
  controlName: string,
  mse: number,
  dfError: number,
  alpha: number
): DunnettResult {
  const controlIndex = treatmentNames.indexOf(controlName);
  if (controlIndex === -1) {
    throw new Error(`Testemunha Controle "${controlName}" não encontrada nos tratamentos.`);
  }

  const k = treatmentMeans.length;
  const p = k - 1; // excluding control

  const isBalanced = treatmentCounts.every(c => c === treatmentCounts[0]) && treatmentCounts[0] > 0;
  const rBalanced = isBalanced ? treatmentCounts[0] : 0;

  const d05 = getDunnettCriticalDoubleSided(0.05, p, dfError);
  const d01 = getDunnettCriticalDoubleSided(0.01, p, dfError);

  let globalDms05 = null;
  let globalDms01 = null;

  if (isBalanced) {
    globalDms05 = d05 * Math.sqrt((2 * mse) / rBalanced);
    globalDms01 = d01 * Math.sqrt((2 * mse) / rBalanced);
  }

  const comparisons: DunnettComparison[] = [];
  const controlMean = treatmentMeans[controlIndex];
  const controlCount = treatmentCounts[controlIndex];

  for (let i = 0; i < k; i++) {
    if (i === controlIndex) continue; // Skip comparing control to itself

    const diff = treatmentMeans[i] - controlMean; // To show positive/negative difference
    
    const dUsed = alpha <= 0.01 ? d01 : d05;
    const pairDms = dUsed * Math.sqrt(mse * (1 / treatmentCounts[i] + 1 / controlCount));

    comparisons.push({
      treatmentName: treatmentNames[i],
      mean: treatmentMeans[i],
      difference: diff,
      dms: pairDms,
      significant: Math.abs(diff) >= pairDms
    });
  }

  // Sort comparisons descending by mean for better readability in UI
  comparisons.sort((a, b) => b.mean - a.mean);

  return {
    controlName,
    controlMean,
    dms05: globalDms05,
    dms01: globalDms01,
    comparisons
  };
}

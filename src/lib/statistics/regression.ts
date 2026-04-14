import { AnovaResult, AnovaRow } from './anova';
import { fPValue } from './distributions';

export interface PolynomialModel {
  degree: number;
  name: string;
  equation: string;
  r2: number;
  coefficients: number[];
  optimalPoint: number | null;
  optimumType: 'maximum' | 'minimum' | null;

  // ANOVA parts
  ssModelTotal: number;

  // Sequential terms
  ssSequential: number;
  msSequential: number;
  fSequential: number;
  pSequential: number;

  ssDeviations: number;
  dfDeviations: number;
  msDeviations: number;
  fDeviations: number;
  pDeviations: number;
}

export interface RegressionResult {
  variableName: string;
  factorName: string | null;
  levelName?: string;
  models: PolynomialModel[];
  bestModelIndex: number;
  xValues: number[];       // unique treatment doses (sorted)
  observedMeans: number[]; // per-dose observed means
  mse: number;
  dfError: number;
  ssTreatments: number;
  dfTreatments: number;
}

// ─── Gaussian Elimination ────────────────────────────────────────────────────
function solveMatrix(A: number[][], B: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, B[i]]);

  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxEl) { maxEl = Math.abs(M[k][i]); maxRow = k; }
    }
    for (let k = i; k < n + 1; k++) {
      const tmp = M[maxRow][k]; M[maxRow][k] = M[i][k]; M[i][k] = tmp;
    }
    for (let k = i + 1; k < n; k++) {
      if (M[i][i] === 0) continue;
      const c = -M[k][i] / M[i][i];
      for (let j = i; j < n + 1; j++) {
        M[k][j] = i === j ? 0 : M[k][j] + c * M[i][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (M[i][i] === 0) { x[i] = 0; continue; }
    x[i] = M[i][n] / M[i][i];
    for (let k = i - 1; k >= 0; k--) M[k][n] -= M[k][i] * x[i];
  }
  return x;
}

// ─── Equation Formatter ──────────────────────────────────────────────────────
function fmt(v: number): string {
  if (v === 0) return '0';
  if (Math.abs(v) >= 0.001 && Math.abs(v) < 100000)
    return Number.isInteger(v) ? v.toString() : v.toFixed(4);
  return v.toExponential(4);
}

function formatEquation(coeffs: number[]): string {
  if (coeffs.length === 0) return 'ŷ = 0';
  let eq = `ŷ = ${fmt(coeffs[0])}`;
  for (let i = 1; i < coeffs.length; i++) {
    const val = coeffs[i];
    const sign = val >= 0 ? ' + ' : ' - ';
    const term = i === 1 ? 'x' : `x²`.replace('²', i === 2 ? '²' : `${i}`);
    eq += `${sign}${fmt(Math.abs(val))}${term}`;
  }
  return eq;
}

// ─── Main Regression Function (SISVAR-compatible) ───────────────────────────
/**
 * Receives raw individual observation pairs {x, y} for ONE qualitative level
 * (or the whole experiment if simple).
 *
 * Internally computes:
 *   - Pure Error SS / MSE  (within-dose replicates)
 *   - SS Treatments (between doses)
 *   - Sequential SS for each polynomial degree
 *   - Deviations from regression SS
 *
 * This exactly mirrors the SISVAR sequential polynomial regression approach.
 */
export function polynomialRegressionTask(
  rawObs: { x: number; y: number }[],
  variableName: string,
  factorName: string | null = null,
  maxDegree: number = 3,
  levelName?: string
): RegressionResult {
  if (rawObs.length < 3) {
    return {
      variableName, factorName, levelName, models: [], bestModelIndex: -1,
      xValues: [], observedMeans: [], mse: 0, dfError: 0, ssTreatments: 0, dfTreatments: 0
    };
  }

  // ── 1. Group by dose and compute means ─────────────────────────────────────
  const doseMap = new Map<number, number[]>();
  for (const { x, y } of rawObs) {
    if (!doseMap.has(x)) doseMap.set(x, []);
    doseMap.get(x)!.push(y);
  }

  const sortedDoses = Array.from(doseMap.keys()).sort((a, b) => a - b);
  const grandN = rawObs.length;
  const grandMean = rawObs.reduce((s, o) => s + o.y, 0) / grandN;
  const k = sortedDoses.length; // number of doses

  // ── 2. SS Treatments (between doses) ───────────────────────────────────────
  let ssTreatments = 0;
  const doseMeans: number[] = [];
  for (const x of sortedDoses) {
    const reps = doseMap.get(x)!;
    const mean = reps.reduce((s, v) => s + v, 0) / reps.length;
    doseMeans.push(mean);
    ssTreatments += reps.length * Math.pow(mean - grandMean, 2);
  }
  const dfTreatments = k - 1;

  // ── 3. Pure Error SS / MSE (within-dose replicates) ────────────────────────
  let ssError = 0;
  let dfError = 0;
  for (const x of sortedDoses) {
    const reps = doseMap.get(x)!;
    const mean = reps.reduce((s, v) => s + v, 0) / reps.length;
    for (const y of reps) ssError += Math.pow(y - mean, 2);
    dfError += reps.length - 1;
  }
  const mse = dfError > 0 ? ssError / dfError : 0;

  // ── 4. Build X and Y vectors (using raw obs for OLS) ────────────────────────
  // SISVAR fits the polynomial to the TREATMENT MEANS × n replications
  // (equivalent to fitting to all obs when each dose has equal reps).
  // We use dose means weighted by count, i.e. repeat the mean count times.
  const fitX: number[] = [];
  const fitY: number[] = [];
  for (const x of sortedDoses) {
    const reps = doseMap.get(x)!;
    const mean = reps.reduce((s, v) => s + v, 0) / reps.length;
    for (let i = 0; i < reps.length; i++) { fitX.push(x); fitY.push(mean); }
  }
  const fitN = fitX.length;
  const fitMean = fitY.reduce((s, v) => s + v, 0) / fitN;

  // ── 5. Sequential polynomial models ─────────────────────────────────────────
  const models: PolynomialModel[] = [];
  let prevSSModel = 0;
  const maxD = Math.min(maxDegree, k - 1);

  for (let d = 1; d <= maxD; d++) {
    // Design matrix for degree d
    const X_d: number[][] = fitX.map(xv => {
      const row: number[] = [];
      for (let j = 0; j <= d; j++) row.push(Math.pow(xv, j));
      return row;
    });

    // Normal equations: (X'X) β = X'Y
    const XtX = Array.from({ length: d + 1 }, () => new Array(d + 1).fill(0));
    const XtY = new Array(d + 1).fill(0);
    for (let i = 0; i < fitN; i++) {
      for (let j = 0; j <= d; j++) {
        for (let l = 0; l <= d; l++) XtX[j][l] += X_d[i][j] * X_d[i][l];
        XtY[j] += X_d[i][j] * fitY[i];
      }
    }

    let coeffs: number[];
    try { coeffs = solveMatrix(XtX, XtY); }
    catch { break; }

    // SS Model (cumulative) for degree d
    let ssModel = 0;
    for (let i = 0; i < fitN; i++) {
      let yhat = 0;
      for (let j = 0; j <= d; j++) yhat += coeffs[j] * X_d[i][j];
      ssModel += Math.pow(yhat - fitMean, 2);
    }

    // Sequential SS = increase from adding this degree
    let ssSeq = ssModel - prevSSModel;
    if (ssSeq < 0 && ssSeq > -1e-10) ssSeq = 0;
    const msSeq = ssSeq / 1;
    const fSeq = mse > 0 ? msSeq / mse : 0;
    const pSeq = fSeq > 0 ? fPValue(fSeq, 1, dfError) : 1;

    // Deviations SS (lack-of-fit for this degree)
    let ssDev = ssTreatments - ssModel;
    if (ssDev < 0 && ssDev > -1e-10) ssDev = 0;
    const dfDev = dfTreatments - d;
    const msDev = dfDev > 0 ? ssDev / dfDev : 0;
    const fDev = mse > 0 ? msDev / mse : 0;
    const pDev = dfDev > 0 ? fPValue(fDev, dfDev, dfError) : 1;

    // R² relative to SS Treatments
    const r2 = ssTreatments > 0 ? ssModel / ssTreatments : 0;

    // Optimal point for quadratic
    let optPoint: number | null = null;
    let optType: 'maximum' | 'minimum' | null = null;
    if (d === 2 && coeffs[2] !== 0) {
      optPoint = -coeffs[1] / (2 * coeffs[2]);
      optType = coeffs[2] > 0 ? 'minimum' : 'maximum';
    }

    const degreeNames = ['', 'Linear', 'Quadrática', 'Cúbica'];
    models.push({
      degree: d,
      name: degreeNames[d] || `Grau ${d}`,
      equation: formatEquation(coeffs),
      r2,
      coefficients: coeffs,
      optimalPoint: optPoint,
      optimumType: optType,
      ssModelTotal: ssModel,
      ssSequential: ssSeq,
      msSequential: msSeq,
      fSequential: fSeq,
      pSequential: pSeq,
      ssDeviations: ssDev,
      dfDeviations: dfDev,
      msDeviations: msDev,
      fDeviations: fDev,
      pDeviations: pDev,
    });

    prevSSModel = ssModel;
  }

  // ── 6. Best model selection (SISVAR criteria) ────────────────────────────────
  // Highest degree with significant sequential P (< 0.05).
  // Also deviations should NOT be significant (lack of fit acceptable).
  // If no model passes, fall back to the highest-degree model anyway for plotting.
  let bestModelIndex = -1;
  const numDoses = sortedDoses.length;
  
  for (let i = models.length - 1; i >= 0; i--) {
    // Evita selecionar o grau máximo (k-1) se for > 1 (ex: cúbico para 4 doses),
    // pois isso interpola os pontos e dá R²=100%, o que geralmente é um superajuste na biologia.
    // Só ignora se algum modelo de grau menor também for significativo.
    if (models[i].degree === numDoses - 1 && models[i].degree > 1) {
      let lowerSignificant = false;
      for (let j = i - 1; j >= 0; j--) {
        if (models[j].pSequential <= 0.05) {
          lowerSignificant = true;
          break;
        }
      }
      if (lowerSignificant) continue;
    }

    if (models[i].pSequential <= 0.05) {
      bestModelIndex = i;
      break;
    }
  }
  // Fallback: if nothing significant but we have models, use best R²
  if (bestModelIndex === -1 && models.length > 0) {
    let bestR2 = -1;
    models.forEach((m, idx) => {
      if (m.r2 > bestR2) { bestR2 = m.r2; bestModelIndex = idx; }
    });
  }

  return {
    variableName,
    factorName,
    levelName,
    models,
    bestModelIndex,
    xValues: sortedDoses,
    observedMeans: doseMeans,
    mse,
    dfError,
    ssTreatments,
    dfTreatments,
  };
}

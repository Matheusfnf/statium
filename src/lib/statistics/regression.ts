import { AnovaResult, AnovaRow } from './anova';
import { mean, sum } from './utils';
import { fPValue, fCritical } from './distributions';

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
  models: PolynomialModel[];
  bestModelIndex: number; // Highest valid degree
  xValues: number[]; // original treatment doses
  observedMeans: number[];
  mse: number;
  dfError: number;
  ssTreatments: number;
  dfTreatments: number;
}

// Solves Ax = B using Gaussian elimination
function solveMatrix(A: number[][], B: number[]): number[] {
  const n = A.length;
  // Augment matrix
  const M = A.map((row, i) => [...row, B[i]]);

  for (let i = 0; i < n; i++) {
    // Search for maximum in this column
    let maxEl = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxEl) {
        maxEl = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    for (let k = i; k < n + 1; k++) {
      const tmp = M[maxRow][k];
      M[maxRow][k] = M[i][k];
      M[i][k] = tmp;
    }

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      if (M[i][i] === 0) continue;
      const c = -M[k][i] / M[i][i];
      for (let j = i; j < n + 1; j++) {
        if (i === j) {
          M[k][j] = 0;
        } else {
          M[k][j] += c * M[i][j];
        }
      }
    }
  }

  // Solve equation Mx = y
  const x = new Array(n).fill(0);
  for (let i = n - 1; i > -1; i--) {
    if (M[i][i] === 0) {
       x[i] = 0;
       continue;
    }
    x[i] = M[i][n] / M[i][i];
    for (let k = i - 1; k > -1; k--) {
      M[k][n] -= M[k][i] * x[i];
    }
  }
  return x;
}

// Compute string equation
function formatEquation(coeffs: number[]): string {
  if (coeffs.length === 0) return 'y = 0';
  
  let eq = `y = ${formatNumberForEq(coeffs[0])}`;

  for (let i = 1; i < coeffs.length; i++) {
    const val = coeffs[i];
    const sign = val >= 0 ? '+' : '-';
    let valStr = formatNumberForEq(Math.abs(val));
    
    eq += ` ${sign} ${valStr}x`;
    if (i > 1) eq += `^${i}`;
  }
  return eq;
}

function formatNumberForEq(v: number): string {
  if (v === 0) return '0';
  if (Math.abs(v) > 0.001 && Math.abs(v) < 10000) {
    return Number.isInteger(v) ? v.toString() : v.toFixed(4);
  }
  return v.toExponential(4).replace(/e\+?0*/, 'e');
}

/**
 * Computes Sequential Polynomial Regression mimicking SISVAR outputs
 */
export function polynomialRegressionTask(
  treatmentData: { x: number, mean: number, count: number }[],
  anovaTotal: { mse: number, dfError: number, ssTreatments: number, dfTreatments: number },
  variableName: string,
  factorName: string | null = null,
  maxDegree: number = 2
): RegressionResult {
  const sorted = [...treatmentData].sort((a, b) => a.x - b.x);
  
  const rawX: number[] = [];
  const rawY: number[] = [];
  let grandSum = 0;
  let N = 0;

  // We unpack means into raw values to calculate proper Model SS
  // Because Regression SS in ANOVA is based on all values (replications)
  sorted.forEach(t => {
    for (let i = 0; i < t.count; i++) {
      rawX.push(t.x);
      rawY.push(t.mean); // using mean replication represents treatment effect exactly since Deviations from regression capture treatment SS variations
      grandSum += t.mean;
      N++;
    }
  });

  const rawYMean = grandSum / N;
  const models: PolynomialModel[] = [];
  
  let previousSSModel = 0;

  for (let d = 1; d <= maxDegree; d++) {
    // If dfTreatments <= degree, we can't test deviation or test this degree properly (requires enough points)
    if (anovaTotal.dfTreatments < d) break;

    // Polynomial matrix X for degree d
    const X: number[][] = rawX.map(xVal => {
      const row = [];
      for (let j = 0; j <= d; j++) row.push(Math.pow(xVal, j));
      return row;
    });

    // Create X^T * X and X^T * Y
    const XT_X: number[][] = Array(d + 1).fill(0).map(() => Array(d + 1).fill(0));
    const XT_Y: number[] = Array(d + 1).fill(0);

    for (let i = 0; i < N; i++) {
      for (let j = 0; j <= d; j++) {
        for (let k = 0; k <= d; k++) {
          XT_X[j][k] += X[i][j] * X[i][k];
        }
        XT_Y[j] += X[i][j] * rawY[i];
      }
    }

    try {
      const coeffs = solveMatrix(XT_X, XT_Y);
      
      // Calculate SS Model (Complete model of degree d)
      let ssModelTotal = 0;
      for (let i = 0; i < N; i++) {
        let yPred = 0;
        for (let j = 0; j <= d; j++) yPred += coeffs[j] * X[i][j];
        ssModelTotal += Math.pow(yPred - rawYMean, 2);
      }

      // Sequential Sum of Squares
      // Protect against floating point inaccuracy causing tiny negative numbers
      let ssSequential = ssModelTotal - previousSSModel;
      if (ssSequential < 0 && ssSequential > -1e-10) ssSequential = 0;

      const msSequential = ssSequential / 1; // df is always 1 for each added degree
      const fSequential = anovaTotal.mse > 0 ? msSequential / anovaTotal.mse : 0;
      const pSequential = fSequential > 0 ? fPValue(fSequential, 1, anovaTotal.dfError) : 1;

      // Deviations Sum of Squares
      let ssDeviations = anovaTotal.ssTreatments - ssModelTotal;
      if (ssDeviations < 0 && ssDeviations > -1e-10) ssDeviations = 0;

      const dfDeviations = anovaTotal.dfTreatments - d;
      const msDeviations = dfDeviations > 0 ? ssDeviations / dfDeviations : 0;
      const fDeviations = anovaTotal.mse > 0 ? msDeviations / anovaTotal.mse : 0;
      const pDeviations = dfDeviations > 0 ? fPValue(fDeviations, dfDeviations, anovaTotal.dfError) : 1;

      const r2 = anovaTotal.ssTreatments > 0 ? ssModelTotal / anovaTotal.ssTreatments : 0;
      
      let optPoint: number | null = null;
      let optType: 'maximum' | 'minimum' | null = null;
      if (d === 2 && coeffs[2] !== 0) {
        optPoint = -coeffs[1] / (2 * coeffs[2]);
        optType = coeffs[2] > 0 ? 'minimum' : 'maximum';
      }

      const degreeNames = ['Média', 'Linear', 'Quadrática', 'Cúbica'];

      models.push({
        degree: d,
        name: degreeNames[d] || `Grau ${d}`,
        equation: formatEquation(coeffs),
        r2,
        coefficients: coeffs,
        optimalPoint: optPoint,
        optimumType: optType,
        ssModelTotal,
        ssSequential,
        msSequential,
        fSequential,
        pSequential,
        ssDeviations,
        dfDeviations,
        msDeviations,
        fDeviations,
        pDeviations
      });

      previousSSModel = ssModelTotal;

    } catch (e) {
      console.warn("Could not solve matrix for degree", d, e);
      break;
    }
  }

  // Find best model: 
  // Agronomic criteria: significant Sequential P-value (< 0.05). If multiple, take the highest degree that has a significant sequential P.
  let bestModelIndex = -1;
  const alphaCriteria = 0.05;
  for (let i = models.length - 1; i >= 0; i--) {
     if (models[i].pSequential <= alphaCriteria) {
        bestModelIndex = i;
        break;
     }
  }

  return {
    variableName,
    factorName,
    models,
    bestModelIndex,
    xValues: sorted.map(t => t.x),
    observedMeans: sorted.map(t => t.mean),
    mse: anovaTotal.mse,
    dfError: anovaTotal.dfError,
    ssTreatments: anovaTotal.ssTreatments,
    dfTreatments: anovaTotal.dfTreatments
  };
}

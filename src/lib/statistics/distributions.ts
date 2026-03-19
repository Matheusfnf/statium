/**
 * Statistical distribution functions
 * Implementations of F-distribution CDF, Studentized Range (q) critical values,
 * and Chi-squared distribution for Scott-Knott.
 */

// ============================================================
// Gamma and Beta functions (needed for F-distribution CDF)
// ============================================================

function logGamma(x: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }

  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function gamma(x: number): number {
  return Math.exp(logGamma(x));
}

/**
 * Regularized incomplete beta function using continued fraction (Lentz's method)
 */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x === 0 || x === 1) return x;

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(b, a, 1 - x);
  }

  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Lentz's continued fraction
  let f = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let i = 1; i <= 200; i++) {
    const m = i;
    // even step
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= c * d;

    // odd step
    numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return front * f;
}

// ============================================================
// F-distribution
// ============================================================

/**
 * CDF of the F-distribution
 */
export function fDistributionCDF(f: number, df1: number, df2: number): number {
  if (f <= 0) return 0;
  const x = (df1 * f) / (df1 * f + df2);
  return incompleteBeta(df1 / 2, df2 / 2, x);
}

/**
 * p-value from F-statistic (upper tail)
 */
export function fPValue(f: number, df1: number, df2: number): number {
  return 1 - fDistributionCDF(f, df1, df2);
}

/**
 * Critical F-value for a given alpha (upper tail)
 * Uses bisection method
 */
export function fCritical(alpha: number, df1: number, df2: number): number {
  let low = 0;
  let high = 100;

  // expand high if needed
  while (fPValue(high, df1, df2) > alpha) {
    high *= 2;
  }

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const p = fPValue(mid, df1, df2);
    if (Math.abs(p - alpha) < 1e-8) return mid;
    if (p > alpha) low = mid;
    else high = mid;
  }

  return (low + high) / 2;
}

// ============================================================
// Studentized Range Distribution (for Tukey HSD)
// ============================================================

/**
 * Critical values for the Studentized Range distribution q(alpha, k, df)
 * Using tabulated values for alpha = 0.05 and 0.01
 * k = number of treatments (2-20), df = degrees of freedom for error
 */
const TUKEY_TABLE_005: Record<number, Record<number, number>> = {
  // df: { k: q_critical }
  5:  { 2: 3.64, 3: 4.60, 4: 5.22, 5: 5.67, 6: 6.03, 7: 6.33, 8: 6.58, 9: 6.80, 10: 6.99, 11: 7.17, 12: 7.32, 13: 7.47, 14: 7.60, 15: 7.72, 16: 7.83, 17: 7.93, 18: 8.03, 19: 8.12, 20: 8.21 },
  6:  { 2: 3.46, 3: 4.34, 4: 4.90, 5: 5.30, 6: 5.63, 7: 5.90, 8: 6.12, 9: 6.32, 10: 6.49, 11: 6.65, 12: 6.79, 13: 6.92, 14: 7.03, 15: 7.14, 16: 7.24, 17: 7.34, 18: 7.43, 19: 7.51, 20: 7.59 },
  7:  { 2: 3.34, 3: 4.16, 4: 4.68, 5: 5.06, 6: 5.36, 7: 5.61, 8: 5.82, 9: 6.00, 10: 6.16, 11: 6.30, 12: 6.43, 13: 6.55, 14: 6.66, 15: 6.76, 16: 6.85, 17: 6.94, 18: 7.02, 19: 7.10, 20: 7.17 },
  8:  { 2: 3.26, 3: 4.04, 4: 4.53, 5: 4.89, 6: 5.17, 7: 5.40, 8: 5.60, 9: 5.77, 10: 5.92, 11: 6.05, 12: 6.18, 13: 6.29, 14: 6.39, 15: 6.48, 16: 6.57, 17: 6.65, 18: 6.73, 19: 6.80, 20: 6.87 },
  9:  { 2: 3.20, 3: 3.95, 4: 4.41, 5: 4.76, 6: 5.02, 7: 5.24, 8: 5.43, 9: 5.59, 10: 5.74, 11: 5.87, 12: 5.98, 13: 6.09, 14: 6.19, 15: 6.28, 16: 6.36, 17: 6.44, 18: 6.51, 19: 6.58, 20: 6.64 },
  10: { 2: 3.15, 3: 3.88, 4: 4.33, 5: 4.65, 6: 4.91, 7: 5.12, 8: 5.30, 9: 5.46, 10: 5.60, 11: 5.72, 12: 5.83, 13: 5.93, 14: 6.03, 15: 6.11, 16: 6.19, 17: 6.27, 18: 6.34, 19: 6.40, 20: 6.47 },
  11: { 2: 3.11, 3: 3.82, 4: 4.26, 5: 4.57, 6: 4.82, 7: 5.03, 8: 5.20, 9: 5.35, 10: 5.49, 11: 5.61, 12: 5.71, 13: 5.81, 14: 5.90, 15: 5.98, 16: 6.06, 17: 6.13, 18: 6.20, 19: 6.27, 20: 6.33 },
  12: { 2: 3.08, 3: 3.77, 4: 4.20, 5: 4.51, 6: 4.75, 7: 4.95, 8: 5.12, 9: 5.27, 10: 5.39, 11: 5.51, 12: 5.61, 13: 5.71, 14: 5.80, 15: 5.88, 16: 5.95, 17: 6.02, 18: 6.09, 19: 6.15, 20: 6.21 },
  13: { 2: 3.06, 3: 3.73, 4: 4.15, 5: 4.45, 6: 4.69, 7: 4.88, 8: 5.05, 9: 5.19, 10: 5.32, 11: 5.43, 12: 5.53, 13: 5.63, 14: 5.71, 15: 5.79, 16: 5.86, 17: 5.93, 18: 5.99, 19: 6.05, 20: 6.11 },
  14: { 2: 3.03, 3: 3.70, 4: 4.11, 5: 4.41, 6: 4.64, 7: 4.83, 8: 4.99, 9: 5.13, 10: 5.25, 11: 5.36, 12: 5.46, 13: 5.55, 14: 5.64, 15: 5.71, 16: 5.79, 17: 5.85, 18: 5.91, 19: 5.97, 20: 6.03 },
  15: { 2: 3.01, 3: 3.67, 4: 4.08, 5: 4.37, 6: 4.59, 7: 4.78, 8: 4.94, 9: 5.08, 10: 5.20, 11: 5.31, 12: 5.40, 13: 5.49, 14: 5.57, 15: 5.65, 16: 5.72, 17: 5.78, 18: 5.85, 19: 5.90, 20: 5.96 },
  16: { 2: 3.00, 3: 3.65, 4: 4.05, 5: 4.33, 6: 4.56, 7: 4.74, 8: 4.90, 9: 5.03, 10: 5.15, 11: 5.26, 12: 5.35, 13: 5.44, 14: 5.52, 15: 5.59, 16: 5.66, 17: 5.73, 18: 5.79, 19: 5.84, 20: 5.90 },
  17: { 2: 2.98, 3: 3.63, 4: 4.02, 5: 4.30, 6: 4.52, 7: 4.70, 8: 4.86, 9: 4.99, 10: 5.11, 11: 5.21, 12: 5.31, 13: 5.39, 14: 5.47, 15: 5.54, 16: 5.61, 17: 5.67, 18: 5.73, 19: 5.79, 20: 5.84 },
  18: { 2: 2.97, 3: 3.61, 4: 4.00, 5: 4.28, 6: 4.49, 7: 4.67, 8: 4.82, 9: 4.96, 10: 5.07, 11: 5.17, 12: 5.27, 13: 5.35, 14: 5.43, 15: 5.50, 16: 5.57, 17: 5.63, 18: 5.69, 19: 5.74, 20: 5.79 },
  19: { 2: 2.96, 3: 3.59, 4: 3.98, 5: 4.25, 6: 4.47, 7: 4.65, 8: 4.79, 9: 4.92, 10: 5.04, 11: 5.14, 12: 5.23, 13: 5.31, 14: 5.39, 15: 5.46, 16: 5.53, 17: 5.59, 18: 5.65, 19: 5.70, 20: 5.75 },
  20: { 2: 2.95, 3: 3.58, 4: 3.96, 5: 4.23, 6: 4.45, 7: 4.62, 8: 4.77, 9: 4.90, 10: 5.01, 11: 5.11, 12: 5.20, 13: 5.28, 14: 5.36, 15: 5.43, 16: 5.49, 17: 5.55, 18: 5.61, 19: 5.66, 20: 5.71 },
  24: { 2: 2.92, 3: 3.53, 4: 3.90, 5: 4.17, 6: 4.37, 7: 4.54, 8: 4.68, 9: 4.81, 10: 4.92, 11: 5.01, 12: 5.10, 13: 5.18, 14: 5.25, 15: 5.32, 16: 5.38, 17: 5.44, 18: 5.49, 19: 5.55, 20: 5.59 },
  30: { 2: 2.89, 3: 3.49, 4: 3.85, 5: 4.10, 6: 4.30, 7: 4.46, 8: 4.60, 9: 4.72, 10: 4.82, 11: 4.92, 12: 5.00, 13: 5.08, 14: 5.15, 15: 5.21, 16: 5.27, 17: 5.33, 18: 5.38, 19: 5.43, 20: 5.47 },
  40: { 2: 2.86, 3: 3.44, 4: 3.79, 5: 4.04, 6: 4.23, 7: 4.39, 8: 4.52, 9: 4.63, 10: 4.73, 11: 4.82, 12: 4.90, 13: 4.98, 14: 5.04, 15: 5.11, 16: 5.16, 17: 5.22, 18: 5.27, 19: 5.31, 20: 5.36 },
  60: { 2: 2.83, 3: 3.40, 4: 3.74, 5: 3.98, 6: 4.16, 7: 4.31, 8: 4.44, 9: 4.55, 10: 4.65, 11: 4.73, 12: 4.81, 13: 4.88, 14: 4.94, 15: 5.00, 16: 5.06, 17: 5.11, 18: 5.15, 19: 5.20, 20: 5.24 },
  120:{ 2: 2.80, 3: 3.36, 4: 3.68, 5: 3.92, 6: 4.10, 7: 4.24, 8: 4.36, 9: 4.47, 10: 4.56, 11: 4.64, 12: 4.71, 13: 4.78, 14: 4.84, 15: 4.90, 16: 4.95, 17: 5.00, 18: 5.04, 19: 5.09, 20: 5.13 },
  999:{ 2: 2.77, 3: 3.31, 4: 3.63, 5: 3.86, 6: 4.03, 7: 4.17, 8: 4.29, 9: 4.39, 10: 4.47, 11: 4.55, 12: 4.62, 13: 4.68, 14: 4.74, 15: 4.80, 16: 4.85, 17: 4.89, 18: 4.93, 19: 4.97, 20: 5.01 },
};

const TUKEY_TABLE_001: Record<number, Record<number, number>> = {
  5:  { 2: 5.70, 3: 6.98, 4: 7.80, 5: 8.42, 6: 8.91, 7: 9.32, 8: 9.67, 9: 9.97, 10: 10.24, 11: 10.48, 12: 10.70, 13: 10.89, 14: 11.08, 15: 11.24, 16: 11.40, 17: 11.55, 18: 11.68, 19: 11.81, 20: 11.93 },
  6:  { 2: 5.24, 3: 6.33, 4: 7.03, 5: 7.56, 6: 7.97, 7: 8.32, 8: 8.61, 9: 8.87, 10: 9.10, 11: 9.30, 12: 9.48, 13: 9.65, 14: 9.81, 15: 9.95, 16: 10.08, 17: 10.21, 18: 10.32, 19: 10.43, 20: 10.54 },
  7:  { 2: 4.95, 3: 5.92, 4: 6.54, 5: 7.01, 6: 7.37, 7: 7.68, 8: 7.94, 9: 8.17, 10: 8.37, 11: 8.55, 12: 8.71, 13: 8.86, 14: 9.00, 15: 9.12, 16: 9.24, 17: 9.35, 18: 9.46, 19: 9.55, 20: 9.65 },
  8:  { 2: 4.75, 3: 5.64, 4: 6.20, 5: 6.62, 6: 6.96, 7: 7.24, 8: 7.47, 9: 7.68, 10: 7.86, 11: 8.03, 12: 8.18, 13: 8.31, 14: 8.44, 15: 8.55, 16: 8.66, 17: 8.76, 18: 8.85, 19: 8.94, 20: 9.03 },
  9:  { 2: 4.60, 3: 5.43, 4: 5.96, 5: 6.35, 6: 6.66, 7: 6.91, 8: 7.13, 9: 7.33, 10: 7.49, 11: 7.65, 12: 7.78, 13: 7.91, 14: 8.03, 15: 8.13, 16: 8.23, 17: 8.33, 18: 8.41, 19: 8.49, 20: 8.57 },
  10: { 2: 4.48, 3: 5.27, 4: 5.77, 5: 6.14, 6: 6.43, 7: 6.67, 8: 6.87, 9: 7.05, 10: 7.21, 11: 7.36, 12: 7.49, 13: 7.60, 14: 7.71, 15: 7.81, 16: 7.91, 17: 7.99, 18: 8.08, 19: 8.15, 20: 8.23 },
  12: { 2: 4.32, 3: 5.05, 4: 5.50, 5: 5.84, 6: 6.10, 7: 6.32, 8: 6.51, 9: 6.67, 10: 6.81, 11: 6.94, 12: 7.06, 13: 7.17, 14: 7.26, 15: 7.36, 16: 7.44, 17: 7.52, 18: 7.59, 19: 7.66, 20: 7.73 },
  14: { 2: 4.21, 3: 4.89, 4: 5.32, 5: 5.63, 6: 5.88, 7: 6.08, 8: 6.26, 9: 6.41, 10: 6.54, 11: 6.66, 12: 6.77, 13: 6.87, 14: 6.96, 15: 7.05, 16: 7.13, 17: 7.20, 18: 7.27, 19: 7.33, 20: 7.39 },
  16: { 2: 4.13, 3: 4.79, 4: 5.19, 5: 5.49, 6: 5.72, 7: 5.92, 8: 6.08, 9: 6.22, 10: 6.35, 11: 6.46, 12: 6.56, 13: 6.66, 14: 6.74, 15: 6.82, 16: 6.90, 17: 6.97, 18: 7.03, 19: 7.09, 20: 7.15 },
  18: { 2: 4.07, 3: 4.70, 4: 5.09, 5: 5.38, 6: 5.60, 7: 5.79, 8: 5.94, 9: 6.08, 10: 6.20, 11: 6.31, 12: 6.41, 13: 6.50, 14: 6.58, 15: 6.65, 16: 6.73, 17: 6.79, 18: 6.85, 19: 6.91, 20: 6.97 },
  20: { 2: 4.02, 3: 4.64, 4: 5.02, 5: 5.29, 6: 5.51, 7: 5.69, 8: 5.84, 9: 5.97, 10: 6.09, 11: 6.19, 12: 6.28, 13: 6.37, 14: 6.45, 15: 6.52, 16: 6.59, 17: 6.65, 18: 6.71, 19: 6.77, 20: 6.82 },
  24: { 2: 3.96, 3: 4.55, 4: 4.91, 5: 5.17, 6: 5.37, 7: 5.54, 8: 5.69, 9: 5.81, 10: 5.92, 11: 6.02, 12: 6.11, 13: 6.19, 14: 6.26, 15: 6.33, 16: 6.39, 17: 6.45, 18: 6.51, 19: 6.56, 20: 6.61 },
  30: { 2: 3.89, 3: 4.45, 4: 4.80, 5: 5.05, 6: 5.24, 7: 5.40, 8: 5.54, 9: 5.65, 10: 5.76, 11: 5.85, 12: 5.93, 13: 6.01, 14: 6.08, 15: 6.14, 16: 6.20, 17: 6.26, 18: 6.31, 19: 6.36, 20: 6.41 },
  40: { 2: 3.82, 3: 4.37, 4: 4.70, 5: 4.93, 6: 5.11, 7: 5.26, 8: 5.39, 9: 5.50, 10: 5.60, 11: 5.69, 12: 5.76, 13: 5.83, 14: 5.90, 15: 5.96, 16: 6.02, 17: 6.07, 18: 6.12, 19: 6.16, 20: 6.21 },
  60: { 2: 3.76, 3: 4.28, 4: 4.59, 5: 4.82, 6: 4.99, 7: 5.13, 8: 5.25, 9: 5.36, 10: 5.45, 11: 5.53, 12: 5.60, 13: 5.67, 14: 5.73, 15: 5.78, 16: 5.84, 17: 5.89, 18: 5.93, 19: 5.97, 20: 6.01 },
  120:{ 2: 3.70, 3: 4.20, 4: 4.50, 5: 4.71, 6: 4.87, 7: 5.01, 8: 5.12, 9: 5.21, 10: 5.30, 11: 5.37, 12: 5.44, 13: 5.50, 14: 5.56, 15: 5.61, 16: 5.66, 17: 5.71, 18: 5.75, 19: 5.79, 20: 5.83 },
  999:{ 2: 3.64, 3: 4.12, 4: 4.40, 5: 4.60, 6: 4.76, 7: 4.88, 8: 4.99, 9: 5.08, 10: 5.16, 11: 5.23, 12: 5.29, 13: 5.35, 14: 5.40, 15: 5.45, 16: 5.49, 17: 5.54, 18: 5.57, 19: 5.61, 20: 5.65 },
};

/**
 * Get the closest available df in the Tukey table
 */
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

/**
 * Get the Studentized Range critical value q(alpha, k, df)
 */
export function qCritical(alpha: number, k: number, df: number): number {
  const table = alpha <= 0.01 ? TUKEY_TABLE_001 : TUKEY_TABLE_005;
  const closeDf = closestDf(df, table);
  const row = table[closeDf];

  if (!row) return 3.0; // fallback
  const clampedK = Math.min(Math.max(k, 2), 20);
  return row[clampedK] ?? 3.0;
}

// ============================================================
// Chi-squared distribution (for Scott-Knott)
// ============================================================

/**
 * Chi-squared CDF using regularized incomplete gamma function
 */
export function chiSquaredCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  return regularizedGammaP(df / 2, x / 2);
}

export function chiSquaredPValue(x: number, df: number): number {
  return 1 - chiSquaredCDF(x, df);
}

/**
 * Regularized lower incomplete gamma function P(a, x)
 * Using series expansion for small x and continued fraction for large x
 */
function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Series expansion
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  } else {
    // Continued fraction (Lentz's method)
    return 1 - regularizedGammaQ(a, x);
  }
}

function regularizedGammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) return 1 - regularizedGammaP(a, x);

  let tiny = 1e-30;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;

  for (let i = 1; i <= 200; i++) {
    let an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    let delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  
  const result = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  return Math.min(1, Math.max(0, result));
}

// ============================================================
// Normal distribution
// ============================================================

/**
 * Normal Cumulative Distribution Function approximation
 * Given a Z-score, returns the cumulative probability.
 */
export function normalCDF(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + 0.5 * absX);
  
  // Horner's method for error function approximation
  const erfApprox = t * Math.exp(-absX * absX - 1.26551223 +
    t * (1.00002368 +
      t * (0.37409196 +
        t * (0.09678418 +
          t * (-0.18628806 +
            t * (0.27886807 +
              t * (-1.13520398 +
                t * (1.48851587 +
                  t * (-0.82215223 +
                    t * 0.17087277)))))))));
                    
  const errorFn = 1 - erfApprox;
  return 0.5 * (1 + sign * errorFn);
}

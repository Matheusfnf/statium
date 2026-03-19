/**
 * Statistical utility functions
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

export function sumOfSquares(values: number[]): number {
  const m = mean(values);
  return values.reduce((ss, v) => ss + (v - m) ** 2, 0);
}

export function variance(values: number[], ddof: number = 1): number {
  if (values.length <= ddof) return 0;
  const m = mean(values);
  return values.reduce((ss, v) => ss + (v - m) ** 2, 0) / (values.length - ddof);
}

export function standardDeviation(values: number[], ddof: number = 1): number {
  return Math.sqrt(variance(values, ddof));
}

export function standardError(values: number[], ddof: number = 1): number {
  return standardDeviation(values, ddof) / Math.sqrt(values.length);
}

export function flattenMatrix(matrix: number[][]): number[] {
  return matrix.reduce((flat, row) => [...flat, ...row], []);
}

export function formatNumber(value: number, decimals: number = 4): string {
  return value.toFixed(decimals);
}

export function coefficientOfVariation(overallMean: number, mse: number): number {
  if (overallMean === 0) return 0;
  return (Math.sqrt(mse) / overallMean) * 100;
}

/**
 * Assign significance letters to groups based on sorted means
 * and a boolean matrix of significant differences.
 */
export function assignLetters(
  means: { index: number; mean: number }[],
  isSignificant: (i: number, j: number) => boolean
): string[] {
  const n = means.length;
  const sorted = [...means].sort((a, b) => a.mean - b.mean);
  const letters: Set<string>[] = Array.from({ length: n }, () => new Set());
  let currentLetter = 0;

  for (let i = 0; i < n; i++) {
    if (letters[sorted[i].index].size === 0) {
      const letter = String.fromCharCode(97 + currentLetter);
      letters[sorted[i].index].add(letter);

      for (let j = i + 1; j < n; j++) {
        if (!isSignificant(sorted[i].index, sorted[j].index)) {
          letters[sorted[j].index].add(letter);
        }
      }
      currentLetter++;
    }
  }

  // Consolidate: check that each group is valid
  const result: string[] = Array(n).fill('');
  for (let i = 0; i < n; i++) {
    result[i] = Array.from(letters[i]).sort().join('');
  }

  return result;
}

/**
 * Scott-Knott clustering test
 * Groups treatment means into non-overlapping clusters
 */

import { mean as calcMean } from './utils';
import { chiSquaredPValue } from './distributions';
import { AnovaResult } from './anova';

export interface ScottKnottGroup {
  treatmentName: string;
  treatmentIndex: number;
  mean: number;
  group: number;
  letter: string;
}

export interface ScottKnottResult {
  groups: ScottKnottGroup[];
  numGroups: number;
}

/**
 * Perform Scott-Knott clustering test
 * The algorithm works by recursively partitioning a sorted set of means
 * at the point that maximizes the between-group sum of squares,
 * testing significance with a chi-squared-like criterion.
 */
export function scottKnott(
  anovaResult: AnovaResult,
  data: number[][],
  alpha: number = 0.05
): ScottKnottResult {
  const { mse, dfError, treatmentMeans, treatmentNames } = anovaResult;
  const k = treatmentMeans.length;
  const r = data[0].length;

  // Create sorted indices by mean (descending)
  const sorted = treatmentMeans
    .map((m, i) => ({ index: i, mean: m, name: treatmentNames[i] }))
    .sort((a, b) => a.mean - b.mean);

  // Recursive partition
  const groupAssignment = new Array(k).fill(0);
  let currentGroup = 0;

  function partition(indices: number[], groupStart: number): number {
    if (indices.length <= 1) {
      for (const idx of indices) {
        groupAssignment[idx] = groupStart;
      }
      return groupStart + 1;
    }

    const means = indices.map(i => sorted[i].mean);
    const overallMean = calcMean(means);
    const n = indices.length;

    // Find optimal split point
    let maxBo = 0;
    let splitAt = -1;

    for (let i = 0; i < n - 1; i++) {
      const group1 = means.slice(0, i + 1);
      const group2 = means.slice(i + 1);
      const mean1 = calcMean(group1);
      const mean2 = calcMean(group2);

      // Between-group sum of squares for this partition
      const bo =
        group1.length * (mean1 - overallMean) ** 2 +
        group2.length * (mean2 - overallMean) ** 2;

      if (bo > maxBo) {
        maxBo = bo;
        splitAt = i;
      }
    }

    if (splitAt === -1) {
      for (const idx of indices) {
        groupAssignment[idx] = groupStart;
      }
      return groupStart + 1;
    }

    // Test significance using the Scott-Knott criterion
    // λ = (π / (2*(π-2))) * (Bo / (MSE/r))
    const piVal = Math.PI;
    const lambda = (piVal / (2 * (piVal - 2))) * (maxBo / (mse / r));

    // Compare with chi-squared critical value
    // df = k / (pi - 2) as suggested by Gates & Bilbro (1978)
    const df_sk = n / (piVal - 2);
    const pValue = chiSquaredPValue(lambda, df_sk);

    if (pValue <= alpha) {
      // Split is significant - partition both groups
      const leftIndices = indices.slice(0, splitAt + 1);
      const rightIndices = indices.slice(splitAt + 1);
      const nextGroup = partition(leftIndices, groupStart);
      return partition(rightIndices, nextGroup);
    } else {
      // Split is not significant - all belong to same group
      for (const idx of indices) {
        groupAssignment[idx] = groupStart;
      }
      return groupStart + 1;
    }
  }

  const numGroups = partition(
    Array.from({ length: k }, (_, i) => i),
    0
  );

  // Build result
  const groups: ScottKnottGroup[] = sorted.map((item, i) => ({
    treatmentName: item.name,
    treatmentIndex: item.index,
    mean: item.mean,
    group: groupAssignment[i],
    letter: String.fromCharCode(97 + groupAssignment[i]),
  }));

  return {
    groups,
    numGroups,
  };
}

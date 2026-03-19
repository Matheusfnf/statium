/**
 * Tukey HSD (Honestly Significant Difference) test
 * Post-hoc comparison after ANOVA
 */

import { qCritical } from './distributions';
import { AnovaResult } from './anova';

export interface TukeyComparison {
  treatment1: string;
  treatment2: string;
  mean1: number;
  mean2: number;
  difference: number;
  dms: number;
  significant: boolean;
}

export interface TukeyResult {
  dms05: number;            // DMS at 5%
  dms01: number;            // DMS at 1%
  comparisons: TukeyComparison[];
  groups: TukeyGroup[];
}

export interface TukeyGroup {
  treatmentName: string;
  treatmentIndex: number;
  mean: number;
  letter: string;
}

/**
 * Perform Tukey HSD test
 */
export function tukeyHSD(
  anovaResult: AnovaResult,
  data: number[][],
  alpha: number = 0.05
): TukeyResult {
  const { mse, dfError, treatmentMeans, treatmentNames } = anovaResult;
  const k = treatmentMeans.length;
  const r = data[0].length; // assuming balanced design

  // Get q critical value
  const q05 = qCritical(0.05, k, dfError);
  const q01 = qCritical(0.01, k, dfError);

  // DMS (Diferença Mínima Significativa) = q * sqrt(MSE / r)
  const dms05 = q05 * Math.sqrt(mse / r);
  const dms01 = q01 * Math.sqrt(mse / r);

  const currentDms = alpha <= 0.01 ? dms01 : dms05;

  // All pairwise comparisons
  const comparisons: TukeyComparison[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const diff = Math.abs(treatmentMeans[i] - treatmentMeans[j]);
      comparisons.push({
        treatment1: treatmentNames[i],
        treatment2: treatmentNames[j],
        mean1: treatmentMeans[i],
        mean2: treatmentMeans[j],
        difference: diff,
        dms: currentDms,
        significant: diff >= currentDms,
      });
    }
  }

  // Assign grouping letters
  const meansWithIndex = treatmentMeans.map((m, i) => ({ index: i, mean: m }));
  const sorted = [...meansWithIndex].sort((a, b) => a.mean - b.mean);

  // Build groups using absorption algorithm
  const groups = buildTukeyGroups(sorted, currentDms, treatmentNames);

  return {
    dms05,
    dms01,
    comparisons,
    groups,
  };
}

function buildTukeyGroups(
  sorted: { index: number; mean: number }[],
  dms: number,
  names: string[]
): TukeyGroup[] {
  const n = sorted.length;
  const maximalGroups: number[][] = []; 

  // Step 1: Find all maximal non-significant sets
  // A set is non-significant if max(mean) - min(mean) <= dms
  for (let i = 0; i < n; i++) {
    for (let j = n - 1; j >= i; j--) {
      const diff = Math.abs(sorted[i].mean - sorted[j].mean);
      if (diff <= dms) {
        // Potential group from i to j
        const currentGroup = [];
        for (let k = i; k <= j; k++) {
          currentGroup.push(sorted[k].index);
        }
        
        // Check if this is a subset of an already identified maximal group
        let isSubset = false;
        for (const existing of maximalGroups) {
          if (currentGroup.every(val => existing.includes(val))) {
            isSubset = true;
            break;
          }
        }
        
        if (!isSubset) {
          maximalGroups.push(currentGroup);
        }
        // Once we find the largest j for this i, we move to next i
        break; 
      }
    }
  }

  // Step 2: Assign letters to groups
  const treatmentLetters: string[][] = Array.from({ length: n }, () => []);
  maximalGroups.forEach((group, groupIdx) => {
    const letter = String.fromCharCode(97 + groupIdx);
    group.forEach(treatIndex => {
      const sortedIdx = sorted.findIndex(s => s.index === treatIndex);
      treatmentLetters[sortedIdx].push(letter);
    });
  });

  return sorted.map((item, i) => ({
    treatmentName: names[item.index],
    treatmentIndex: item.index,
    mean: item.mean,
    letter: treatmentLetters[i].sort().join(''),
  }));
}

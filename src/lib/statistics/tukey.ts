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
  dms05: number | null; // Null if unbalanced (Tukey-Kramer has multiple DMSs)
  dms01: number | null;
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
  data: (number | null)[][],
  alpha: number = 0.05
): TukeyResult {
  const { mse, dfError, treatmentMeans, treatmentCounts, treatmentNames } = anovaResult;
  const k = treatmentMeans.length;

  // Check if design is balanced
  const isBalanced = treatmentCounts.every(c => c === treatmentCounts[0]) && treatmentCounts[0] > 0;
  const rBalanced = isBalanced ? treatmentCounts[0] : 0;

  // Get q critical value
  const q05 = qCritical(0.05, k, dfError);
  const q01 = qCritical(0.01, k, dfError);

  // Global DMS only if balanced
  let globalDms05 = null;
  let globalDms01 = null;
  
  if (isBalanced) {
    globalDms05 = q05 * Math.sqrt(mse / rBalanced);
    globalDms01 = q01 * Math.sqrt(mse / rBalanced);
  }

  const comparisons: TukeyComparison[] = [];
  
  // Pairwise Tukey-Kramer DMS logic
  const getPairwiseDms = (r1: number, r2: number, q: number) => {
    if (r1 === 0 || r2 === 0) return Infinity;
    return (q / Math.sqrt(2)) * Math.sqrt(mse * (1 / r1 + 1 / r2));
  };
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const diff = Math.abs(treatmentMeans[i] - treatmentMeans[j]);
      
      const qUsed = alpha <= 0.01 ? q01 : q05;
      const pairDms = getPairwiseDms(treatmentCounts[i], treatmentCounts[j], qUsed);
      
      comparisons.push({
        treatment1: treatmentNames[i],
        treatment2: treatmentNames[j],
        mean1: treatmentMeans[i],
        mean2: treatmentMeans[j],
        difference: diff,
        dms: pairDms,
        significant: diff >= pairDms,
      });
    }
  }

  // Assign grouping letters
  const meansWithIndex = treatmentMeans.map((m, i) => ({ index: i, mean: m }));
  const sorted = [...meansWithIndex].sort((a, b) => a.mean - b.mean);
  const qUsedForGroups = alpha <= 0.01 ? q01 : q05;

  // Build groups using absorption algorithm
  const groups = buildTukeyGroupsKramer(sorted, treatmentCounts, qUsedForGroups, mse, treatmentNames);

  return {
    dms05: globalDms05,
    dms01: globalDms01,
    comparisons,
    groups,
  };
}

function buildTukeyGroupsKramer(
  sorted: { index: number; mean: number }[],
  counts: number[],
  qVal: number,
  mse: number,
  names: string[]
): TukeyGroup[] {
  const n = sorted.length;
  const maximalGroups: number[][] = []; 
  
  const getPairDms = (r1: number, r2: number) => {
    if (r1 === 0 || r2 === 0) return Infinity;
    return (qVal / Math.sqrt(2)) * Math.sqrt(mse * (1 / r1 + 1 / r2));
  };

  // Step 1: Find all maximal non-significant sets
  // A set is non-significant if EVERY pair is not significantly different
  for (let i = 0; i < n; i++) {
    for (let j = n - 1; j >= i; j--) {
      
      let allPairsNonSignificant = true;
      for(let x = i; x <= j; x++) {
        for(let y = x + 1; y <= j; y++) {
           const diff = Math.abs(sorted[x].mean - sorted[y].mean);
           const r1 = counts[sorted[x].index];
           const r2 = counts[sorted[y].index];
           if (diff > getPairDms(r1, r2)) {
             allPairsNonSignificant = false;
             break;
           }
        }
        if(!allPairsNonSignificant) break;
      }

      if (allPairsNonSignificant) {
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

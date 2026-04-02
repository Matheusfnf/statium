import { fPValue, fCritical } from './distributions';
import { TidyDataRow } from '@/app/analysis/TidyDataGrid';
import { AnovaResult, AnovaRow, AssumptionsResultMap } from './anova';

export interface FactorialAnovaResult extends AnovaResult {
  factorialSignificance: {
    factorA: boolean;
    factorB: boolean;
    interaction: boolean;
  };
  factorA: { names: string[]; means: number[]; counts: number[] };
  factorB: { names: string[]; means: number[]; counts: number[] };
}

function getSignificance(p: number | null, alpha: number): string {
  if (p === null) return 'ns';
  if (p <= alpha) return '*';
  return 'ns';
}

export function anovaFatorialDuplo(
  data: TidyDataRow[],
  design: 'DIC' | 'DBC',
  alpha: number = 0.05
): FactorialAnovaResult {
  // 1. Group Data & Find Unique Levels
  const levelsA = Array.from(new Set(data.map(d => d.factorA))).sort();
  const levelsB = Array.from(new Set(data.map(d => d.factorB))).sort();
  const levelsBlock = design === 'DBC' ? Array.from(new Set(data.map(d => d.block!))).sort() : [];
  
  const a = levelsA.length;
  const b = levelsB.length;
  const r = design === 'DBC' ? levelsBlock.length : data.length / (a * b);
  
  const N = data.length;

  let sumTotal = 0;
  let sumSquaresTotal = 0;
  const sumA: Record<string, number> = {};
  const sumB: Record<string, number> = {};
  const sumAB: Record<string, number> = {};
  const sumBlock: Record<string, number> = {};

  levelsA.forEach(la => sumA[la] = 0);
  levelsB.forEach(lb => sumB[lb] = 0);
  levelsA.forEach(la => {
    levelsB.forEach(lb => sumAB[`${la}|${lb}`] = 0);
  });
  if (design === 'DBC') {
    levelsBlock.forEach(blk => sumBlock[blk] = 0);
  }

  data.forEach(row => {
    const y = row.response;
    sumTotal += y;
    sumSquaresTotal += y * y;
    sumA[row.factorA] += y;
    sumB[row.factorB] += y;
    sumAB[`${row.factorA}|${row.factorB}`] += y;
    if (design === 'DBC' && row.block) sumBlock[row.block] += y;
  });

  const C = (sumTotal * sumTotal) / N;
  const SST = sumSquaresTotal - C;

  let SSA_raw = 0; Object.values(sumA).forEach(sa => { SSA_raw += sa * sa; });
  const SSA = (SSA_raw / (b * r)) - C;

  let SSB_raw = 0; Object.values(sumB).forEach(sb => { SSB_raw += sb * sb; });
  const SSB = (SSB_raw / (a * r)) - C;

  let SSTrat_raw = 0; Object.values(sumAB).forEach(sab => { SSTrat_raw += sab * sab; });
  const SSTrat = (SSTrat_raw / r) - C;

  const SSAB = SSTrat - SSA - SSB;

  let SSBlock = 0;
  if (design === 'DBC') {
    let SSBlock_raw = 0; Object.values(sumBlock).forEach(sblk => { SSBlock_raw += sblk * sblk; });
    SSBlock = (SSBlock_raw / (a * b)) - C;
  }

  const SSE = design === 'DBC' ? SST - SSTrat - SSBlock : SST - SSTrat;

  const df_Total = N - 1;
  const df_A = a - 1;
  const df_B = b - 1;
  const df_AB = df_A * df_B;
  const df_Block = design === 'DBC' ? r - 1 : 0;
  const df_Error = design === 'DBC' ? (a * b - 1) * (r - 1) : a * b * (r - 1);

  const MSA = df_A > 0 ? SSA / df_A : 0;
  const MSB = df_B > 0 ? SSB / df_B : 0;
  const MSAB = df_AB > 0 ? SSAB / df_AB : 0;
  const MSBlock = df_Block > 0 ? SSBlock / df_Block : 0;
  const MSE = df_Error > 0 ? SSE / df_Error : 0;

  const FA = MSE > 0 ? MSA / MSE : 0;
  const FB = MSE > 0 ? MSB / MSE : 0;
  const FAB = MSE > 0 ? MSAB / MSE : 0;
  const FBlock = (design === 'DBC' && MSE > 0) ? MSBlock / MSE : 0;

  const pA = FA > 0 ? fPValue(FA, df_A, df_Error) : 1;
  const pB = FB > 0 ? fPValue(FB, df_B, df_Error) : 1;
  const pAB = FAB > 0 ? fPValue(FAB, df_AB, df_Error) : 1;
  const pBlock = FBlock > 0 ? fPValue(FBlock, df_Block, df_Error) : 1;

  const table: AnovaRow[] = [];
  
  table.push({
    source: 'Fator A', df: df_A, ss: SSA, ms: MSA,
    fValue: FA, pValue: pA,
    fCritical05: df_A > 0 && df_Error > 0 ? fCritical(0.05, df_A, df_Error) : null,
    fCritical01: df_A > 0 && df_Error > 0 ? fCritical(0.01, df_A, df_Error) : null,
    significance: getSignificance(pA, alpha)
  });
  table.push({
    source: 'Fator B', df: df_B, ss: SSB, ms: MSB,
    fValue: FB, pValue: pB,
    fCritical05: df_B > 0 && df_Error > 0 ? fCritical(0.05, df_B, df_Error) : null,
    fCritical01: df_B > 0 && df_Error > 0 ? fCritical(0.01, df_B, df_Error) : null,
    significance: getSignificance(pB, alpha)
  });
  table.push({
    source: 'Interação AxB', df: df_AB, ss: SSAB, ms: MSAB,
    fValue: FAB, pValue: pAB,
    fCritical05: df_AB > 0 && df_Error > 0 ? fCritical(0.05, df_AB, df_Error) : null,
    fCritical01: df_AB > 0 && df_Error > 0 ? fCritical(0.01, df_AB, df_Error) : null,
    significance: getSignificance(pAB, alpha)
  });

  if (design === 'DBC') {
    table.push({
      source: 'Bloco', df: df_Block, ss: SSBlock, ms: MSBlock,
      fValue: FBlock, pValue: pBlock,
      fCritical05: df_Block > 0 && df_Error > 0 ? fCritical(0.05, df_Block, df_Error) : null,
      fCritical01: df_Block > 0 && df_Error > 0 ? fCritical(0.01, df_Block, df_Error) : null,
      significance: getSignificance(pBlock, alpha)
    });
  }
  table.push({
    source: 'Resíduo', df: df_Error, ss: SSE, ms: MSE,
    fValue: null, pValue: null, fCritical05: null, fCritical01: null, significance: ''
  });
  table.push({
    source: 'Total', df: df_Total, ss: SST, ms: 0,
    fValue: null, pValue: null, fCritical05: null, fCritical01: null, significance: ''
  });

  const overallMean = sumTotal / N;
  const cv = (Math.sqrt(MSE) / overallMean) * 100;
  const modelR2 = (SST - SSE) / SST;

  // For compatibility with the simple engine, we generate TreatmentMeans
  // We will treat every specific combination of A and B as a unique treatment
  const treatmentNames: string[] = [];
  const treatmentMeans: number[] = [];
  const treatmentCounts: number[] = [];
  
  levelsA.forEach(la => {
    levelsB.forEach(lb => {
      const combName = `${la} | ${lb}`;
      treatmentNames.push(combName);
      treatmentMeans.push(sumAB[`${la}|${lb}`] / r);
      treatmentCounts.push(r);
    });
  });

  // Mock assumptions for now
  const assumptions: AssumptionsResultMap = {
    normality: { name: 'Shapiro-Wilk (Mock)', passed: true, pValue: 0.99, statistic: 0.99 },
    homoscedasticity: { name: 'Bartlett (Mock)', passed: true, pValue: 0.99, statistic: 0.01 }
  };

  // Marginal Means for Independent Effects (Desdobramento)
  const factorANames = levelsA;
  const factorAMeans = levelsA.map(la => sumA[la] / (b * r));
  const factorACounts = levelsA.map(() => (design === 'DBC' ? b * r : data.length / a)); // b*r is correct for both if balanced

  const factorBNames = levelsB;
  const factorBMeans = levelsB.map(lb => sumB[lb] / (a * r));
  const factorBCounts = levelsB.map(() => (design === 'DBC' ? a * r : data.length / b));

  return {
    table,
    overallMean,
    cv,
    mse: MSE,
    dfError: df_Error,
    treatmentMeans,
    treatmentCounts,
    treatmentNames,
    design,
    assumptions,
    modelR2,
    factorialSignificance: {
      factorA: pA !== null && pA < alpha,
      factorB: pB !== null && pB < alpha,
      interaction: pAB !== null && pAB < alpha
    },
    factorA: { names: factorANames, means: factorAMeans, counts: factorACounts },
    factorB: { names: factorBNames, means: factorBMeans, counts: factorBCounts }
  } as FactorialAnovaResult;
}

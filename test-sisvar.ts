import { anovaFatorialDuplo } from './src/lib/statistics/factorialAnova';
import { tukeyHSD } from './src/lib/statistics/tukey';

const data = [
  { factorA: 'CCP09', factorB: 'controle', block: '1', response: 1.84 },
  { factorA: 'CCP09', factorB: 'controle', block: '2', response: 1.92 },
  { factorA: 'CCP09', factorB: 'controle', block: '3', response: 1.87 },
  { factorA: 'CCP09', factorB: 'controle', block: '4', response: 1.94 },

  { factorA: 'CCP09', factorB: 'NaCl', block: '1', response: 1.66 },
  { factorA: 'CCP09', factorB: 'NaCl', block: '2', response: 1.79 },
  { factorA: 'CCP09', factorB: 'NaCl', block: '3', response: 1.94 },
  { factorA: 'CCP09', factorB: 'NaCl', block: '4', response: 1.78 },

  { factorA: 'CAPI 4', factorB: 'controle', block: '1', response: 1.63 },
  { factorA: 'CAPI 4', factorB: 'controle', block: '2', response: 1.59 },
  { factorA: 'CAPI 4', factorB: 'controle', block: '3', response: 1.37 },
  { factorA: 'CAPI 4', factorB: 'controle', block: '4', response: 1.69 },

  { factorA: 'CAPI 4', factorB: 'NaCl', block: '1', response: 1.37 },
  { factorA: 'CAPI 4', factorB: 'NaCl', block: '2', response: 1.25 },
  { factorA: 'CAPI 4', factorB: 'NaCl', block: '3', response: 1.48 },
  { factorA: 'CAPI 4', factorB: 'NaCl', block: '4', response: 1.56 },

  { factorA: 'BRS 226', factorB: 'controle', block: '1', response: 2.60 },
  { factorA: 'BRS 226', factorB: 'controle', block: '2', response: 2.71 },
  { factorA: 'BRS 226', factorB: 'controle', block: '3', response: 2.45 },
  { factorA: 'BRS 226', factorB: 'controle', block: '4', response: 2.47 },

  { factorA: 'BRS 226', factorB: 'NaCl', block: '1', response: 2.36 },
  { factorA: 'BRS 226', factorB: 'NaCl', block: '2', response: 2.30 },
  { factorA: 'BRS 226', factorB: 'NaCl', block: '3', response: 2.09 },
  { factorA: 'BRS 226', factorB: 'NaCl', block: '4', response: 2.11 }
];

const anova = anovaFatorialDuplo(data, 'DBC');
console.log('CV:', anova.cv);
console.log('MSE:', anova.mse);

// Mock parsedData array for tukeyHSD which needs it to just know counts per group
// But for factorial, it calculates everything from treatmentMeans and counts inside anovaResult
const fakeRaw = data.map(d => [d.response]); 
const tukey = tukeyHSD(anova, fakeRaw, 0.05);

if (tukey.isFactorial) {
  console.log('DMS Fator A (0.05):', tukey.mainA?.dms05);
  console.log('DMS Fator B (0.05):', tukey.mainB?.dms05);
  // Re-calculate the interaction DMS manually to see what it is
  // Actually, tukey.dms05 on interaction isn't calculated this way unless it's just basic treatments.
} else {
  console.log('DMS Interacao:', tukey.dms05);
}

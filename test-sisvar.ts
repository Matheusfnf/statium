import { anovaFatorialDuplo } from './src/lib/statistics/factorialAnova';
import { tukeyHSD } from './src/lib/statistics/tukey';

const data = [
  { fatorA: 'CCP09', fatorB: 'controle', bloco: '1', resposta: 1.84 },
  { fatorA: 'CCP09', fatorB: 'controle', bloco: '2', resposta: 1.92 },
  { fatorA: 'CCP09', fatorB: 'controle', bloco: '3', resposta: 1.87 },
  { fatorA: 'CCP09', fatorB: 'controle', bloco: '4', resposta: 1.94 },

  { fatorA: 'CCP09', fatorB: 'NaCl', bloco: '1', resposta: 1.66 },
  { fatorA: 'CCP09', fatorB: 'NaCl', bloco: '2', resposta: 1.79 },
  { fatorA: 'CCP09', fatorB: 'NaCl', bloco: '3', resposta: 1.94 },
  { fatorA: 'CCP09', fatorB: 'NaCl', bloco: '4', resposta: 1.78 },

  { fatorA: 'CAPI 4', fatorB: 'controle', bloco: '1', resposta: 1.63 },
  { fatorA: 'CAPI 4', fatorB: 'controle', bloco: '2', resposta: 1.59 },
  { fatorA: 'CAPI 4', fatorB: 'controle', bloco: '3', resposta: 1.37 },
  { fatorA: 'CAPI 4', fatorB: 'controle', bloco: '4', resposta: 1.69 },

  { fatorA: 'CAPI 4', fatorB: 'NaCl', bloco: '1', resposta: 1.37 },
  { fatorA: 'CAPI 4', fatorB: 'NaCl', bloco: '2', resposta: 1.25 },
  { fatorA: 'CAPI 4', fatorB: 'NaCl', bloco: '3', resposta: 1.48 },
  { fatorA: 'CAPI 4', fatorB: 'NaCl', bloco: '4', resposta: 1.56 },

  { fatorA: 'BRS 226', fatorB: 'controle', bloco: '1', resposta: 2.60 },
  { fatorA: 'BRS 226', fatorB: 'controle', bloco: '2', resposta: 2.71 },
  { fatorA: 'BRS 226', fatorB: 'controle', bloco: '3', resposta: 2.45 },
  { fatorA: 'BRS 226', fatorB: 'controle', bloco: '4', resposta: 2.47 },

  { fatorA: 'BRS 226', fatorB: 'NaCl', bloco: '1', resposta: 2.36 },
  { fatorA: 'BRS 226', fatorB: 'NaCl', bloco: '2', resposta: 2.30 },
  { fatorA: 'BRS 226', fatorB: 'NaCl', bloco: '3', resposta: 2.09 },
  { fatorA: 'BRS 226', fatorB: 'NaCl', bloco: '4', resposta: 2.11 }
];

const anova = anovaFatorialDuplo(data, 'DBC');
console.log('CV:', anova.cv);
console.log('MSE:', anova.mse);

// Mock parsedData array for tukeyHSD which needs it to just know counts per group
// But for factorial, it calculates everything from treatmentMeans and counts inside anovaResult
const fakeRaw = data.map(d => [d.resposta]); 
const tukey = tukeyHSD(anova, fakeRaw, 0.05);

if (tukey.isFactorial) {
  console.log('DMS Fator A (0.05):', tukey.mainA.dms05);
  console.log('DMS Fator B (0.05):', tukey.mainB.dms05);
  // Re-calculate the interaction DMS manually to see what it is
  // Actually, tukey.dms05 on interaction isn't calculated this way unless it's just basic treatments.
} else {
  console.log('DMS Interacao:', tukey.dms05);
}

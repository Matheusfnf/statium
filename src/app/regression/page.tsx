'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  anovaDIC,
  anovaDBC,
  polynomialRegressionTask,
  formatNumber
} from '@/lib/statistics';
import type { AnovaResult, DesignType } from '@/lib/statistics';
import type { RegressionResult, PolynomialModel } from '@/lib/statistics/regression';
import { validateGrid, getCellStates } from '@/lib/validation';
import { useAnalysisHistory, HistoryEntry } from '@/hooks/useAnalysisHistory';
import { exportRegressionWord } from '@/lib/export';
import Header from '@/components/Layout/Header';
import HistoryPanel from '@/components/AnalysisHistory/HistoryPanel';
import styles from '../analysis/analysis.module.css';
import RegressionChart from './RegressionChart';

const STEPS = [
  { label: 'Configurar', icon: '⚙️' },
  { label: 'Inserir Dados', icon: '📊' },
  { label: 'Resultados', icon: '📋' },
];

export default function RegressionPage() {
  const [currentStep, setCurrentStep] = useState(0);

  // Setup state
  const [design, setDesign] = useState<DesignType>('DIC');
  const [numTreatments, setNumTreatments] = useState<number | string>(4);
  const [numReps, setNumReps] = useState<number | string>(4);
  const [treatmentNames, setTreatmentNames] = useState<string[]>([]);
  const [variableName, setVariableName] = useState('Produtividade');

  // Data state
  const [data, setData] = useState<(number | string)[][]>([]);

  // Results state
  const [anovaResult, setAnovaResult] = useState<AnovaResult | null>(null);
  const [regressionResult, setRegressionResult] = useState<RegressionResult | null>(null);
  const [alpha, setAlpha] = useState(0.05);

  // History / UI state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const history = useAnalysisHistory();

  // Parsed data
  const parsedData = useMemo(() => {
    return data.map((row) =>
      row.map((val) => {
        if (typeof val === 'number') return val;
        const strVal = String(val).trim();
        if (strVal === '') return null;
        const num = parseFloat(strVal.replace(',', '.'));
        return isNaN(num) ? null : num;
      })
    );
  }, [data]);

  const validation = useMemo(() => {
    if (parsedData.length === 0) return null;
    return validateGrid(parsedData, treatmentNames);
  }, [parsedData, treatmentNames]);

  const cellStates = useMemo(() => {
    if (!validation) return new Map<string, 'error' | 'warning'>();
    return getCellStates(validation);
  }, [validation]);

  const handleGenerateGrid = useCallback(() => {
    if (!variableName.trim()) {
      alert('Informe o nome da variável resposta.');
      return;
    }

    const nt = parseInt(String(numTreatments));
    const nr = parseInt(String(numReps));

    if (isNaN(nt) || nt < 2) {
      alert('O número de doses deve ser no mínimo 2.');
      return;
    }
    if (isNaN(nr) || nr < 2) {
      alert('O número de repetições deve ser no mínimo 2.');
      return;
    }

    const names = Array.from({ length: nt }, (_, i) => String(i * 50));
    setTreatmentNames(names);
    setData(Array.from({ length: nt }, () => Array.from({ length: nr }, () => '')));
    setCurrentStep(1);
  }, [numTreatments, numReps, variableName]);

  const handleCellChange = useCallback((treatIdx: number, repIdx: number, value: string) => {
    setData((prev) => {
      const next = prev.map((row) => [...row]);
      next[treatIdx][repIdx] = value;
      return next;
    });
  }, []);

  const handleTreatmentNameChange = useCallback((idx: number, value: string) => {
    setTreatmentNames((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const handleAnalyze = useCallback(() => {
    if (validation && Object.keys(validation.errors).length > 0) {
      alert('Corrija os erros na tabela antes de analisar.');
      return;
    }

    // Prepare inputs: check if treatments are perfectly numeric
    const treatDoses = treatmentNames.map(name => {
      const n = parseFloat(String(name).trim().replace(',', '.'));
      if (isNaN(n)) return null;
      return n;
    });

    if (treatDoses.includes(null)) {
      alert('Para Regressão, todos os nomes de tratamentos devem ser numéricos (ex: 0, 50, 100). Verifique suas doses.');
      return;
    }

    const cleanData = parsedData.map(row => row.filter(v => v !== null) as number[]);
    const treatMeans = cleanData.map(row => {
      if (row.length === 0) return 0;
      return row.reduce((sum, v) => sum + v, 0) / row.length;
    });

    // 1. Calculate Standard ANOVA properly
    const anovaRes = design === 'DIC'
      ? anovaDIC(parsedData, treatmentNames, alpha)
      : anovaDBC(parsedData, treatmentNames, alpha);
    
    setAnovaResult(anovaRes);

    const treatInfo = treatDoses.map((dose, i) => ({
      x: dose as number,
      mean: treatMeans[i],
      count: cleanData[i].length
    }));

    const trtRow = anovaRes.table.find((r) => r.source === 'Tratamentos') || anovaRes.table.find((r) => r.source === 'Tratamento');

    if (!trtRow) {
      alert('Erro inesperado: Tabela ANOVA sem tratamentos.');
      return;
    }

    const anovaTotal = {
      mse: anovaRes.mse,
      dfError: anovaRes.dfError,
      ssTreatments: trtRow.ss,
      dfTreatments: trtRow.df
    };

    // Maximum degree allowable based on DF Treatments (e.g. 4 doses -> max Cubic)
    const maxDegree = Math.min(3, anovaTotal.dfTreatments);

    const regRes = polynomialRegressionTask(treatInfo, anovaTotal, variableName, null, maxDegree);
    
    setRegressionResult(regRes);
    setCurrentStep(2);
  }, [parsedData, treatmentNames, design, alpha, variableName, validation]);

  const handleSaveToHistory = useCallback(async () => {
    if (!anovaResult || !regressionResult || !variableName) return;

    const cleanData = parsedData.map(row => row.filter(v => v !== null) as number[]);
    const savedId = await history.save({
      design,
      variableName,
      numTreatments: parseInt(String(numTreatments)),
      numReps: parseInt(String(numReps)),
      treatmentNames,
      data: parsedData,
      experimentType: 'simple',
      anovaResult,
      tukeyResult: null,
      scottKnottResult: null,
      dunnettResult: null,
      regressionResult,
      controlTreatment: '',
      comparisonMethod: 'regression',
      alpha: 0.05,
    });
    if (savedId) {
      setShowSavedToast(true);
      alert('Adicionado aos Favoritos!');
    }
  }, [
    anovaResult,
    regressionResult,
    design,
    numTreatments,
    numReps,
    treatmentNames,
    parsedData,
    variableName,
    history,
  ]);

  useEffect(() => {
    if (showSavedToast) {
      const timer = setTimeout(() => setShowSavedToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSavedToast]);

  const handleLoadHistory = useCallback(
    (entry: HistoryEntry) => {
      setDesign(entry.design);
      setVariableName(entry.variableName || '');
      setNumTreatments(entry.numTreatments);
      setNumReps(entry.numReps);
      setTreatmentNames(entry.treatmentNames);
      setData(entry.data as (string | number)[][]);
      setAnovaResult(entry.anovaResult);
      setRegressionResult(entry.regressionResult || null);

      setCurrentStep(2);
      setHistoryOpen(false);
    },
    []
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const historyId = params.get('historyId');
      if (historyId && history.entries.length > 0) {
        const entry = history.get(historyId);
        if (entry && entry.comparisonMethod === 'regression') {
          handleLoadHistory(entry);
          window.history.replaceState({}, '', '/regression');
        }
      }
    }
  }, [history.entries, history.get, handleLoadHistory]);

  const canAnalyze = parsedData.length > 0 && parsedData.some((r) => r.some((v) => v !== null));

  return (
    <>
      <Header />
      <HistoryPanel
        entries={history.entries.filter(e => e.comparisonMethod === 'regression')}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoad={handleLoadHistory}
        onDelete={history.remove}
      />
      {showSavedToast && (
        <div className={styles.toast}>
          Salvo nos favoritos! ⭐
        </div>
      )}
      <div className={styles.container}>
        <h1 className={styles.title}>
          <span className="gradient-text">Análise de Regressão</span>
        </h1>
        <div className={styles.toolbar}>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Insira dados quantitativos e obtenha ajuste de curvas, equações e tabelas de desvio.
          </p>
        </div>

        <div className={styles.stepper}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <button
                className={`${styles.step} ${i === currentStep ? styles.stepActive : ''} ${i < currentStep ? styles.stepCompleted : ''}`}
                onClick={() => { if (i < currentStep) setCurrentStep(i); }}
              >
                <span className={styles.stepNumber}>{i < currentStep ? '✓' : i + 1}</span>
                {step.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`${styles.stepConnector} ${i < currentStep ? styles.stepConnectorActive : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Initial config */}
        {currentStep === 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>⚙️</span>
              Configuração Fatorial da Regressão
            </h2>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Delineamento</label>
                <select className={styles.select} value={design} onChange={(e) => setDesign(e.target.value as DesignType)}>
                  <option value="DIC">Inteiramente Casualizado (DIC)</option>
                  <option value="DBC">Blocos Casualizados (DBC)</option>
                </select>
                <p className={styles.hintText}>Como os dados foram organizados em campo.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Níveis Numéricos (Doses)</label>
                <input type="number" min="2" className={styles.input} value={numTreatments} onChange={(e) => setNumTreatments(e.target.value)} />
                <p className={styles.hintText}>Quantos níveis quantitativos você aplicou?</p>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Repetições / Blocos</label>
                <input type="number" min="2" className={styles.input} value={numReps} onChange={(e) => setNumReps(e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Variável Resposta</label>
                <input type="text" className={styles.input} placeholder="ex: Produtividade, Altura" value={variableName} onChange={(e) => setVariableName(e.target.value)} />
              </div>
            </div>
            
            <div className={styles.buttonRow}>
              <button className={styles.btnPrimary} onClick={handleGenerateGrid}>Configurar Grade →</button>
            </div>
          </div>
        )}

        {/* Step 1: Input Data */}
        {currentStep === 1 && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>📊</span>
                Inserir Dados Numéricos
              </h2>
            </div>
            <p className={styles.infoText}>
              A primeira coluna de identificadores deve conter valores puramente numéricos (ex: 0, 50, 100, 150). Estes serão o seu eixo X.
            </p>
            <div className={styles.tableWrapper}>
              <table className={styles.table} style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Doses (X)</th>
                    {Array.from({ length: parseInt(String(numReps)) || 0 }).map((_, i) => (
                      <th key={i} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>{design === 'DBC' ? `Bloco ${i + 1}` : `Rep ${i + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        <input
                          type="text"
                          className={`${styles.cellInput} ${styles.cellInputTreat}`}
                          value={treatmentNames[i] || ''}
                          onChange={(e) => handleTreatmentNameChange(i, e.target.value)}
                        />
                      </td>
                      {row.map((cell, j) => (
                        <td key={j} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '4px' }} className={cellStates.get(`${i}-${j}`) === 'error' ? styles.cellError : cellStates.get(`${i}-${j}`) === 'warning' ? styles.cellWarning : ''}>
                          <input
                            type="text"
                            className={styles.cellInput}
                            value={cell}
                            onChange={(e) => handleCellChange(i, j, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.buttonRow} style={{ marginTop: 'var(--space-2xl)' }}>
              <button className={styles.btnSecondary} onClick={() => setCurrentStep(0)}>Voltar</button>
              <button className={styles.btnPrimary} onClick={() => {
                if (!canAnalyze) return alert('Por favor, preencha os dados.');
                setCurrentStep(2);
                handleAnalyze();
              }} disabled={!canAnalyze}>Calcular Regressão</button>
            </div>
          </div>
        )}

        {/* Step 2: Results */}
        {currentStep === 2 && regressionResult && anovaResult && (
          <div className={styles.resultsContainer}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>📈 Ajustes do Modelo</h2>
              <p className={styles.subtitle}>Confira os coeficientes e a Tabela ANOVA decomposta contendo Efeito x Desvios.</p>
              
              <div className={styles.methodConfig} style={{ marginBottom: "2rem" }}>
                <table className={styles.anovaTable}>
                  <thead>
                    <tr>
                      <th>Grau</th>
                      <th>Eq. Ajustada</th>
                      <th>R²</th>
                      <th>P-Valor (Seq)</th>
                      <th>P-Valor (Desvios)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regressionResult.models.map((mod, k) => (
                      <tr key={k} style={{
                        backgroundColor: k === regressionResult.bestModelIndex ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        fontWeight: k === regressionResult.bestModelIndex ? 'bold' : 'normal'
                      }}>
                        <td>{mod.name}</td>
                        <td>{mod.equation}</td>
                        <td>{(mod.r2 * 100).toFixed(2)}%</td>
                        <td style={{ color: mod.pSequential <= alpha ? '#10b981' : '#f87171' }}>
                          {formatNumber(mod.pSequential)} {mod.pSequential <= alpha ? '*' : 'ns'}
                        </td>
                        <td style={{ color: mod.pDeviations > alpha ? '#10b981' : '#f87171' }}>
                          {formatNumber(mod.pDeviations)} {mod.pDeviations > alpha ? 'ns' : '*'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '1rem', fontStyle: 'italic', color: '#94a3b8', fontSize: '0.9rem' }}>
                  A linha sublinhada em verde expressa o melhor modelo segundo a significância dos coeficientes sequenciais e a adequação do desvio (p &gt; 0.05).
                </div>
              </div>

              {regressionResult.bestModelIndex >= 0 && (
                <div className={styles.chartWrapper} style={{ height: '400px', padding: '1rem', background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}>
                    <RegressionChart 
                       xValues={regressionResult.xValues} 
                       observedMeans={regressionResult.observedMeans}
                       model={regressionResult.models[regressionResult.bestModelIndex]}
                       variableName={regressionResult.variableName}
                    />
                </div>
              )}
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Quadro da Análise de Variância Ampliado</h2>
              <table className={styles.anovaTable}>
                <thead>
                  <tr>
                    <th>Fonte de Variação</th>
                    <th>GL</th>
                    <th>SQ</th>
                    <th>QM</th>
                    <th>F calc</th>
                    <th>p-valor</th>
                  </tr>
                </thead>
                <tbody>
                  {/* First render standard ANOVA (except treatments and total and error) */}
                  {anovaResult.table.map((row, i) => {
                     if (row.source === 'Tratamentos' || row.source === 'Resíduo' || row.source === 'Total') return null;
                     return (
                        <tr key={i}>
                          <td>{row.source}</td>
                          <td>{row.df}</td>
                          <td>{formatNumber(row.ss)}</td>
                          <td>{formatNumber(row.ms)}</td>
                          <td>{row.fValue !== null ? formatNumber(row.fValue) : '-'}</td>
                          <td>
                            {row.pValue !== null ? formatNumber(row.pValue) : '-'}
                            <span className={styles.significanceMark}>{row.significance}</span>
                          </td>
                        </tr>
                     );
                  })}
                  
                  {/* Render Treatments broken down */}
                  <tr>
                    <td><strong>Tratamentos (Total)</strong></td>
                    <td>{regressionResult.dfTreatments}</td>
                    <td>{formatNumber(regressionResult.ssTreatments)}</td>
                    <td>{formatNumber(regressionResult.ssTreatments / regressionResult.dfTreatments)}</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                  
                  {/* Render regression models independently up to the max degree */}
                  {regressionResult.models.map((mod, k) => (
                    <tr key={`reg-${k}`} style={{ background: k === regressionResult.bestModelIndex ? 'rgba(255,255,255,0.05)' : 'transparent'}}>
                      <td style={{ paddingLeft: '2rem' }}>↳ Efeito {mod.name}</td>
                      <td>1</td>
                      <td>{formatNumber(mod.ssSequential)}</td>
                      <td>{formatNumber(mod.msSequential)}</td>
                      <td>{formatNumber(mod.fSequential)}</td>
                      <td>
                         {formatNumber(mod.pSequential)}
                         <span className={styles.significanceMark}>{mod.pSequential <= alpha ? '*' : 'ns'}</span>
                      </td>
                    </tr>
                  ))}
                  
                  {/* Deviations for the best model or maximum model */}
                  {regressionResult.models.length > 0 && (
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ paddingLeft: '2rem' }}>↳ Desvios da Regressão (Grau máx)</td>
                      <td>{regressionResult.models[regressionResult.models.length - 1].dfDeviations}</td>
                      <td>{formatNumber(regressionResult.models[regressionResult.models.length - 1].ssDeviations)}</td>
                      <td>{formatNumber(regressionResult.models[regressionResult.models.length - 1].msDeviations)}</td>
                      <td>{formatNumber(regressionResult.models[regressionResult.models.length - 1].fDeviations)}</td>
                      <td>
                         {formatNumber(regressionResult.models[regressionResult.models.length - 1].pDeviations)}
                         <span className={styles.significanceMark}>{regressionResult.models[regressionResult.models.length - 1].pDeviations <= alpha ? '*' : 'ns'}</span>
                      </td>
                    </tr>
                  )}

                  {/* Render Error/Total */}
                  {anovaResult.table.map((row, i) => {
                     if (row.source === 'Resíduo' || row.source === 'Total') {
                       return (
                        <tr key={i}>
                          <td>{row.source}</td>
                          <td>{row.df}</td>
                          <td>{formatNumber(row.ss)}</td>
                          <td>{formatNumber(row.ms)}</td>
                          <td>{row.fValue !== null ? formatNumber(row.fValue) : '-'}</td>
                          <td>
                            {row.pValue !== null ? formatNumber(row.pValue) : '-'}
                            <span className={styles.significanceMark}>{row.significance}</span>
                          </td>
                        </tr>
                       );
                     }
                     return null;
                  })}
                </tbody>
              </table>

              <div className={styles.buttonRow} style={{ marginTop: 'var(--space-2xl)' }}>
                 <button className={styles.btnSecondary} onClick={() => setCurrentStep(1)}>← Reconfigurar Dados</button>
                 <button
                   className={styles.btnSecondary}
                   title="Salvar Análise"
                   onClick={handleSaveToHistory}
                 >
                   ⭐ Salvar Favorito
                 </button>
                 <button
                   className={styles.btnPrimary}
                   title="Exportar para Word"
                   onClick={() => {
                     if (anovaResult && regressionResult) {
                       exportRegressionWord(variableName, anovaResult, regressionResult, alpha);
                     }
                   }}
                 >
                   📄 Exportar Word
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

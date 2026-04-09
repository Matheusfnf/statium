'use client';

import { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  anovaDIC,
  anovaDBC,
  polynomialRegressionTask,
  formatNumber
} from '@/lib/statistics';
import type { AnovaResult, DesignType, FactorialAnovaResult } from '@/lib/statistics';
import type { RegressionResult, PolynomialModel } from '@/lib/statistics/regression';
import { validateGrid, getCellStates } from '@/lib/validation';
import { useAnalysisHistory, HistoryEntry } from '@/hooks/useAnalysisHistory';
import { exportRegressionWord } from '@/lib/export';
import { TidyDataRow } from '@/app/analysis/TidyDataGrid';
import Header from '@/components/Layout/Header';
import HistoryPanel from '@/components/AnalysisHistory/HistoryPanel';
import styles from '../analysis/analysis.module.css';
import RegressionChart from './RegressionChart';

const STEPS = [
  { label: 'Configurar', icon: '⚙️' },
  { label: 'Inserir Dados', icon: '📊' },
  { label: 'Resultados', icon: '📋' },
];

function RegressionPageContent() {
  const [currentStep, setCurrentStep] = useState(0);

  // Setup state
  const [design, setDesign] = useState<DesignType>('DIC');
  const [numTreatments, setNumTreatments] = useState<number | string>(4);
  const [numReps, setNumReps] = useState<number | string>(4);
  const [variableName, setVariableName] = useState('Produtividade');

  // Quali setup
  const [hasQualiFactor, setHasQualiFactor] = useState(false);
  const [qualiFactorName, setQualiFactorName] = useState('');
  const [levelNames, setLevelNames] = useState<string[]>(['', '']);

  const addLevelName = () => setLevelNames([...levelNames, '']);
  const updateLevelName = (idx: number, val: string) => {
    const updated = [...levelNames];
    updated[idx] = val;
    setLevelNames(updated);
  };
  const removeLevelName = (idx: number) => {
    setLevelNames(levelNames.filter((_, i) => i !== idx));
  };

  type GridRow = { dose: string; level: string; reps: string[] };
  const [gridData, setGridData] = useState<GridRow[]>([]);

  // Results state
  const [anovaResult, setAnovaResult] = useState<AnovaResult | FactorialAnovaResult | null>(null);
  const [regressionResults, setRegressionResults] = useState<RegressionResult[] | null>(null);
  const [alpha, setAlpha] = useState(0.05);

  // History / UI state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const history = useAnalysisHistory();
  const searchParams = useSearchParams();
  const loadedFromUrlRef = useRef(false);

  const parsedData = useMemo(() => {
    return gridData.map((row) => ({
      ...row,
      parsedReps: row.reps.map((val) => {
        const strVal = String(val).trim();
        if (strVal === '') return null;
        const num = parseFloat(strVal.replace(',', '.'));
        return isNaN(num) ? null : num;
      })
    }));
  }, [gridData]);

  // Convert to TidyDataRow for validation and ANOVA
  const tidyData = useMemo(() => {
    const tidy: TidyDataRow[] = [];
    parsedData.forEach((row, treatIdx) => {
      row.parsedReps.forEach((val, repIdx) => {
        if (val !== null) {
          tidy.push({
            factorA: row.dose || `0`,
            factorB: hasQualiFactor ? (row.level || `Sem Nível`) : '',
            block: design === 'DBC' ? `Bloco ${repIdx + 1}` : undefined,
            response: val
          });
        }
      });
    });
    return tidy;
  }, [parsedData, hasQualiFactor, design]);

  // Validation logic adapted
  const validation = useMemo(() => {
    if (tidyData.length === 0) return null;
    const treatNames = Array.from(new Set(tidyData.map(d => hasQualiFactor ? `${d.factorA} | ${d.factorB}` : d.factorA)));
    // Simulating old grid parsed data structure for validation logic if needed
    // Or we simply check blanks independently:
    return null; // TidyGrid doesn't use the old grid validator stringently
  }, [tidyData, hasQualiFactor]);

  const cellStates = useMemo(() => {
    return new Map<string, 'error' | 'warning'>();
  }, []);

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

    const levelsArray = hasQualiFactor 
      ? levelNames.map(s => s.trim()).filter(Boolean)
      : [''];

    if (hasQualiFactor && levelsArray.length < 2) {
      alert('Se habilitado, forneça pelo menos 2 nomes de níveis válidos.');
      return;
    }

    const newGrid: GridRow[] = [];
    const dosesArray = Array.from({ length: nt }, (_, i) => String(i * 50));

    // INVERTED ARRAY LOOP: Levels first, then Doses. 
    // This allows manual entry to feel grouped by Level.
    for (const l of levelsArray) {
      for (const d of dosesArray) {
        newGrid.push({
          dose: d,
          level: l,
          reps: Array.from({ length: nr }, () => '')
        });
      }
    }

    setGridData(newGrid);
    setCurrentStep(1);
  }, [numTreatments, numReps, levelNames, hasQualiFactor, variableName]);

  const handleCellChange = useCallback((rowIdx: number, repIdx: number, value: string) => {
    setGridData((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], reps: [...next[rowIdx].reps] };
      next[rowIdx].reps[repIdx] = value;
      return next;
    });
  }, []);

  const handleLevelChange = useCallback((rowIdx: number, value: string) => {
    setGridData((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], level: value };
      return next;
    });
  }, []);

  const addRow = useCallback(() => {
    setGridData(prev => [...prev, { dose: '', level: '', reps: Array.from({ length: parseInt(String(numReps)) || 4 }, () => '') }]);
  }, [numReps]);

  const removeRow = useCallback((idx: number) => {
    setGridData(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleDoseChange = useCallback((rowIdx: number, value: string) => {
    setGridData((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], dose: value };
      return next;
    });
  }, []);

  const handlePasteExcel = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length === 0) return;

    const parsedRows = lines.map(line => line.split('\t').map(cell => cell.trim()));
    
    setGridData(prev => {
      const next = prev.map(row => ({ ...row, reps: [...row.reps] })); // Deep copy
      
      for (let i = 0; i < parsedRows.length && i < next.length; i++) {
        const pRow = parsedRows[i];
        if (pRow.length === 0) continue;
        
        let ptr = 0;
        if (pRow[ptr] !== undefined) next[i].dose = pRow[ptr++];
        if (hasQualiFactor && pRow[ptr] !== undefined) next[i].level = pRow[ptr++];
        
        for (let j = 0; j < next[i].reps.length && ptr < pRow.length; j++) {
           next[i].reps[j] = pRow[ptr++];
        }
      }
      
      return next;
    });
  }, [hasQualiFactor]);


  const handleAnalyze = useCallback(() => {
    // Basic validation check
    const hasData = parsedData.some((r) => r.parsedReps.some((v) => v !== null));
    if (!hasData) {
      alert('Corrija os erros ou preencha a tabela antes de analisar.');
      return;
    }

    const treatDoses = Array.from(new Set(tidyData.map(d => d.factorA)));
    for (const d of treatDoses) {
      const n = parseFloat(String(d).replace(',', '.'));
      if (isNaN(n)) {
        alert(`Para Regressão, todos os nomes de doses devem ser numéricos (encontrado: ${d}). Verifique suas doses.`);
        return;
      }
    }

    let aResult: AnovaResult | FactorialAnovaResult;
    let baseAnovaTotal: { mse: number, dfError: number, ssTreatments: number, dfTreatments: number };

    // 1. Calculate ANOVA
    if (hasQualiFactor) {
      // Import anovaFatorialDuplo if not imported already
      const factRes = require('@/lib/statistics').anovaFatorialDuplo(tidyData, design as 'DIC'|'DBC', alpha) as FactorialAnovaResult;
      aResult = factRes;
      
      const treatSS = factRes.table.find((r: any) => r.source === 'Fator A')?.ss || 0;
      const treatDF = factRes.table.find((r: any) => r.source === 'Fator A')?.df || 0;
      
      baseAnovaTotal = {
        mse: factRes.mse,
        dfError: factRes.dfError,
        ssTreatments: treatSS, // Total SS for doses globally is not perfectly enough since we do regression per level.
        dfTreatments: treatDF
      };
    } else {
      const tNames = Array.from(new Set(parsedData.map(r => r.dose)));
      const simpleDataMatrix = parsedData.map(r => r.parsedReps);
      aResult = design === 'DIC'
         ? anovaDIC(simpleDataMatrix, tNames, alpha)
         : anovaDBC(simpleDataMatrix, tNames, alpha);
        
      const trtRow = aResult.table.find((r) => r.source === 'Tratamentos' || r.source === 'Tratamento');
      baseAnovaTotal = {
        mse: aResult.mse,
        dfError: aResult.dfError,
        ssTreatments: trtRow?.ss || 0,
        dfTreatments: trtRow?.df || 0
      };
    }

    setAnovaResult(aResult);

    // 2. Compute polynomials per qualitative level (or 'Geral')
    const levels = hasQualiFactor ? Array.from(new Set(tidyData.map(d => d.factorB))) : ['Geral'];

    import('@/lib/statistics').then(({ polynomialRegressionTask }) => {
      const resultsArray: RegressionResult[] = [];

      for (const lvl of levels) {
        // Filter observations for this level
        const lvlData = hasQualiFactor ? tidyData.filter(d => d.factorB === lvl) : tidyData;

        // Build raw {x, y} pairs — doses must be numeric
        const rawPairs: { x: number; y: number }[] = [];
        for (const obs of lvlData) {
          const x = parseFloat(String(obs.factorA).replace(',', '.'));
          if (!isNaN(x)) rawPairs.push({ x, y: obs.response });
        }

        if (rawPairs.length < 3) continue;

        const uniqueDoses = Array.from(new Set(rawPairs.map(p => p.x)));
        const maxDegree = Math.min(3, uniqueDoses.length - 1);

        const res = polynomialRegressionTask(
          rawPairs, variableName, qualiFactorName || null, maxDegree, lvl === 'Geral' ? undefined : lvl
        );
        resultsArray.push(res);
      }

      setRegressionResults(resultsArray);
      setCurrentStep(2);
    });
  }, [parsedData, tidyData, hasQualiFactor, design, alpha, variableName, qualiFactorName]);

  const handleSaveToHistory = useCallback(async () => {
    if (!anovaResult || !regressionResults || !variableName) return;

    const savedId = await history.save({
      design,
      variableName,
      numTreatments: parseInt(String(numTreatments)),
      numReps: parseInt(String(numReps)),
      treatmentNames: Array.from(new Set(tidyData.map(d => d.factorA))),
      data: gridData.map(r => r.reps),
      experimentType: hasQualiFactor ? 'factorial' : 'simple',
      tidyDataFull: gridData,
      anovaResult,
      tukeyResult: null,
      scottKnottResult: null,
      dunnettResult: null,
      regressionResult: regressionResults, // Saving the full array
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
    regressionResults,
    design,
    numTreatments,
    numReps,
    gridData,
    tidyData,
    hasQualiFactor,
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

      const isFact = entry.experimentType === 'factorial';
      setHasQualiFactor(isFact);

      // Restore grid data
      if (entry.tidyDataFull && Array.isArray(entry.tidyDataFull)) {
        const gd = entry.tidyDataFull as GridRow[];
        setGridData(gd);

        // Restore quali level names from grid data if factorial
        if (isFact) {
          const uniqueLevels = Array.from(new Set(gd.map((r: GridRow) => r.level).filter(Boolean)));
          if (uniqueLevels.length > 0) setLevelNames(uniqueLevels as string[]);
        }
      } else if (entry.data && Array.isArray(entry.data)) {
        const gData: GridRow[] = (entry.data as string[][]).map((rowArr, i) => ({
          dose: entry.treatmentNames[i] || '',
          level: '',
          reps: rowArr.map((v) => String(v))
        }));
        setGridData(gData);
      }

      // Restore results if valid and jump to results screen
      if (entry.regressionResult) {
        const resultsArr = Array.isArray(entry.regressionResult)
          ? entry.regressionResult
          : [entry.regressionResult];
        setRegressionResults(resultsArr as RegressionResult[]);
        setAnovaResult(entry.anovaResult);
        setCurrentStep(2);
      } else {
        // No results saved — go to data grid so user can recalculate quickly
        setAnovaResult(entry.anovaResult);
        setRegressionResults(null);
        setCurrentStep(1);
      }

      setHistoryOpen(false);
    },
    []
  );

  const canAnalyze = parsedData.length > 0 && parsedData.some((r) => r.parsedReps.some((v) => v !== null));

  // Auto-load from URL ?historyId=xxx (when navigating from history/favorites page)
  useEffect(() => {
    if (loadedFromUrlRef.current) return;
    if (!history.entries || history.entries.length === 0) return;

    const historyId = searchParams.get('historyId');
    if (!historyId) return;

    const entry = history.entries.find(e => String(e.id) === historyId);
    if (entry) {
      loadedFromUrlRef.current = true;
      handleLoadHistory(entry);
    }
  }, [history.entries, searchParams, handleLoadHistory]);

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

              <div className={styles.field} style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasQualiFactor} onChange={(e) => setHasQualiFactor(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Experimento Fatorial (Fator Quantitativo x Qualitativo)
                </label>
                <p className={styles.hintText}>Ative se você cruzou as doses numéricas com algum fator categórico (Ex: Doses x Com/Sem Molibdênio).</p>
                
                {hasQualiFactor && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                     <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                        <label className={styles.label}>Nome do Fator</label>
                        <input type="text" className={styles.input} placeholder="ex: Presença de Molibdênio" value={qualiFactorName} onChange={(e) => setQualiFactorName(e.target.value)} />
                     </div>
                     <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                        <label className={styles.label}>Níveis Qualitativos</label>
                        {levelNames.map((lvl, idx) => (
                           <div key={idx} style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                        <input 
                                type="text" 
                                className={styles.input} 
                                value={lvl} 
                                onChange={(e) => updateLevelName(idx, e.target.value)} 
                                placeholder={idx === 0 ? "Ex: Com Molibdênio" : idx === 1 ? "Ex: Sem Molibdênio" : `Nível ${idx + 1}`} 
                              />
                              {levelNames.length > 2 && (
                                <button className={styles.btnSecondary} onClick={() => removeLevelName(idx)} style={{ padding: '0 12px', color: 'var(--text-danger)' }}>✕</button>
                              )}
                           </div>
                        ))}
                        <button className={styles.btnSecondary} onClick={addLevelName} style={{ fontSize: '0.85rem' }}>+ Adicionar Nível</button>
                     </div>
                  </div>
                )}
              </div>

              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
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
              Você pode colar diretamente do Excel (Ctrl+V) dentro da tabela. A primeira coluna de identificadores deve conter valores puramente numéricos (ex: 0, 50, 100). Estes serão o seu eixo X.
            </p>
            <div className={styles.tableWrapper} onPaste={handlePasteExcel}>
              <table className={styles.table} style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Dose (X)</th>
                    {hasQualiFactor && (
                      <th style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        <input
                           type="text"
                           value={qualiFactorName}
                           onChange={(e) => setQualiFactorName(e.target.value)}
                           className={styles.cellInput}
                           style={{ width: '100%', background: 'transparent', border: 'none', color: 'inherit', fontWeight: 'bold', textAlign: 'center', padding: 0 }}
                           placeholder="Qualitativo"
                        />
                      </th>
                    )}
                    {Array.from({ length: parseInt(String(numReps)) || 0 }).map((_, i) => (
                      <th key={i} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>{design === 'DBC' ? `Bloco ${i + 1}` : `Rep ${i + 1}`}</th>
                    ))}
                    <th style={{ width: '40px', border: '1px solid rgba(255,255,255,0.1)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {gridData.map((row, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        <input
                          type="text"
                          className={`${styles.cellInput} ${styles.cellInputTreat}`}
                          value={row.dose}
                          onChange={(e) => handleDoseChange(i, e.target.value)}
                        />
                      </td>
                      {hasQualiFactor && (
                        <td style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                          <select
                            className={`${styles.cellInput} ${styles.cellInputTreat}`}
                            value={row.level}
                            onChange={(e) => handleLevelChange(i, e.target.value)}
                            style={{ cursor: 'pointer', textAlign: 'center' }}
                          >
                             <option value="" disabled>Selecione...</option>
                             {levelNames.map(name => (
                               <option key={name} value={name.trim()}>{name.trim()}</option>
                             ))}
                          </select>
                        </td>
                      )}
                      {row.reps.map((cell, j) => (
                        <td key={j} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '4px' }}>
                          <input
                            type="text"
                            className={styles.cellInput}
                            value={cell}
                            onChange={(e) => handleCellChange(i, j, e.target.value)}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', padding: '0 4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button 
                          title="Remover linha"
                          onClick={() => removeRow(i)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-danger)', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }}
                          onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <button className={styles.btnSecondary} onClick={addRow} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  + Adicionar Linha
                </button>
              </div>
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
        {currentStep === 2 && regressionResults && anovaResult && (
          <div className={styles.resultsContainer}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>📈 Ajustes do Modelo</h2>
              <p className={styles.subtitle}>Confira os coeficientes e a Tabela ANOVA de cada nível estudado.</p>
              
              <div className={styles.chartWrapper} style={{ height: '400px', padding: '1rem', background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '2rem' }}>
                  <RegressionChart 
                     results={regressionResults}
                     variableName={variableName}
                  />
              </div>

              {regressionResults.map((regRes, iterIdx) => (
                <div key={iterIdx} style={{ marginBottom: '3rem' }}>
                  <h3 style={{ color: '#f8fafc', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                    Nível: {regRes.levelName || 'Geral'}
                  </h3>
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
                        {regRes.models.map((mod, k) => (
                          <tr key={k} style={{
                            backgroundColor: k === regRes.bestModelIndex ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            fontWeight: k === regRes.bestModelIndex ? 'bold' : 'normal'
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
                  </div>

                  <h3 style={{ color: '#f8fafc', marginBottom: '1rem' }}>Quadro da Análise de Variância Ampliado ({regRes.levelName || 'Geral'})</h3>
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
                      {iterIdx === 0 && anovaResult.table.map((row, i) => {
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
                      
                      <tr>
                        <td><strong>Tratamentos (Total: {regRes.levelName || 'Geral'})</strong></td>
                        <td>{regRes.dfTreatments}</td>
                        <td>{formatNumber(regRes.ssTreatments)}</td>
                        <td>{formatNumber(regRes.ssTreatments / regRes.dfTreatments)}</td>
                        <td>-</td>
                        <td>-</td>
                      </tr>
                      
                      {regRes.models.map((mod, k) => (
                        <tr key={`reg-${k}`} style={{ background: k === regRes.bestModelIndex ? 'rgba(255,255,255,0.05)' : 'transparent'}}>
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
                      
                      {regRes.models.length > 0 && (
                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <td style={{ paddingLeft: '2rem' }}>↳ Desvios da Regressão (Grau máx)</td>
                          <td>{regRes.models[regRes.models.length - 1].dfDeviations}</td>
                          <td>{formatNumber(regRes.models[regRes.models.length - 1].ssDeviations)}</td>
                          <td>{formatNumber(regRes.models[regRes.models.length - 1].msDeviations)}</td>
                          <td>{formatNumber(regRes.models[regRes.models.length - 1].fDeviations)}</td>
                          <td>
                             {formatNumber(regRes.models[regRes.models.length - 1].pDeviations)}
                             <span className={styles.significanceMark}>{regRes.models[regRes.models.length - 1].pDeviations <= alpha ? '*' : 'ns'}</span>
                          </td>
                        </tr>
                      )}
    
                      {iterIdx === 0 && anovaResult.table.map((row, i) => {
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
                </div>
              ))}

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
                     if (anovaResult && regressionResults) {
                       exportRegressionWord(variableName, anovaResult, regressionResults, alpha);
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

export default function RegressionPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'var(--text-secondary)'
      }}>
        Carregando...
      </div>
    }>
      <RegressionPageContent />
    </Suspense>
  );
}

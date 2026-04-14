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
import { FileUploader } from '@/components/Data/FileUploader';
import type { ParsedSpreadsheetResult } from '@/lib/parseSpreadsheet';
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
  const [quantFactorName, setQuantFactorName] = useState('Dose');
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
  const [selectedModels, setSelectedModels] = useState<Record<number, number>>({});
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

  const handleFileLoaded = useCallback((parsedRows: string[][]) => {
    if (parsedRows.length === 0) return;

    // Detect if the file is Tidy Data (long format) by checking if the first column has repetitions
    const firstColValues = parsedRows.slice(1).map(row => row[0]).filter(Boolean);
    const uniqueFirstCol = new Set(firstColValues);
    const isTidyFormat = uniqueFirstCol.size > 0 && firstColValues.length > uniqueFirstCol.size * 1.5;

    if (isTidyFormat) {
      // Find headers (assume first row if first cell is string, else use all)
      const hasHeaders = isNaN(parseFloat(String(parsedRows[0][0]).replace(',', '.')));
      const dataRows = hasHeaders ? parsedRows.slice(1) : parsedRows;
      
      let localHasQuali = hasQualiFactor;
      // Auto-detect qualitative factor for Tidy Data based on column count (typically Dose, Quali, Bloco, Resp)
      if (dataRows[0] && dataRows[0].length >= 4) {
          localHasQuali = true;
          setHasQualiFactor(true);
          if (hasHeaders) setQualiFactorName(parsedRows[0][1] || 'Qualitativo');
      } else if (dataRows[0] && dataRows[0].length === 3) {
          // If 3 columns: Dose | Bloco | Resp. Thus, no quali factor normally.
          localHasQuali = false;
          setHasQualiFactor(false);
      }

      const map = new Map<string, { dose: string, level: string, reps: string[] }>();
      let maxReps = 0;

      dataRows.forEach(row => {
          if (row.length < 2) return;
          const dose = row[0];
          
          let level = '';
          let response = '';

          if (localHasQuali) {
              level = row[1] || '';
              response = row[row.length - 1] || ''; 
          } else {
              response = row[row.length - 1] || '';
          }

          if (!dose && !response) return;

          const key = `${dose}_${level}`;
          // ... rest of map code ...
          if (!map.has(key)) {
              map.set(key, { dose, level, reps: [] });
          }
          
          const entry = map.get(key)!;
          entry.reps.push(response);
          if (entry.reps.length > maxReps) maxReps = entry.reps.length;
      });

      const newGrid = Array.from(map.values());
      // Pad reps to maxReps
      newGrid.forEach(row => {
          while (row.reps.length < maxReps) row.reps.push('');
      });

      setGridData(newGrid);
      setNumTreatments(uniqueFirstCol.size);
      setNumReps(maxReps);
      if (hasQualiFactor) {
          const uniqueLevels = new Set(newGrid.map(r => r.level));
          setLevelNames(Array.from(uniqueLevels));
      }
    } else {
      // Expected Wide Data
      // Re-initialize grid dimensions to match the uploaded Wide Data
      const hasHeaders = isNaN(parseFloat(String(parsedRows[0][0]).replace(',', '.')));
      const rowsToProcess = hasHeaders ? parsedRows.slice(1) : parsedRows;
      if (rowsToProcess.length === 0) return;

      const offset = hasQualiFactor ? 2 : 1;
      const detectedReps = Math.max(...rowsToProcess.map(r => r.length - offset));
      const finalReps = detectedReps > 0 ? detectedReps : 1;

      const next = rowsToProcess.map(row => {
          const reps = [];
          for (let j = 0; j < finalReps; j++) {
            reps.push(row[j + offset] || '');
          }
          return {
            dose: row[0] || '',
            level: hasQualiFactor ? (row[1] || '') : '',
            reps: reps
          };
      });

      setGridData(next);
      setNumTreatments(next.length);
      setNumReps(finalReps);
      if (hasQualiFactor) {
          const uniqueLevels = new Set(next.map(r => r.level));
          setLevelNames(Array.from(uniqueLevels));
      }
    }
  }, [hasQualiFactor]);

  const handleAIParsed = useCallback((result: ParsedSpreadsheetResult) => {
    const { isFatorial, qualiFactorName, responseName, rows } = result;

    // Configure qualitative factor settings from AI result
    setHasQualiFactor(isFatorial);
    if (isFatorial && qualiFactorName) setQualiFactorName(qualiFactorName);
    if (responseName) setVariableName(responseName);

    // Extract unique levels in order of first appearance
    const levels = isFatorial
      ? Array.from(new Set(rows.map(r => r.level).filter(Boolean) as string[]))
      : [];
    if (levels.length > 0) setLevelNames(levels);

    // Build grid data from structured AI result
    const maxReps = Math.max(...rows.map(r => r.reps.length), 1);
    const newGrid = rows.map(row => ({
      dose: row.dose,
      level: row.level || '',
      reps: [...row.reps, ...Array(Math.max(0, maxReps - row.reps.length)).fill('')],
    }));

    setGridData(newGrid);
    setNumTreatments(newGrid.length);
    setNumReps(maxReps);

    // Advance to data review step
    setCurrentStep(1);
  }, []);

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
    const levels = hasQualiFactor ? ['Geral', ...Array.from(new Set(tidyData.map(d => d.factorB)))] : ['Geral'];

    import('@/lib/statistics').then(({ polynomialRegressionTask }) => {
      const resultsArray: RegressionResult[] = [];
      const initSelected: Record<number, number> = {};

      for (const lvl of levels) {
        // Filter observations for this level
        const lvlData = (hasQualiFactor && lvl !== 'Geral') ? tidyData.filter(d => d.factorB === lvl) : tidyData;

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
      resultsArray.forEach((r, idx) => {
        initSelected[idx] = r.bestModelIndex;
      });
      setSelectedModels(initSelected);
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
      regressionResult: regressionResults.map((r, idx) => ({
        ...r,
        bestModelIndex: selectedModels[idx] ?? r.bestModelIndex,
      })),
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
        const restoredSelected: Record<number, number> = {};
        resultsArr.forEach((r: any, idx) => {
          restoredSelected[idx] = r.bestModelIndex;
        });
        setSelectedModels(restoredSelected);
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
              <div style={{ flex: '1 1 300px' }}>
                <h2 className={styles.cardTitle}>
                  <span className={styles.cardTitleIcon}>⚙️</span>
                  Configuração da Regressão
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
                <label className={styles.label}>Fator Quantitativo (Eixo X)</label>
                <input type="text" className={styles.input} placeholder="ex: Dose de Esterco" value={quantFactorName} onChange={(e) => setQuantFactorName(e.target.value)} />
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
          </div>

          <div style={{ flex: '0 0 auto', padding: '1.5rem', background: 'rgba(99, 220, 190, 0.05)', border: '1px solid rgba(99,220,190,0.2)', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🤖 Importação com IA
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', maxWidth: '300px' }}>
                  O Gemini AI vai ler sua planilha, interpretar automaticamente as doses, níveis e respostas e preencher tudo já pronto — sem configuração manual.
                </p>
                <FileUploader 
                  useAI={true}
                  onAIParsed={handleAIParsed}
                  aiContext="Experimento agrícola com regressão polinomial, doses quantitativas e possível fator qualitativo (ex: adubação NPK, com/sem aplicação)"
                  title="Importar com IA (.xlsx, .dbf)"
                  subtitle="Gemini lê e preenche tudo automaticamente"
                />
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <p className={styles.infoText} style={{ margin: 0, maxWidth: '60%' }}>
                Você pode colar diretamente do Excel (Ctrl+V) dentro da tabela. A primeira coluna de identificadores deve conter valores puramente numéricos (ex: 0, 50, 100). Estes serão o seu eixo X.
              </p>
              <FileUploader 
                onDataLoaded={handleFileLoaded} 
                title="Importar Arquivo (.xlsx, .dbf)"
                subtitle="Preencher tabela automaticamente"
                style={{ padding: '0.5rem 1rem', width: 'auto', minWidth: '250px' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Delineamento Experimental
                </label>
                <select className={styles.select} style={{ width: 'auto', padding: '6px 12px' }} value={design} onChange={(e) => setDesign(e.target.value as DesignType)}>
                  <option value="DIC">Inteiramente Casualizado (DIC)</option>
                  <option value="DBC">Blocos Casualizados (DBC)</option>
                </select>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
                Altere aqui caso tenha importado seus dados por planilha e precise rodar sua regressão contemplando blocos (DBC) ou um delineamento inteiramente ao acaso (DIC).
              </div>
            </div>

            {hasQualiFactor && levelNames.length > 0 && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(99, 220, 190, 0.1)', border: '1px solid rgba(99,220,190,0.3)', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '1rem' }}>
                  <span>🎯</span> Fatorial Detectado! (Renomear Níveis)
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Reconhecemos automaticamente um Fator Qualitativo e dividimos as respostas. Caso deseje renomear os identificadores da sua planilha para aparecerem mais bonitos no gráfico (ex: trocar "A" por "Ausência"), digite abaixo:
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {levelNames.map((lvl, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Nível Detectado:<span style={{ color: 'var(--primary)', marginLeft: '4px' }}>{lvl}</span></span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <input 
                        className={styles.input} 
                        style={{ padding: '4px 8px', fontSize: '0.85rem', width: '140px', background: 'rgba(0,0,0,0.2)' }} 
                        value={lvl}
                        placeholder={lvl}
                        onChange={(e) => {
                           const oldName = lvl;
                           const newName = e.target.value;
                           // Always allow typing but fallback to old name if empty on blur? Actually just bind to state.
                           const newLevels = [...levelNames];
                           newLevels[idx] = newName;
                           setLevelNames(newLevels);
                           setGridData(prev => prev.map(row => 
                             row.level === oldName ? { ...row, level: newName } : row
                           ));
                        }} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            
            <div className={styles.tableWrapper} onPaste={handlePasteExcel}>
              <table className={styles.table} style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      <input
                         type="text"
                         value={quantFactorName}
                         onChange={(e) => setQuantFactorName(e.target.value)}
                         className={styles.cellInput}
                         style={{ width: '100%', background: 'transparent', border: 'none', color: 'inherit', fontWeight: 'bold', textAlign: 'center', padding: 0 }}
                         placeholder="Dose (X)"
                      />
                    </th>
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
                     results={regressionResults.map((r, idx) => ({ ...r, bestModelIndex: selectedModels[idx] ?? r.bestModelIndex }))}
                     variableName={variableName}
                     quantFactorName={quantFactorName}
                  />
              </div>

              <style>{`
                .helperTooltip { position: relative; display: inline-flex; align-items: center; justify-content: center; margin-left: 8px; cursor: help; vertical-align: middle; }
                .helperTooltipIcon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; border-radius: 50%; font-size: 0.8rem; font-weight: bold; border: 1px solid rgba(56, 189, 248, 0.3); }
                .helperTooltipContent {
                  visibility: hidden; opacity: 0; position: absolute; z-index: 50;
                  top: calc(100% + 8px); left: 50%; transform: translateX(-50%); width: 380px; background: #0f172a;
                  border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 8px;
                  padding: 1.2rem; box-shadow: 0 10px 40px rgba(0,0,0,0.8); font-size: 0.9rem;
                  color: var(--text-secondary); transition: all 0.2s ease; font-weight: normal;
                  pointer-events: none;
                }
                .helperTooltip:hover .helperTooltipContent {
                  visibility: visible; opacity: 1; pointer-events: auto;
                }
                .helperTooltipContent h4 { margin: 0 0 0.5rem 0; color: #cbd5e1; font-weight: 600; }
                .helperTooltipContent p { margin: 0; }
                .helperTooltipContent ul { margin: 0; padding-left: 1.2rem; }
                .helperTooltipContent li { margin-bottom: 0.4rem; }
              `}</style>

              {/* === REGRESSION TABLES === */}
              {regressionResults.map((regRes, iterIdx) => (
                <div key={iterIdx} style={{ marginBottom: '3rem' }}>
                  <h3 style={{ color: '#f8fafc', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                    Desdobramento da Regressão {hasQualiFactor && regRes.levelName && regRes.levelName !== 'Geral' ? `- Nível: ${regRes.levelName}` : '(Geral)'}
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
                        {regRes.models.map((mod, k) => {
                          const isSelected = k === (selectedModels[iterIdx] ?? regRes.bestModelIndex);
                          return (
                          <tr key={k} 
                            onClick={() => setSelectedModels(prev => ({ ...prev, [iterIdx]: k }))}
                            style={{
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                              fontWeight: isSelected ? 'bold' : 'normal',
                              cursor: 'pointer',
                              borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent'
                            }}
                            title="Clique para selecionar este modelo para o gráfico"
                          >
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <h3 style={{ color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                    Quadro da Regressão ({regRes.levelName || 'Geral'})
                    {regRes.models.length > 0 && (() => {
                      const modIndex = selectedModels[iterIdx] ?? regRes.bestModelIndex;
                      const mod = regRes.models[modIndex];
                      if (!mod) return null;
                      const isSig = mod.pSequential <= alpha;
                      const noDev = mod.pDeviations > alpha;
                      return (
                        <div className="helperTooltip">
                          <span className="helperTooltipIcon">?</span>
                          <div className="helperTooltipContent">
                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>Interpretação do Modelo ({mod.name})</h4>
                            <p style={{ lineHeight: '1.6' }}>
                              {isSig 
                                ? <span>A regressão pelo modelo <strong>{mod.name}</strong> foi significativa (p &lt; {alpha}), indicando que consegue explicar a tendência da resposta.</span>
                                : <span>O modelo <strong>{mod.name}</strong> não obteve significância (p &gt; {alpha}). Ausência de resposta clara.</span>
                              }
                              <br/><br/>
                              {noDev
                                ? <span><strong>Desvios não significativos</strong> (p &gt; {alpha}). Cenário ideal: excelente ajuste e variação não explicada é puro erro aleatório.</span>
                                : <span><strong>Desvios foram significativos</strong> (p &lt; {alpha}). A curva foge do padrão perfeito deste modelo (grau superior pode ser melhor).</span>
                              }
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </h3>
                  <div className={styles.methodConfig} style={{ marginBottom: "2rem" }}>
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
                        <tr>
                          <td><strong>Tratamentos ({quantFactorName || 'Tratamentos'})</strong></td>
                          <td>{regRes.dfTreatments}</td>
                          <td>{formatNumber(regRes.ssTreatments)}</td>
                          <td>{formatNumber(regRes.ssTreatments / regRes.dfTreatments)}</td>
                          <td>-</td>
                          <td>-</td>
                        </tr>
                        
                        {regRes.models.map((mod, k) => {
                          const isSelected = k === (selectedModels[iterIdx] ?? regRes.bestModelIndex);
                          return (
                          <tr key={`reg-${k}`} style={{ background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent'}}>
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
                          );
                        })}
                        
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
                      </tbody>
                    </table>
                  </div>

                                  </div>
              ))}
              {/* === GENERAL ANOVA TABLE === */}
              {anovaResult && (
                  <div style={{ marginBottom: '3rem' }}>
                    <h3 style={{ color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                      Quadro da Análise de Variância (Geral)
                      <div className="helperTooltip">
                        <span className="helperTooltipIcon">?</span>
                        <div className="helperTooltipContent">
                          <h4 style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>Interpretação Simplificada</h4>
                          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {anovaResult.table.map((row, i) => {
                               if (row.source === 'Resíduo' || row.source === 'Total') return null;
                               if (hasQualiFactor && (row.source === 'Tratamentos' || row.source === 'Tratamento')) return null;
                               let sourceName = row.source;
                               if (row.source === 'Fator A') sourceName = quantFactorName || 'Fator Quantitativo';
                               if (row.source === 'Fator B') sourceName = qualiFactorName || 'Fator Qualitativo';
                               if (row.source === 'Interação AxB') sourceName = `Interação (${quantFactorName || 'A'} x ${qualiFactorName || 'B'})`;
                               if (!hasQualiFactor && (row.source === 'Tratamentos' || row.source === 'Tratamento')) sourceName = quantFactorName || 'Tratamentos (Doses)';
                               if (row.pValue !== null) {
                                  const sig = row.pValue <= alpha;
                                  return (
                                    <li key={`interp-geral-${i}`}>
                                      <strong>{sourceName}:</strong> {sig 
                                        ? <span>Provocou <strong>efeito significativo</strong> (p &lt; {alpha}). O seu resultado prático muda ativamente em reposta a esse fator.</span>
                                        : <span><strong>Não apresentou efeito significativo</strong> (p &gt; {alpha}). Sozinho, variar este fator ou interação provavelmente não gera mudanças reais observáveis.</span>
                                      }
                                    </li>
                                  );
                               }
                               return null;
                            })}
                          </ul>
                        </div>
                      </div>
                    </h3>
                    <div className={styles.methodConfig} style={{ marginBottom: "2rem" }}>
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
                          {anovaResult.table.map((row, i) => {
                            if (hasQualiFactor && (row.source === 'Tratamentos' || row.source === 'Tratamento')) return null;
                            
                            let sourceName = row.source;
                            if (row.source === 'Fator A') sourceName = quantFactorName || 'Fator A';
                            if (row.source === 'Fator B') sourceName = qualiFactorName || 'Fator B';
                            if (row.source === 'Interação AxB') sourceName = `Interação ${quantFactorName || 'A'} x ${qualiFactorName || 'B'}`;
                            if (!hasQualiFactor && (row.source === 'Tratamentos' || row.source === 'Tratamento')) sourceName = quantFactorName || 'Tratamentos';

                            return (
                              <tr key={i}>
                                <td>{sourceName}</td>
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
                        </tbody>
                      </table>
                    </div>
                    <div style={{ paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                       <strong>Coeficiente de Variação (CV):</strong> {anovaResult.cv.toFixed(2)}%
                    </div>

                  </div>
              )}

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

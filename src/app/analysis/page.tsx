'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  anovaDIC,
  anovaDBC,
  tukeyHSD,
  scottKnott,
  dunnettTest,
  formatNumber,
  anovaFatorialDuplo,
} from '@/lib/statistics';
import type { AnovaResult, TukeyResult, ScottKnottResult, DunnettResult, DesignType } from '@/lib/statistics';
import { exportPDF, exportCSV, exportMeansWord, exportAnovaWord } from '@/lib/export';
import { validateGrid, getCellStates } from '@/lib/validation';
import { HistoryEntry, useAnalysisHistory } from '@/hooks/useAnalysisHistory';
import Header from '@/components/Layout/Header';
import HistoryPanel from '@/components/AnalysisHistory/HistoryPanel';
import styles from './analysis.module.css';
import ResultsChart from './ResultsChart';
import { TidyDataGrid } from './TidyDataGrid';
import type { TidyDataRow, TidyDataMapping, TidyRawState } from './TidyDataGrid';

const STEPS = [
  { label: 'Tipo de Análise', icon: '🧪' },
  { label: 'Configurar', icon: '⚙️' },
  { label: 'Inserir Dados', icon: '📊' },
  { label: 'Pós-teste', icon: '🎯' },
  { label: 'Resultados', icon: '📋' },
];

export default function AnalysisPage() {
  const [currentStep, setCurrentStep] = useState(0);

  // Setup state
  const [design, setDesign] = useState<DesignType>('DIC');
  const [numTreatments, setNumTreatments] = useState<number | string>(4);
  const [numReps, setNumReps] = useState<number | string>(5);
  const [treatmentNames, setTreatmentNames] = useState<string[]>([]);
  const [variableName, setVariableName] = useState('');

  // Data state
  const [data, setData] = useState<(number | string)[][]>([]);

  // Results state
  const [anovaResult, setAnovaResult] = useState<AnovaResult | null>(null);
  const [tukeyResult, setTukeyResult] = useState<TukeyResult | null>(null);
  const [scottKnottResult, setScottKnottResult] = useState<ScottKnottResult | null>(null);
  const [dunnettResult, setDunnettResult] = useState<DunnettResult | null>(null);
  const [comparisonMethod, setComparisonMethod] = useState<'none' | 'tukey' | 'scott-knott' | 'dunnett'>('none');
  const [controlTreatment, setControlTreatment] = useState<string>('');
  const [experimentType, setExperimentType] = useState<'simple' | 'factorial'>('simple');
  const [tidyDataFull, setTidyDataFull] = useState<{
    data: TidyDataRow[];
    mapping: TidyDataMapping;
    rawState?: TidyRawState;
  } | null>(null);
  const [testSelected, setTestSelected] = useState(false);
  const [alpha, setAlpha] = useState(0.05);
  const [customAlpha, setCustomAlpha] = useState('');

  // UI state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [is3dChart, setIs3dChart] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);
  const history = useAnalysisHistory();

  // Parsed data for logic (converts strings to numbers, invalid strings to 0)
  const chartRef = useRef<import('./ResultsChart').ResultsChartRef>(null);

  const parsedData = useMemo(() => {
    return data.map((row) =>
      row.map((val) => {
        if (typeof val === 'number') return val;
        const strVal = String(val).trim();
        if (strVal === '') return null; // Accept missing data as null
        const num = parseFloat(strVal.replace(',', '.'));
        return isNaN(num) ? null : num;
      })
    );
  }, [data]);

  // Validation (computed from parsed data)
  const validation = useMemo(() => {
    if (parsedData.length === 0) return null;
    return validateGrid(parsedData, treatmentNames);
  }, [parsedData, treatmentNames]);

  const cellStates = useMemo(() => {
    if (!validation) return new Map<string, 'error' | 'warning'>();
    return getCellStates(validation);
  }, [validation]);

  // Generate initial data grid
  const handleGenerateGrid = useCallback(() => {
    if (!variableName.trim()) {
      alert('Informe o nome da variável resposta antes de continuar.');
      return;
    }

    const nt = parseInt(String(numTreatments));
    const nr = parseInt(String(numReps));

    if (isNaN(nt) || nt < 2) {
      alert('O número de tratamento deve ser no mínimo 2.');
      return;
    }
    if (isNaN(nr) || nr < 2) {
      alert(design === 'DIC' ? 'O número de repetições deve ser no mínimo 2.' : 'O número de blocos deve ser no mínimo 2.');
      return;
    }

    if (experimentType === 'factorial') {
      setCurrentStep(2);
      return;
    }

    const names = Array.from({ length: nt }, (_, i) =>
      treatmentNames[i] || `Trat ${i + 1}`
    );
    setTreatmentNames(names);
    setData(
      Array.from({ length: nt }, () =>
        Array.from({ length: nr }, () => '')
      )
    );
    setCurrentStep(2);
  }, [numTreatments, numReps, treatmentNames, variableName, design]);

  // Update cell value
  const handleCellChange = useCallback(
    (treatIdx: number, repIdx: number, value: string) => {
      setData((prev) => {
        const next = prev.map((row) => [...row]);
        next[treatIdx][repIdx] = value;
        return next;
      });
    },
    []
  );

  // Update treatment name
  const handleTreatmentNameChange = useCallback(
    (idx: number, value: string) => {
      setTreatmentNames((prev) => {
        const next = [...prev];
        next[idx] = value;
        return next;
      });
    },
    []
  );

  // Handle paste from Excel
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text');
      const rows = text.split('\n').filter((r) => r.trim().length > 0);

      const pastedData: (number | string | null)[][] = rows.map((row) =>
        row.split('\t').map((cell) => {
          const str = cell.trim();
          if (str === '') return null;
          const num = parseFloat(str.replace(',', '.'));
          return isNaN(num) ? null : num;
        })
      );

      if (pastedData.length > 0) {
        const newTreatments = pastedData.length;
        const newReps = Math.max(...pastedData.map((r) => r.length));

        setNumTreatments(newTreatments);
        setNumReps(newReps);

        // Pad rows to same length with empty strings
        const padded = pastedData.map((row) => {
          while (row.length < newReps) row.push('');
          return row;
        });

        setData(padded as (string | number)[][]);

        // Generate treatment names if needed
        if (treatmentNames.length < newTreatments) {
          setTreatmentNames(
            Array.from({ length: newTreatments }, (_, i) =>
              treatmentNames[i] || `Trat ${i + 1}`
            )
          );
        }
      }
    },
    [treatmentNames]
  );

  // Run analysis
  const handleAnalyze = useCallback(() => {
    // Validate variable name
    if (!variableName.trim()) {
      alert('Informe o nome da variável resposta antes de continuar.');
      return;
    }

    // Validate data
    if (validation && !validation.isValid) {
      alert(validation.summary);
      return;
    }

    const hasData = parsedData.some((row) => row.some((v) => v !== 0));
    if (!hasData) {
      alert('Insira os dados antes de analisar.');
      return;
    }

    const result =
      design === 'DIC'
        ? anovaDIC(parsedData, treatmentNames, alpha)
        : anovaDBC(parsedData, treatmentNames, alpha);

    setAnovaResult(result);

    // Reset post-hoc — user will pick in next step
    setComparisonMethod('none');
    setControlTreatment('');
    setTestSelected(false);
    setTukeyResult(null);
    setScottKnottResult(null);
    setDunnettResult(null);

    // Always go to post-hoc selection, even if not significant (user preference)
    setCurrentStep(3);
  }, [data, design, treatmentNames, alpha, validation, variableName, parsedData]);

  const handleAnalyzeFactorial = useCallback((mappedData: TidyDataRow[], mapping: TidyDataMapping, rawState: TidyRawState) => {
    // Save to state
    setTidyDataFull({ data: mappedData, mapping, rawState });
    
    // Run factorial ANOVA
    const result = anovaFatorialDuplo(mappedData, design as 'DIC' | 'DBC', alpha);
    setAnovaResult(result);

    setComparisonMethod('none');
    setControlTreatment('');
    setTestSelected(false);
    setTukeyResult(null);
    setScottKnottResult(null);
    setDunnettResult(null);

    // Always go to post-hoc selection, even if not significant (user preference)
    setCurrentStep(3);
  }, [design, alpha]);

  // Run post-hoc test (called from results page/Step 3)
  const handleRunPostHoc = useCallback((method: 'tukey' | 'scott-knott' | 'dunnett', control?: string) => {
    if (!anovaResult) return;
    setComparisonMethod(method);
    if (method === 'tukey') {
      const res = tukeyHSD(anovaResult, parsedData, alpha);
      setTukeyResult(res);
      setTestSelected(true);
    } else if (method === 'scott-knott') {
      const sk = scottKnott(anovaResult, parsedData, alpha);
      setScottKnottResult(sk);
      setTestSelected(true);
    } else if (method === 'dunnett') {
      const activeControl = control || controlTreatment;
      // Logic executed on 'Analisar' button or right away if control is passed
      if (activeControl) {
        try {
          const dunnett = dunnettTest(anovaResult, parsedData, activeControl, alpha);
          setDunnettResult(dunnett);
          setTestSelected(true);
        } catch (e: any) {
          alert('Erro ao calcular Dunnett: ' + e.message);
          setTestSelected(false);
        }
      } else {
        setTestSelected(false);
      }
    }
  }, [anovaResult, parsedData, alpha, controlTreatment]);

  // Restart
  const handleRestart = useCallback(() => {
    setCurrentStep(0);
    setAnovaResult(null);
    setTukeyResult(null);
    setScottKnottResult(null);
    setDunnettResult(null);
    setControlTreatment('');
    setData([]);
    setVariableName('');
    setAlpha(0.05);
    setCustomAlpha('');
  }, []);

  // Export handlers
  const handleExportPDF = useCallback(() => {
    if (!anovaResult) return;
    const method = comparisonMethod === 'none' ? 'tukey' : comparisonMethod;
    // @ts-ignore TODO update export func signature
    exportPDF(anovaResult, tukeyResult, scottKnottResult, method, parsedData, alpha, dunnettResult);
  }, [anovaResult, tukeyResult, scottKnottResult, dunnettResult, comparisonMethod, parsedData, alpha]);

  const handleExportCSV = useCallback(() => {
    if (!anovaResult) return;
    const method = comparisonMethod === 'none' ? 'tukey' : comparisonMethod;
    // @ts-ignore TODO update export func signature
    exportCSV(anovaResult, tukeyResult, scottKnottResult, method, alpha, dunnettResult);
  }, [anovaResult, tukeyResult, scottKnottResult, dunnettResult, comparisonMethod, alpha]);

  const tablesToRender = useMemo(() => {
    const tables: { title: string; dmsText: React.ReactNode; dmsValueStr?: string; groups: any[] }[] = [];
    if (comparisonMethod === 'none') return tables;

    if (comparisonMethod === 'tukey' && tukeyResult) {
      const getDmsText = (res: any) => {
        const dmsVal = alpha <= 0.01 ? res.dms01 : res.dms05;
        const percent = alpha <= 0.01 ? '1%' : '5%';
        return `DMS (${percent}) = ${dmsVal !== null ? formatNumber(dmsVal, 4) : 'Variável'}`;
      };
      const getDmsVal = (res: any) => {
        const dmsVal = alpha <= 0.01 ? res.dms01 : res.dms05;
        return dmsVal !== null ? formatNumber(dmsVal, 2) : 'Variável (TK)';
      };

      if (tukeyResult.isFactorial && tukeyResult.mainA && tukeyResult.mainB) {
        tables.push({
          title: tidyDataFull?.mapping.factorA || "Fator A",
          dmsText: getDmsText(tukeyResult.mainA),
          dmsValueStr: getDmsVal(tukeyResult.mainA),
          groups: tukeyResult.mainA.groups
        });
        tables.push({
          title: tidyDataFull?.mapping.factorB || "Fator B",
          dmsText: getDmsText(tukeyResult.mainB),
          dmsValueStr: getDmsVal(tukeyResult.mainB),
          groups: tukeyResult.mainB.groups
        });
      } else {
        tables.push({
          title: experimentType === 'simple' ? "Tratamentos" : "Interação (Fator A x Fator B)",
          dmsText: getDmsText(tukeyResult),
          dmsValueStr: getDmsVal(tukeyResult),
          groups: tukeyResult.groups
        });
      }
    } else if (comparisonMethod === 'scott-knott' && scottKnottResult) {
      if (scottKnottResult.isFactorial && scottKnottResult.mainA && scottKnottResult.mainB) {
        tables.push({
          title: tidyDataFull?.mapping.factorA || "Fator A",
          dmsText: `${scottKnottResult.mainA.numGroups} grupo(s) identificado(s)`,
          groups: scottKnottResult.mainA.groups
        });
        tables.push({
          title: tidyDataFull?.mapping.factorB || "Fator B",
          dmsText: `${scottKnottResult.mainB.numGroups} grupo(s) identificado(s)`,
          groups: scottKnottResult.mainB.groups
        });
      } else {
        tables.push({
          title: experimentType === 'simple' ? "Tratamentos" : "Interação (Fator A x Fator B)",
          dmsText: `${scottKnottResult.numGroups} grupo(s) identificado(s)`,
          groups: scottKnottResult.groups
        });
      }
    } else if (comparisonMethod === 'dunnett' && dunnettResult) {
      tables.push({
        title: experimentType === 'simple' ? "Dunnett (Tratamentos vs Control)" : "Dunnett (Iteração vs Control)",
        dmsText: `DMS (${alpha <= 0.01 ? '1%' : '5%'}) = ${dunnettResult.dms05 !== null ? formatNumber(alpha <= 0.01 ? dunnettResult.dms01! : dunnettResult.dms05!, 4) : 'Variável'}`,
        dmsValueStr: dunnettResult.dms05 !== null ? formatNumber(alpha <= 0.01 ? dunnettResult.dms01! : dunnettResult.dms05!, 2) : 'Variável',
        groups: [
          { treatmentName: `${dunnettResult.controlName} (Controle)`, mean: dunnettResult.controlMean, difference: '', letter: '-' },
          ...dunnettResult.comparisons.map(c => ({
            treatmentName: c.treatmentName,
            mean: c.mean,
            difference: formatNumber(c.difference, 4),
            letter: c.significant ? '*' : 'ns'
          }))
        ]
      });
    }
    return tables;
  }, [comparisonMethod, tukeyResult, scottKnottResult, dunnettResult, alpha, experimentType, tidyDataFull]);

  const handleExportMeansWord = useCallback(() => {
    if (!anovaResult) return;
    const tablesForExport = tablesToRender.map(t => ({
      title: t.title,
      dmsValueStr: t.dmsValueStr,
      groups: t.groups
    }));
    exportMeansWord(variableName, comparisonMethod, alpha, anovaResult.cv, tablesForExport);
  }, [anovaResult, comparisonMethod, variableName, alpha, tablesToRender]);

  const handleExportAnovaWord = useCallback(() => {
    if (!anovaResult) return;
    exportAnovaWord(anovaResult, variableName, alpha);
  }, [anovaResult, variableName, alpha]);

  const handleExportChartWord = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.exportToWord(variableName || 'Variável');
    }
  }, [variableName]);

  // Save to history
  const handleSave = useCallback(async () => {
    if (!anovaResult) return;
    const savedId = await history.save({
      design,
      variableName,
      numTreatments: Number(numTreatments),
      numReps: Number(numReps),
      treatmentNames,
      data: data, // Save raw data (with strings) for better persistence
      experimentType,
      tidyDataFull,
      anovaResult,
      tukeyResult,
      scottKnottResult,
      dunnettResult,
      controlTreatment,
      comparisonMethod: comparisonMethod === 'none' ? 'tukey' : comparisonMethod,
      alpha,
    });
    if (savedId) {
      setShowSavedToast(true);
    }
  }, [
    anovaResult,
    tukeyResult,
    scottKnottResult,
    dunnettResult,
    controlTreatment,
    design,
    numTreatments,
    numReps,
    treatmentNames,
    data,
    experimentType,
    tidyDataFull,
    comparisonMethod,
    history,
    alpha,
  ]);

  // Auto-hide toast
  useEffect(() => {
    if (showSavedToast) {
      const timer = setTimeout(() => setShowSavedToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSavedToast]);

  // Load from history
  const handleLoadHistory = useCallback(
    (entry: HistoryEntry) => {
      setDesign(entry.design);
      setVariableName(entry.variableName || '');
      setNumTreatments(entry.numTreatments);
      setNumReps(entry.numReps);
      setTreatmentNames(entry.treatmentNames);
      setData(entry.data as (string | number)[][]);
      setTidyDataFull(entry.tidyDataFull || null);
      setAnovaResult(entry.anovaResult);
      setTukeyResult(entry.tukeyResult);
      setScottKnottResult(entry.scottKnottResult);
      setDunnettResult(entry.dunnettResult || null);
      setControlTreatment(entry.controlTreatment || '');
      setComparisonMethod(entry.comparisonMethod);
      setAlpha(entry.alpha ?? 0.05);

      const isFactorial = entry.experimentType === 'factorial' || (entry.anovaResult && 'factorialSignificance' in entry.anovaResult);
      setExperimentType(isFactorial ? 'factorial' : 'simple');

      setCurrentStep(4);
      setHistoryOpen(false);
    },
    []
  );

  // Load from URL if historyId is present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const historyId = params.get('historyId');
      if (historyId && history.entries.length > 0) {
        const entry = history.get(historyId);
        if (entry) {
          handleLoadHistory(entry);
          window.history.replaceState({}, '', '/analysis');
        }
      }
    }
  }, [history.entries, history.get, handleLoadHistory]);

  const isAnovaSignificant = useMemo(() => {
    if (!anovaResult) return false;
    if (experimentType === 'factorial') {
      const fs = (anovaResult as any).factorialSignificance;
      return !!(fs?.factorA || fs?.factorB || fs?.interaction);
    } else {
      const treatRow = anovaResult.table.find((r) => r.source === 'Tratamento' || r.source === 'Tratamentos');
      return !!(treatRow?.pValue !== null && treatRow?.pValue !== undefined && treatRow.pValue <= alpha);
    }
  }, [anovaResult, experimentType, alpha]);

  const canAnalyze = parsedData.length > 0 && parsedData.some((r) => r.some((v) => v !== null));

  return (
    <>
      <Header />
      <div className={styles.container}>
        {/* Title + Toolbar */}
        <h1 className={styles.title}>
          <span className="gradient-text">Análise Estatística</span>
        </h1>
        <div className={styles.toolbar}>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Configure seu experimento, insira os dados e obtenha resultados completos.
          </p>
          <div className={styles.toolbarSpacer} />
          <button
            className={styles.btnIcon}
            onClick={() => setHistoryOpen(true)}
          >
            ⭐ Favoritos
          </button>
        </div>

        {/* Stepper */}
        <div className={styles.stepper}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <button
                className={`${styles.step} ${i === currentStep ? styles.stepActive : ''
                  } ${i < currentStep ? styles.stepCompleted : ''}`}
                onClick={() => {
                  if (i < currentStep) setCurrentStep(i);
                }}
              >
                <span className={styles.stepNumber}>
                  {i < currentStep ? '✓' : i + 1}
                </span>
                {step.label}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`${styles.stepConnector} ${i < currentStep ? styles.stepConnectorActive : ''
                    }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Analysis Type Selection */}
        {currentStep === 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>🧪</span>
              Qual análise você deseja realizar?
            </h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>
              Escolha a ferramenta estatística que melhor responde aos objetivos da sua pesquisa.
            </p>

            <div className={styles.analysisTypeGrid}>
              <button
                className={styles.analysisTypeCard}
                onClick={() => setCurrentStep(1)}
              >
                <div className={styles.analysisTypeIcon}>📊</div>
                <div className={styles.analysisTypeTitle}>Comparação de Médias</div>
                <div className={styles.analysisTypeName}>ANOVA e Pós-testes</div>
                <div className={styles.analysisTypeDesc}>
                  Descubra se há diferenças significativas entre os tratamentos do seu experimento.
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', fontStyle: 'italic', minHeight: '36px' }}>
                  Ideal para fatores qualitativos (ex: cultivares, genótipos, dietas, marcas).
                </div>
                <div className={styles.analysisTypeTests}>
                  <span>DIC / DBC</span>
                  <span>Fatorial</span>
                  <span>Tukey, Scott-Knott e Duncan</span>
                </div>
              </button>

              <button
                className={`${styles.analysisTypeCard} ${styles.analysisTypeCardDisabled}`}
                disabled
              >
                <div className={styles.analysisTypeBadge}>Em breve</div>
                <div className={styles.analysisTypeIcon}>📈</div>
                <div className={styles.analysisTypeTitle}>Regressão</div>
                <div className={styles.analysisTypeName}>Modelagem de Dados</div>
                <div className={styles.analysisTypeDesc}>
                  Entenda o comportamento de uma variável em resposta a outra através do ajuste de curvas.
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', fontStyle: 'italic', minHeight: '36px' }}>
                  Ideal para fatores quantitativos (ex: doses de adubo, concentrações, tempo).
                </div>
                <div className={styles.analysisTypeTests}>
                  <span>Linear</span>
                  <span>Quadrática</span>
                </div>
              </button>

              <button
                className={`${styles.analysisTypeCard} ${styles.analysisTypeCardDisabled}`}
                disabled
              >
                <div className={styles.analysisTypeBadge}>Em breve</div>
                <div className={styles.analysisTypeIcon}>🔗</div>
                <div className={styles.analysisTypeTitle}>Correlação</div>
                <div className={styles.analysisTypeName}>Associação Linear</div>
                <div className={styles.analysisTypeDesc}>
                  Avalie a força e a direção da relação entre duas ou mais variáveis contínuas.
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', fontStyle: 'italic', minHeight: '36px' }}>
                  Descubra se variáveis crescem ou diminuem juntas, sem prever causa e efeito.
                </div>
                <div className={styles.analysisTypeTests}>
                  <span>Pearson</span>
                  <span>Spearman</span>
                </div>
              </button>

              <button
                className={`${styles.analysisTypeCard} ${styles.analysisTypeCardDisabled}`}
                disabled
              >
                <div className={styles.analysisTypeBadge}>Em breve</div>
                <div className={styles.analysisTypeIcon}>📝</div>
                <div className={styles.analysisTypeTitle}>Descritiva</div>
                <div className={styles.analysisTypeName}>Resumo de Dados</div>
                <div className={styles.analysisTypeDesc}>
                  Compreenda rapidamente o perfil da sua amostra com medidas estatísticas básicas.
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', fontStyle: 'italic', minHeight: '36px' }}>
                  Passo inicial fundamental para explorar e conhecer os dados do seu estudo.
                </div>
                <div className={styles.analysisTypeTests}>
                  <span>Média, Mediana</span>
                  <span>Desvio Padrão, CV%</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Setup */}
        {currentStep === 1 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>⚙️</span>
              Configuração — Comparação de Médias
            </h2>

            {/* Experiment Type Toggle */}
            <div className={styles.field} style={{ marginBottom: 'var(--space-xl)' }}>
              <label className={styles.label}>Tipo de Experimento</label>
              <div className={styles.designToggle}>
                <button
                  className={`${styles.designOption} ${experimentType === 'simple' ? styles.designOptionActive : ''}`}
                  onClick={() => setExperimentType('simple')}
                >
                  <div className={styles.designOptionTitle}>Simples (1 Fator)</div>
                  <div className={styles.designOptionDesc}>
                    Entrada via grade clássica (Tratamentos x Repetições)
                  </div>
                </button>
                <button
                  className={`${styles.designOption} ${experimentType === 'factorial' ? styles.designOptionActive : ''}`}
                  onClick={() => setExperimentType('factorial')}
                >
                  <div className={styles.designOptionTitle}>Fatorial (2 ou + Fatores)</div>
                  <div className={styles.designOptionDesc}>
                    Entrada via colunas (Tidy Data) diretamente do Excel
                  </div>
                </button>
              </div>
            </div>

            <div className={styles.designToggle} style={{ marginBottom: 'var(--space-lg)' }}>
              <button
                className={`${styles.designOption} ${design === 'DIC' ? styles.designOptionActive : ''
                  }`}
                onClick={() => setDesign('DIC')}
              >
                <div className={styles.designOptionTitle}>DIC</div>
                <div className={styles.designOptionDesc}>
                  Delineamento Inteiramente Casualizado
                </div>
              </button>
              <button
                className={`${styles.designOption} ${design === 'DBC' ? styles.designOptionActive : ''
                  }`}
                onClick={() => setDesign('DBC')}
              >
                <div className={styles.designOptionTitle}>DBC</div>
                <div className={styles.designOptionDesc}>
                  Delineamento em Blocos Casualizados
                </div>
              </button>
            </div>

            <div className={styles.field} style={{ marginBottom: 'var(--space-lg)' }}>
              <label className={styles.label}>Nome da variável resposta *</label>
              <input
                className={styles.input}
                value={variableName}
                onChange={(e) => setVariableName(e.target.value)}
                placeholder="Ex: Altura de planta (cm), Produtividade (kg/ha)"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Este campo identifica a medida analisada no relatório. Os valores observados serão inseridos na próxima etapa.
              </span>
            </div>

            {experimentType === 'simple' ? (
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Nº de Tratamentos</label>
                  <input
                    type="number"
                    className={styles.input}
                    min={2}
                    max={20}
                    value={numTreatments}
                    onChange={(e) => setNumTreatments(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {design === 'DIC' ? 'Nº de Repetições' : 'Nº de Blocos'}
                  </label>
                  <input
                    type="number"
                    className={styles.input}
                    min={2}
                    max={30}
                    value={numReps}
                    onChange={(e) => setNumReps(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)', background: 'rgba(99, 220, 190, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 220, 190, 0.2)' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <strong>Atenção:</strong> Na próxima etapa, você deverá colar sua planilha estruturada em colunas (Fator A, Fator B, Bloco, Resposta) e mapear cada termo.
                </p>
              </div>
            )}

            <div className={styles.field} style={{ marginBottom: 'var(--space-lg)' }}>
              <label className={styles.label}>Nível de significância (α)</label>
              <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginTop: 'var(--space-xs)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <input type="radio" name="alpha" checked={alpha === 0.05 && !customAlpha} onChange={() => { setAlpha(0.05); setCustomAlpha(''); }} />
                  5% (0.05) — padrão
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <input type="radio" name="alpha" checked={alpha === 0.01 && !customAlpha} onChange={() => { setAlpha(0.01); setCustomAlpha(''); }} />
                  1% (0.01)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <input type="radio" name="alpha" checked={!!customAlpha} onChange={() => setCustomAlpha(String(alpha))} />
                  Personalizado:
                  <input
                    type="number"
                    className={styles.input}
                    style={{ width: '80px', padding: '4px 8px' }}
                    step="0.01"
                    min="0.001"
                    max="0.20"
                    value={customAlpha}
                    onFocus={() => { if (!customAlpha) setCustomAlpha(String(alpha)); }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomAlpha(val);
                      const num = parseFloat(val);
                      if (!isNaN(num) && num > 0 && num < 1) setAlpha(num);
                    }}
                    placeholder="0.05"
                  />
                </label>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Define o critério de decisão da ANOVA e do pós-teste. Valores menores tornam o teste mais rigoroso.
              </span>
            </div>

            <div className={styles.buttonRow}>
              <button className={styles.btnSecondary} onClick={() => setCurrentStep(0)}>
                ← Voltar
              </button>
              <button className={styles.btnPrimary} onClick={handleGenerateGrid}>
                Gerar Tabela →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Data Input */}
        {currentStep === 2 && experimentType === 'simple' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>📊</span>
              Entrada de Dados — {variableName || 'Dados'}
            </h2>

            <div className={styles.pasteHint}>
              💡 Dica: Copie dados do Excel e cole diretamente na tabela (Ctrl+V)
            </div>


            <div className={styles.dataGrid} onPaste={handlePaste}>
              <table className={styles.dataTable} ref={tableRef}>
                <thead>
                  <tr>
                    <th>Tratamento</th>
                    {Array.from({ length: Number(numReps) || 0 }, (_, i) => (
                      <th key={i}>
                        {design === 'DIC' ? `Rep ${i + 1}` : `Bloco ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, tIdx) => (
                    <tr key={tIdx}>
                      <td className={styles.treatmentNameCell}>
                        <input
                          className={styles.treatmentInput}
                          value={treatmentNames[tIdx] || ''}
                          onChange={(e) =>
                            handleTreatmentNameChange(tIdx, e.target.value)
                          }
                          placeholder={`Trat ${tIdx + 1}`}
                        />
                      </td>
                      {row.map((value, rIdx) => {
                        const cellState = cellStates.get(`${tIdx}-${rIdx}`);
                        return (
                          <td key={rIdx}>
                            <input
                              className={`${styles.cellInput} ${cellState === 'error' ? styles.cellError : ''
                                } ${cellState === 'warning'
                                  ? styles.cellWarning
                                  : ''
                                }`}
                              type="number"
                              step="any"
                              value={value}
                              onChange={(e) =>
                                handleCellChange(tIdx, rIdx, e.target.value)
                              }
                              placeholder="0"
                              title={
                                cellState === 'error'
                                  ? 'Célula vazia — preencha para analisar'
                                  : cellState === 'warning'
                                    ? 'Possível outlier detectado'
                                    : undefined
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.buttonRow}>
              <button
                className={styles.btnSecondary}
                onClick={() => setCurrentStep(1)}
              >
                ← Voltar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleAnalyze}
                disabled={!canAnalyze}
              >
                Selecionar Pós-teste →
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && experimentType === 'factorial' && (
          <div className={styles.fadeIn}>
            <TidyDataGrid
              design={design as 'DIC' | 'DBC'}
              onAnalyze={handleAnalyzeFactorial}
              onBack={() => setCurrentStep(1)}
              initialState={tidyDataFull?.rawState}
            />
          </div>
        )}

        {/* Step 3: Post-hoc Selection */}
        {currentStep === 3 && anovaResult && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>🎯</span>
              Qual teste de médias deseja aplicar?
            </h2>
            
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              {isAnovaSignificant ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', margin: 0 }}>
                  Como a ANOVA foi significativa para <em>{variableName}</em>, você pode escolher um teste para comparar as médias dos tratamentos.
                </p>
              ) : (
                <div style={{ padding: 'var(--space-md)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ color: 'var(--color-warning, #d97706)', fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠️</span>
                    <span>
                      <strong>Aviso:</strong> A ANOVA <strong>não foi significativa</strong> (p &gt; {alpha}) para <em>{variableName}</em>. A rigor estatístico, não é recomendado realizar testes de médias de comparações múltiplas para tratamentos com efeitos iguais, mas acompanhando o fluxo tradicional de alguns softwares como o Sisvar, você pode prosseguir abaixo.
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className={styles.analysisTypeGridSmall}>
              <button
                className={`${styles.analysisTypeCardSmall} ${comparisonMethod === 'tukey' ? styles.analysisTypeCardActive : ''}`}
                onClick={() => handleRunPostHoc('tukey')}
              >
                <div className={styles.analysisTypeIconSmall}>📊</div>
                <div className={styles.analysisTypeTitleSmall}>Tukey</div>
                <div className={styles.analysisTypeDescSmall}>
                  Compara todas as médias entre si.
                </div>
              </button>
              <button
                className={`${styles.analysisTypeCardSmall} ${comparisonMethod === 'scott-knott' ? styles.analysisTypeCardActive : ''}`}
                onClick={() => handleRunPostHoc('scott-knott')}
              >
                <div className={styles.analysisTypeIconSmall}>🔬</div>
                <div className={styles.analysisTypeTitleSmall}>Scott-Knott</div>
                <div className={styles.analysisTypeDescSmall}>
                  Agrupa médias sem sobreposição.
                </div>
              </button>
              <button
                className={`${styles.analysisTypeCardSmall} ${comparisonMethod === 'dunnett' ? styles.analysisTypeCardActive : ''}`}
                onClick={() => handleRunPostHoc('dunnett')}
              >
                <div className={styles.analysisTypeIconSmall}>🎯</div>
                <div className={styles.analysisTypeTitleSmall}>Dunnett</div>
                <div className={styles.analysisTypeDescSmall}>
                  Compara os tratamentos contra uma testemunha (controle).
                </div>
              </button>
              <button
                className={`${styles.analysisTypeCardSmall} ${testSelected && comparisonMethod === 'none' ? styles.analysisTypeCardActive : ''}`}
                onClick={() => { setComparisonMethod('none'); setTukeyResult(null); setScottKnottResult(null); setDunnettResult(null); setTestSelected(true); }}
              >
                <div className={styles.analysisTypeIconSmall}>➡️</div>
                <div className={styles.analysisTypeTitleSmall}>Nenhum</div>
                <div className={styles.analysisTypeDescSmall}>
                  Seguir apenas com ANOVA.
                </div>
              </button>
            </div>

            {comparisonMethod === 'dunnett' && (
              <div className={styles.field} style={{ marginTop: 'var(--space-lg)' }}>
                <label className={styles.label}>Selecione o Tratamento Testemunha (Controle)</label>
                <select 
                  className={styles.input} 
                  value={controlTreatment} 
                  onChange={(e) => {
                    const value = e.target.value;
                    setControlTreatment(value);
                    if (value) {
                       // Pre-trigger to set test selected valid
                       setTestSelected(true);
                       handleRunPostHoc('dunnett', value); // Recalculates immediately or on Analyze
                    } else {
                       setTestSelected(false);
                    }
                  }}
                >
                  <option value="">-- Escolha um tratamento --</option>
                  {anovaResult.treatmentNames.map((name, i) => (
                    <option key={i} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.buttonRow} style={{ marginTop: 'var(--space-2xl)' }}>
              <button className={styles.btnSecondary} onClick={() => setCurrentStep(2)}>
                ← Voltar aos Dados
              </button>
              <div style={{ flex: 1 }} />
              <button
                className={styles.btnPrimary}
                onClick={() => {
                  if (comparisonMethod === 'dunnett' && controlTreatment) {
                    handleRunPostHoc('dunnett'); // ensure it calculates before proceeding
                  }
                  setCurrentStep(4);
                }}
                disabled={!testSelected || (comparisonMethod === 'dunnett' && !controlTreatment)}
              >
                Analisar 🔬
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Final Results Dashboard */}
        {currentStep === 4 && anovaResult && (
          <div className={styles.resultsSection}>
            {/* Summary */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>📊</span>
                Resumo da Análise — {variableName}
              </h2>
              <div className={styles.summaryRow}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Variável</div>
                  <div className={styles.summaryValue}>{variableName}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Delineamento</div>
                  <div className={styles.summaryValue}>{anovaResult.design}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Média Geral</div>
                  <div className={styles.summaryValue}>
                    {formatNumber(anovaResult.overallMean, 2)}
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>CV (%)</div>
                  <div className={styles.summaryValue}>
                    {formatNumber(anovaResult.cv, 2)}
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>QM Resíduo</div>
                  <div className={styles.summaryValue}>
                    {formatNumber(anovaResult.mse, 4)}
                  </div>
                </div>
              </div>
            </div>

            {/* Assumptions Panel */}
            {anovaResult.assumptions && (
              <details className={styles.card} style={{ marginBottom: 'var(--space-lg)' }}>
                <summary style={{ cursor: 'pointer', outline: 'none', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                  <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                    <span className={styles.cardTitleIcon}>🔍</span>
                    Premissas do Modelo (Opcional)
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 'bold', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: '20px' }}>Clique para expandir 🔽</span>
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                  {/* Normality */}
                  <div style={{
                    padding: 'var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    background: anovaResult.assumptions.normality.passed ? 'rgba(99, 220, 190, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                    border: `1px solid ${anovaResult.assumptions.normality.passed ? 'rgba(99, 220, 190, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{anovaResult.assumptions.normality.passed ? '✅' : '❌'}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Normalidade dos Resíduos</strong>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Teste de {anovaResult.assumptions.normality.name} (p = {formatNumber(anovaResult.assumptions.normality.pValue, 4)})
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      {anovaResult.assumptions.normality.passed
                        ? 'Os resíduos seguem distribuição normal, satisfazendo a premissa.'
                        : 'Os resíduos desviam da normalidade. A ANOVA pode estar comprometida.'}
                    </p>
                  </div>

                  {/* Homoscedasticity */}
                  <div style={{
                    padding: 'var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    background: anovaResult.assumptions.homoscedasticity.passed ? 'rgba(99, 220, 190, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                    border: `1px solid ${anovaResult.assumptions.homoscedasticity.passed ? 'rgba(99, 220, 190, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{anovaResult.assumptions.homoscedasticity.passed ? '✅' : '❌'}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Homogeneidade de Variâncias</strong>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Teste de {anovaResult.assumptions.homoscedasticity.name} (p = {formatNumber(anovaResult.assumptions.homoscedasticity.pValue, 4)})
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      {anovaResult.assumptions.homoscedasticity.passed
                        ? 'As variâncias são homogêneas, satisfazendo a premissa.'
                        : 'As variâncias são heterogêneas (heterocedasticidade). A precisão do teste F é reduzida.'}
                    </p>
                  </div>
                </div>
              </details>
            )}

            {/* ANOVA Table */}
            <div className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                  <span className={styles.cardTitleIcon}>📋</span>
                  Quadro da Análise de Variância (ANOVA)
                </h2>
                <button
                  className={styles.btnSecondary}
                  onClick={handleExportAnovaWord}
                  style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📝 Word (Artigo)
                </button>
              </div>
              <div className={styles.dataGrid}>
                <table className={styles.anovaTable}>
                  <thead>
                    <tr>
                      <th>FV</th>
                      <th>GL</th>
                      <th>SQ</th>
                      <th>QM</th>
                      <th>F</th>
                      <th>p-valor</th>
                      <th>Sig.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anovaResult.table.map((row, i) => (
                      <tr key={i}>
                        <td>{row.source}</td>
                        <td>{row.df}</td>
                        <td>{formatNumber(row.ss)}</td>
                        <td>
                          {row.source !== 'Total' ? formatNumber(row.ms) : '-'}
                        </td>
                        <td>
                          {row.fValue !== null ? formatNumber(row.fValue) : '-'}
                        </td>
                        <td>
                          {row.pValue !== null ? formatNumber(row.pValue) : '-'}
                        </td>
                        <td>
                          {row.significance === '**' || row.significance === '*' ? (
                            <span className={styles.sigStar}>
                              {row.significance}
                            </span>
                          ) : row.significance === 'ns' ? (
                            <span className={styles.sigNs}>ns</span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
                * significativo a {Number.isInteger(alpha * 100) ? alpha * 100 : (alpha * 100).toFixed(1)}% de probabilidade &nbsp;|&nbsp; ns: não significativo
              </div>

              {/* Interpretation */}
              {(() => {
                if (experimentType === 'factorial') {
                  const fs = (anovaResult as any).factorialSignificance;
                  const anySignificant = fs?.factorA || fs?.factorB || fs?.interaction;
                  return (
                    <div style={{
                      marginTop: 'var(--space-lg)', padding: 'var(--space-md) var(--space-lg)',
                      borderRadius: 'var(--radius-md)', background: anySignificant ? 'rgba(99, 220, 190, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                      border: `1px solid ${anySignificant ? 'rgba(99, 220, 190, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
                      fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)',
                    }}>
                      <strong style={{ color: 'var(--text-primary)' }}>📝 Interpretação Fatorial:</strong>{' '}
                      A tabela ANOVA foi desdobrada nos efeitos principais e na Interação.
                      <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-primary)' }}>
                        <li>
                          <strong>{tidyDataFull?.mapping.factorA || 'Fator A'}:</strong>{' '}
                          {fs?.factorA ? <span style={{color: 'var(--primary)'}}>Significativo</span> : 'Não significativo'}
                        </li>
                        <li>
                          <strong>{tidyDataFull?.mapping.factorB || 'Fator B'}:</strong>{' '}
                          {fs?.factorB ? <span style={{color: 'var(--primary)'}}>Significativo</span> : 'Não significativo'}
                        </li>
                        <li>
                          <strong>Interação AxB:</strong>{' '}
                          {fs?.interaction ? <span style={{color: 'var(--primary)'}}>Significativa</span> : 'Não significativa'}
                        </li>
                      </ul>
                    </div>
                  );
                }

                const treatRow = anovaResult.table.find((r) => r.source === 'Tratamento' || r.source === 'Tratamentos');
                const isSignificant = treatRow?.pValue !== null && treatRow?.pValue !== undefined && treatRow.pValue <= alpha;
                const sigLevel = treatRow?.significance;
                return (
                  <div style={{
                    marginTop: 'var(--space-lg)',
                    padding: 'var(--space-md) var(--space-lg)',
                    borderRadius: 'var(--radius-md)',
                    background: isSignificant ? 'rgba(99, 220, 190, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                    border: `1px solid ${isSignificant ? 'rgba(99, 220, 190, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                  }}>
                    <strong style={{ color: 'var(--text-primary)' }}>📝 Interpretação:</strong>{' '}
                    {isSignificant ? (
                      <>
                        O teste F foi <strong>significativo a {Number.isInteger(alpha * 100) ? alpha * 100 : (alpha * 100).toFixed(1)}% (p = {formatNumber(treatRow!.pValue!)})</strong> para a variável <em>{variableName}</em>.
                        {' '}Isso indica que <strong>existe diferença estatística entre pelo menos dois tratamentos</strong>.
                      </>
                    ) : (
                      <>
                        O teste F foi <strong>não significativo (ns)</strong> para a variável <em>{variableName}</em> (p = {formatNumber(treatRow!.pValue!)}).
                        {' '}Isso indica que <strong>não houve diferença estatística entre os tratamentos</strong>.
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Means Comparison Results (Conditional) */}
            {(comparisonMethod === 'tukey' || comparisonMethod === 'scott-knott' || comparisonMethod === 'dunnett') && (() => {
              
              if (tablesToRender.length === 0) return null;

              return (
                <div className={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                    <h2 className={styles.cardTitle} style={{ marginBottom: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={styles.cardTitleIcon}>🔤</span>
                        <span>Comparação de Médias</span>
                      </div>
                      <span style={{ 
                        background: 'rgba(99, 220, 190, 0.15)', 
                        color: 'var(--primary, #63dcbe)', 
                        border: '1px solid rgba(99, 220, 190, 0.3)',
                        padding: '4px 12px', 
                        borderRadius: 'var(--radius-lg, 12px)', 
                        fontSize: '0.9rem', 
                        fontWeight: '700',
                        letterSpacing: '0.5px'
                      }}>
                        {comparisonMethod === 'tukey' ? 'TESTE DE TUKEY' : comparisonMethod === 'scott-knott' ? 'TESTE DE SCOTT-KNOTT' : 'TESTE DE DUNNETT'}
                      </span>
                    </h2>
                    <button
                      className={styles.btnSecondary}
                      onClick={handleExportMeansWord}
                      style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📝 Word (Artigo)
                    </button>
                  </div>

                  {tablesToRender.map((table, idx) => (
                    <div key={idx} style={{ marginBottom: idx < tablesToRender.length - 1 ? '1.5rem' : '0' }}>
                      {tablesToRender.length > 1 && (
                        <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                          Efeito Principal: <strong>{table.title}</strong>
                        </h3>
                      )}
                      
                      <div className={styles.alphaSelect}>
                        {comparisonMethod === 'tukey' ? (
                          <>Teste de Tukey (HSD) — {table.dmsText}</>
                        ) : comparisonMethod === 'scott-knott' ? (
                          <>Teste de Scott-Knott — {table.dmsText}</>
                        ) : (
                          <>Teste de Dunnett — {table.dmsText}</>
                        )}
                      </div>
                      <table className={styles.meansTable}>
                        <thead>
                          <tr>
                            <th>Tratamento</th>
                            <th>Média</th>
                            {comparisonMethod === 'dunnett' && <th>Diferença</th>}
                            <th>{comparisonMethod === 'dunnett' ? 'Sig.' : 'Grupo'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...table.groups].sort((a, b) => b.mean - a.mean).map((g, i) => (
                            <tr key={i}>
                              <td>{g.treatmentName}</td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>
                                {formatNumber(g.mean, 4)}
                              </td>
                              {comparisonMethod === 'dunnett' && (
                                <td style={{ fontFamily: 'var(--font-mono)' }}>
                                  {g.difference || '-'}
                                </td>
                              )}
                              <td>
                                <span className={comparisonMethod === 'dunnett' ? (g.letter === '*' ? styles.sigStar : (g.letter === 'ns' ? styles.sigNs : styles.letterBadge)) : styles.letterBadge}>{g.letter}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
                    {comparisonMethod === 'dunnett' ? 
                      '* = difere da testemunha (p < ' + alpha + '); ns = não significativo.'
                    :
                      `Médias seguidas da mesma letra não diferem entre si ao nível de ${alpha * 100}% de probabilidade.`
                    }
                  </p>
                  <button
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.8rem', marginTop: 'var(--space-md)' }}
                    onClick={() => setCurrentStep(3)}
                  >
                    🔄 Trocar Teste de Médias
                  </button>
                </div>
              );
            })()}

            {/* Chart */}
            <div className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                  <span className={styles.cardTitleIcon}>📈</span>
                  Gráfico de Médias
                </h2>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button
                    className={styles.btnSecondary}
                    onClick={() => setIs3dChart(!is3dChart)}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {is3dChart ? '🔄 Visão 2D' : '🧊 Visão 3D'}
                  </button>
                  <button
                    className={styles.btnSecondary}
                    onClick={handleExportChartWord}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📝 Word (Artigo)
                  </button>
                </div>
              </div>
              <div className={styles.chartContainer}>
                <ResultsChart
                  ref={chartRef}
                  is3d={is3dChart}
                  anovaResult={anovaResult}
                  groups={
                    comparisonMethod === 'tukey'
                      ? tukeyResult?.groups.map((g) => ({
                        name: g.treatmentName,
                        mean: g.mean,
                        letter: g.letter,
                      })) || []
                      : comparisonMethod === 'scott-knott'
                      ? scottKnottResult?.groups.map((g) => ({
                        name: g.treatmentName,
                        mean: g.mean,
                        letter: g.letter,
                      })) || []
                      : dunnettResult?.comparisons.map((g) => ({
                        name: g.treatmentName,
                        mean: g.mean,
                        letter: g.significant ? '*' : 'ns',
                      })) || []
                  }
                  data={parsedData}
                />
              </div>
            </div>

            {/* Final Actions */}
            <div className={styles.buttonRow}>
              <button className={styles.btnSecondary} onClick={handleRestart}>
                ← Nova Análise
              </button>
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  let isSignificant = false;
                  if (experimentType === 'factorial') {
                    const fs = (anovaResult as any).factorialSignificance;
                    isSignificant = fs?.factorA || fs?.factorB || fs?.interaction;
                  } else {
                    const treatRow = anovaResult.table.find((r) => r.source === 'Tratamento' || r.source === 'Tratamentos');
                    isSignificant = treatRow?.pValue !== null && treatRow?.pValue !== undefined && treatRow.pValue < alpha;
                  }
                  setCurrentStep(isSignificant ? 3 : 2);
                }}
              >
                ← Voltar
              </button>
              <div style={{ flex: 1 }} />
              <button
                className={`${styles.btnIcon} ${styles.btnSuccess}`}
                onClick={handleSave}
              >
                ⭐ Favoritar
              </button>
              <button className={styles.btnIcon} onClick={handleExportCSV}>
                📊 CSV
              </button>
              <button className={styles.btnIcon} onClick={handleExportPDF}>
                📄 PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Panel */}
      <HistoryPanel
        isOpen={historyOpen}
        entries={history.entries}
        onClose={() => setHistoryOpen(false)}
        onLoad={handleLoadHistory}
        onDelete={history.remove}
      />

      {/* Saved Toast */}
      {showSavedToast && (
        <div className={styles.savedToast}>✓ Adicionado aos Favoritos!</div>
      )}
    </>
  );
}

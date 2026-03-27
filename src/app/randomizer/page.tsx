'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Header from '@/components/Layout/Header';
import { exportLayoutPDF, exportLayoutDocx } from '@/lib/export';
import styles from './randomizer.module.css';

type Plot = {
  id: number;
  treatment: string;
  rep: number;
};

export default function RandomizerPage() {
  const [numTreatments, setNumTreatments] = useState<number | string>(4);
  const [numReps, setNumReps] = useState<number | string>(5);
  const [useCustomNames, setUseCustomNames] = useState(false);
  const [customNames, setCustomNames] = useState<string[]>([]);
  
  const [layout, setLayout] = useState<Plot[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [columns, setColumns] = useState<number>(0);

  useEffect(() => {
    const nt = parseInt(String(numTreatments)) || 0;
    setCustomNames(prev => {
      const next = [...prev];
      while (next.length < nt) next.push(`Tratamento ${next.length + 1}`);
      return next.slice(0, nt);
    });
  }, [numTreatments]);

  const totalPlots = (parseInt(String(numTreatments)) || 0) * (parseInt(String(numReps)) || 0);
  
  const possibleColumns = useMemo(() => {
    if (totalPlots <= 0) return [];
    const factors = [];
    for (let i = 1; i <= totalPlots; i++) {
      if (totalPlots % i === 0) {
        factors.push(i);
      }
    }
    return factors;
  }, [totalPlots]);

  // Fisher-Yates array shuffle
  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleGenerate = useCallback(() => {
    const nt = parseInt(String(numTreatments));
    const nr = parseInt(String(numReps));

    if (isNaN(nt) || nt < 2) {
      alert('O número de tratamentos deve ser no mínimo 2.');
      return;
    }
    if (isNaN(nr) || nr < 2) {
      alert('O número de repetições deve ser no mínimo 2.');
      return;
    }

    const plots: Plot[] = [];
    let plotId = 1;

    for (let t = 1; t <= nt; t++) {
      const treatmentName = useCustomNames ? customNames[t - 1] || `T${t}` : `T${t}`;
      for (let r = 1; r <= nr; r++) {
        plots.push({
          id: plotId++,
          treatment: treatmentName,
          rep: r,
        });
      }
    }

    const shuffledPlots = shuffleArray(plots);
    
    // Assign new continuous IDs to represent the final plot position on field
    const finalLayout = shuffledPlots.map((plot, index) => ({
      ...plot,
      id: index + 1
    }));

    setLayout(finalLayout);
    setIsGenerated(true);
    // Auto-select a roughly square grid or default to auto
    const root = Math.ceil(Math.sqrt(totalPlots));
    const suggestedCol = possibleColumns.find(c => c >= root) || 0;
    setColumns(suggestedCol);
  }, [numTreatments, numReps, useCustomNames, customNames, totalPlots, possibleColumns]);

  const handleExportCSV = () => {
    if (layout.length === 0) return;
    
    const BOM = '\uFEFF';
    let csvContent = BOM + "Parcela;Tratamento;Repeticao\n";
    
    layout.forEach(plot => {
      csvContent += `${plot.id};${plot.treatment};${plot.rep}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `croqui_dic_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (layout.length === 0) return;
    exportLayoutPDF(layout, columns || Math.ceil(Math.sqrt(totalPlots)));
  };

  const handleExportDocx = async () => {
    if (layout.length === 0) return;
    await exportLayoutDocx(layout, columns || Math.ceil(Math.sqrt(totalPlots)));
  };

  const handleCopyToClipboard = () => {
    if (layout.length === 0) return;
    
    let text = "Parcela\tTratamento\tRepeticao\n";
    layout.forEach(plot => {
      text += `${plot.id}\t${plot.treatment}\t${plot.rep}\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      alert("Croqui copiado para a área de transferência! Cole no Excel.");
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert("Erro ao copiar.");
    });
  };

  return (
    <>
      <Header />
      <div className={styles.container}>
        <h1 className={styles.title}>
          <span className="gradient-text">Gerador DIC</span>
        </h1>
        <p className={styles.subtitle}>
          Gere rapidamente o croqui (layout) casualizado para o seu experimento 
          em Delineamento Inteiramente Casualizado.
        </p>

        <div className={styles.grid}>
          {/* Configurações */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span>⚙️</span> Configurações
            </h2>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>Nº de Tratamentos</label>
              <input
                type="number"
                className={styles.input}
                min={2}
                max={50}
                value={numTreatments}
                onChange={(e) => setNumTreatments(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  checked={useCustomNames}
                  onChange={(e) => setUseCustomNames(e.target.checked)}
                />
                Nomear tratamentos
              </label>
              
              {useCustomNames && (
                <div className={styles.customNamesList}>
                  {customNames.map((name, idx) => (
                    <div key={idx} style={{ marginBottom: '8px' }}>
                      <input
                        className={styles.input}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                        value={name}
                        onChange={(e) => {
                          const newNames = [...customNames];
                          newNames[idx] = e.target.value;
                          setCustomNames(newNames);
                        }}
                        placeholder={`Tratamento ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nº de Repetições</label>
              <input
                type="number"
                className={styles.input}
                min={2}
                max={50}
                value={numReps}
                onChange={(e) => setNumReps(e.target.value)}
              />
            </div>

            <button className={styles.button} onClick={handleGenerate}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              {isGenerated ? 'Embaralhar Novamente' : 'Gerar Croqui'}
            </button>
          </div>

          {/* Resultados */}
          <div className={styles.card}>
            {isGenerated ? (
              <>
                <div className={styles.resultsHeader}>
                  <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                    <span>🗺️</span> Croqui Casualizado
                  </h2>
                  <div className={styles.resultsActions}>
                    <button className={styles.buttonOutline} onClick={handleCopyToClipboard}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copiar
                    </button>
                    <button className={styles.buttonOutline} onClick={handleExportCSV}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Baixar CSV
                    </button>
                    <button className={styles.buttonOutline} onClick={handleExportPDF}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      Baixar PDF
                    </button>
                    <button className={styles.buttonOutline} onClick={handleExportDocx}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      Baixar DOCX
                    </button>
                  </div>
                </div>

                <div className={styles.layoutControls}>
                  <label className={styles.label} style={{ marginBottom: 0 }}>
                    Formato da Área (Linhas × Colunas):
                  </label>
                  <select 
                    className={styles.input} 
                    style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 1rem' }}
                    value={columns} 
                    onChange={(e) => setColumns(Number(e.target.value))}
                  >
                    <option value={0}>Automático</option>
                    {possibleColumns.map(c => (
                      <option key={c} value={c}>{totalPlots / c} × {c}</option>
                    ))}
                  </select>
                </div>

                <div 
                  className={styles.plotGrid}
                  style={columns > 0 ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
                >
                  {layout.map((plot) => (
                    <div key={plot.id} className={styles.plot} title={`Parcela ${plot.id}`}>
                      {plot.treatment}
                      <span className={styles.plotLabel}>Rep {plot.rep}</span>
                      <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                        {plot.id}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🎲</div>
                <h3>Nenhum croqui gerado</h3>
                <p>Preencha as configurações ao lado e clique em "Gerar Croqui" para visualizar o layout casualizado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

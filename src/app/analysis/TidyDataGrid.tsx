import React, { useState, useCallback } from 'react';
import styles from './analysis.module.css'; // Reusing page styles for consistency

export interface TidyDataMapping {
  factorA: string;
  factorB: string;
  factorC?: string;
  block?: string;
  response: string;
}

export interface TidyDataRow {
  factorA: string;
  factorB: string;
  factorC?: string;
  block?: string;
  response: number;
}

export interface TidyRawState {
  rawData: string[][];
  headers: string[];
  isManualMode: boolean;
  mapping: Partial<TidyDataMapping>;
}

interface TidyDataGridProps {
  design: 'DIC' | 'DBC';
  onAnalyze: (data: TidyDataRow[], mapping: TidyDataMapping, rawState: TidyRawState) => void;
  onBack: () => void;
  initialState?: TidyRawState;
}

export function TidyDataGrid({ design, onAnalyze, onBack, initialState }: TidyDataGridProps) {
  const [rawData, setRawData] = useState<string[][]>(initialState?.rawData || []);
  const [headers, setHeaders] = useState<string[]>(initialState?.headers || []);
  const [isManualMode, setIsManualMode] = useState(initialState?.isManualMode || false);
  const [mapping, setMapping] = useState<Partial<TidyDataMapping>>(initialState?.mapping || {});
  
  const [isConfiguringManual, setIsConfiguringManual] = useState(false);
  const [manualSetup, setManualSetup] = useState({
    factorA: 'Fator A',
    factorB: 'Fator B',
    factorC: 'Fator C',
    hasC: false,
    block: design === 'DBC' ? 'Bloco' : '',
    response: 'Variável Resposta'
  });

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const rows = text.split('\n').filter((r) => r.trim().length > 0);

    const parsedData = rows.map((row) => row.split('\t').map((cell) => cell.trim()));
    if (parsedData.length > 1) { // Needs at least header + 1 row
      const detectedHeaders = parsedData[0];
      setHeaders(detectedHeaders);
      setRawData(parsedData.slice(1)); // Remove header from data
      
      // Auto-mapping attempt (basic heuristics)
      const autoMap: Partial<TidyDataMapping> = {};
      detectedHeaders.forEach(h => {
        const lowerH = h.toLowerCase();
        if (lowerH.includes('fator a') || lowerH === 'a') autoMap.factorA = h;
        else if (lowerH.includes('fator b') || lowerH === 'b') autoMap.factorB = h;
        else if (lowerH.includes('fator c') || lowerH === 'c') autoMap.factorC = h;
        else if (lowerH.includes('bloco') || lowerH.includes('rep')) autoMap.block = h;
        else if (lowerH.includes('prod') || lowerH.includes('alt') || lowerH.includes('peso') || lowerH.includes('resp') || lowerH.includes('var')) autoMap.response = h;
      });
      setMapping(autoMap);
    } else {
      alert('Por favor, copie os dados do Excel incluindo uma linha de cabeçalho.');
    }
  }, []);

  const handleMappingChange = (role: keyof TidyDataMapping, value: string) => {
    setMapping(prev => ({ ...prev, [role]: value }));
  };

  const handleAnalyzeClick = () => {
    // Validate required mappings
    if (!mapping.factorA || !mapping.factorB || !mapping.response) {
      alert('Mapeie obrigatoriamente o Fator A, Fator B e a Variável Resposta.');
      return;
    }
    if (design === 'DBC' && !mapping.block) {
      alert('Para o delineamento em blocos (DBC), você deve mapear a coluna de Blocos.');
      return;
    }

    // Convert rawData to structured TidyDataRow[]
    const factorAIdx = headers.indexOf(mapping.factorA);
    const factorBIdx = headers.indexOf(mapping.factorB);
    const factorCIdx = mapping.factorC ? headers.indexOf(mapping.factorC) : -1;
    const blockIdx = mapping.block ? headers.indexOf(mapping.block) : -1;
    const responseIdx = headers.indexOf(mapping.response);

    const structuredData: TidyDataRow[] = [];
    let hasParseError = false;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const respStr = row[responseIdx];
      if (!respStr) continue; // Skip empty rows

      const num = parseFloat(respStr.replace(',', '.'));
      if (isNaN(num)) {
        hasParseError = true;
        break;
      }

      structuredData.push({
        factorA: row[factorAIdx],
        factorB: row[factorBIdx],
        ...(factorCIdx !== -1 && { factorC: row[factorCIdx] }),
        ...(blockIdx !== -1 && { block: row[blockIdx] }),
        response: num,
      });
    }

    if (hasParseError) {
      alert('Erro: Foram encontrados valores não numéricos na coluna da Variável Resposta.');
      return;
    }

    if (structuredData.length < 4) {
      alert('Você precisa de pelo menos 4 linhas de dados para uma análise fatorial mínima.');
      return;
    }

    const rawState = { rawData, headers, isManualMode, mapping };
    onAnalyze(structuredData, mapping as TidyDataMapping, rawState);
  };

  const startManualInput = () => {
    setIsConfiguringManual(true);
  };

  const handleGenerateManualGrid = () => {
    if (!manualSetup.factorA.trim() || !manualSetup.factorB.trim() || !manualSetup.response.trim() || (design === 'DBC' && !manualSetup.block.trim())) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsConfiguringManual(false);
    setIsManualMode(true);
    
    const initialHeaders = [manualSetup.factorA.trim(), manualSetup.factorB.trim()];
    if (manualSetup.hasC && manualSetup.factorC.trim()) {
      initialHeaders.push(manualSetup.factorC.trim());
    }
    if (design === 'DBC') {
      initialHeaders.push(manualSetup.block.trim());
    }
    initialHeaders.push(manualSetup.response.trim());
    
    setHeaders(initialHeaders);
    setRawData(Array.from({ length: 5 }, () => Array(initialHeaders.length).fill('')));
    
    // Auto-map these known headers
    setMapping({
      factorA: manualSetup.factorA.trim(),
      factorB: manualSetup.factorB.trim(),
      ...(manualSetup.hasC && manualSetup.factorC.trim() ? { factorC: manualSetup.factorC.trim() } : {}),
      ...(design === 'DBC' && { block: manualSetup.block.trim() }),
      response: manualSetup.response.trim()
    });
  };

  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    setRawData(prev => {
      const next = [...prev];
      next[rIdx] = [...next[rIdx]];
      next[rIdx][cIdx] = val;
      return next;
    });
  };

  const handleHeaderChange = (cIdx: number, val: string) => {
    setHeaders(prevHeaders => {
      const oldHeader = prevHeaders[cIdx];
      const newHeaders = [...prevHeaders];
      newHeaders[cIdx] = val;

      setMapping(prevMapping => {
        const newMapping = { ...prevMapping };
        (Object.keys(newMapping) as (keyof TidyDataMapping)[]).forEach(role => {
          if (newMapping[role] === oldHeader) {
            newMapping[role] = val;
          }
        });
        return newMapping;
      });

      return newHeaders;
    });
  };

  const addRow = () => {
    setRawData(prev => [...prev, Array(headers.length).fill('')]);
  };

  const removeRow = (idx: number) => {
    setRawData(prev => prev.filter((_, i) => i !== idx));
  };

  const isReady = mapping.factorA && mapping.factorB && mapping.response && (design !== 'DBC' || mapping.block);

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>
        <span className={styles.cardTitleIcon}>📑</span>
        Entrada Fatorial (Tidy Data)
      </h2>

      {headers.length === 0 ? (
        isConfiguringManual ? (
          <div style={{ background: 'var(--bg-page)', padding: 'var(--space-xl)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', animation: 'fadeIn 0.3s ease' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
              Defina os Nomes das Suas Colunas
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-lg)' }}>
              Dê nome aos seus fatores e à variável resposta para gerar uma tabela personalizada que funciona exatamente como sua planilha.
            </p>

            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <div className={styles.field}>
                <label className={styles.label}>Nome do Fator A *</label>
                <input 
                  className={styles.input} 
                  value={manualSetup.factorA} 
                  onChange={e => setManualSetup({...manualSetup, factorA: e.target.value})}
                  placeholder="Ex: Porta Enxerto, Variedade..." 
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Nome do Fator B *</label>
                <input 
                  className={styles.input} 
                  value={manualSetup.factorB} 
                  onChange={e => setManualSetup({...manualSetup, factorB: e.target.value})}
                  placeholder="Ex: NaCl, Dose..." 
                />
              </div>

              {design === 'DBC' && (
                <div className={styles.field}>
                  <label className={styles.label}>Nome do Bloco (Repetição) *</label>
                  <input 
                    className={styles.input} 
                    value={manualSetup.block} 
                    onChange={e => setManualSetup({...manualSetup, block: e.target.value})}
                    placeholder="Ex: Rep, Bloco..." 
                  />
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>Nome da Variável Resposta *</label>
                <input 
                  className={styles.input} 
                  value={manualSetup.response} 
                  onChange={e => setManualSetup({...manualSetup, response: e.target.value})}
                  placeholder="Ex: Clorofila, Produtividade..." 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
              <button className={styles.btnSecondary} onClick={() => setIsConfiguringManual(false)}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={handleGenerateManualGrid}>
                Criar Tabela Personalizada
              </button>
            </div>
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div 
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-2xl)',
              textAlign: 'center',
              background: 'var(--bg-card)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onPaste={handlePaste}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Copie do Excel e cole aqui (Ctrl+V)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
              Certifique-se de que a <strong>primeira linha contém os nomes das colunas</strong> (Cabeçalho).
            </p>
          </div>
          
          <div style={{ textAlign: 'center', margin: 'var(--space-sm) 0' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>ou</span>
          </div>

          <button 
            className={styles.btnSecondary} 
            style={{ margin: '0 auto', display: 'block' }}
            onClick={startManualInput}
          >
            Inserir dados manualmente ⌨️
          </button>
        </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {/* Mapping Section */}
          {!isManualMode && (
          <div style={{ background: 'var(--bg-page)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-md)', color: 'var(--text-primary)' }}>Mapeamento de Colunas</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Identificamos {headers.length} colunas. Por favor, indique qual coluna representa cada fator do seu experimento.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
              {/* Factor A */}
              <div className={styles.field}>
                <label className={styles.label}>Fator A *</label>
                <select className={styles.input} value={mapping.factorA || ''} onChange={(e) => handleMappingChange('factorA', e.target.value)}>
                  <option value="" disabled>Selecione...</option>
                  {headers.map(h => <option key={`fa-${h}`} value={h}>{h}</option>)}
                </select>
              </div>

              {/* Factor B */}
              <div className={styles.field}>
                <label className={styles.label}>Fator B *</label>
                <select className={styles.input} value={mapping.factorB || ''} onChange={(e) => handleMappingChange('factorB', e.target.value)}>
                  <option value="" disabled>Selecione...</option>
                  {headers.map(h => <option key={`fb-${h}`} value={h}>{h}</option>)}
                </select>
              </div>

              {/* Fator C (Opcional) */}
              <div className={styles.field}>
                <label className={styles.label}>Fator C (Triplo)</label>
                <select className={styles.input} value={mapping.factorC || ''} onChange={(e) => handleMappingChange('factorC', e.target.value)}>
                  <option value="">Não usar</option>
                  {headers.map(h => <option key={`fc-${h}`} value={h}>{h}</option>)}
                </select>
              </div>

              {/* Block */}
              {design === 'DBC' && (
                <div className={styles.field}>
                  <label className={styles.label}>Bloco *</label>
                  <select className={styles.input} value={mapping.block || ''} onChange={(e) => handleMappingChange('block', e.target.value)}>
                    <option value="" disabled>Selecione...</option>
                    {headers.map(h => <option key={`blk-${h}`} value={h}>{h}</option>)}
                  </select>
                </div>
              )}

              {/* Response */}
              <div className={styles.field}>
                <label className={styles.label}>Variável Resposta *</label>
                <select className={styles.input} value={mapping.response || ''} onChange={(e) => handleMappingChange('response', e.target.value)}>
                  <option value="" disabled>Selecione...</option>
                  {headers.map(h => <option key={`resp-${h}`} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Data Preview / Edit */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Dados do Experimento</h3>
              <button className={styles.btnSecondary} style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => {setHeaders([]); setRawData([]); setIsManualMode(false); setIsConfiguringManual(false);}}>
                Limpar Grade
              </button>
            </div>

            {isManualMode && (
              <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg-page)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  💡 <strong>Como preencher manualmente:</strong>
                </p>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '20px', margin: 0 }}>
                  <li style={{ marginBottom: '4px' }}>Os <strong>Fatores</strong> (A e B) são os tratamentos que você cruzou. Exemplo: <em>Dose de Nitrogênio</em> e <em>Variedade de Soja</em>. Digite o nome ou nível de cada um.</li>
                  <li style={{ marginBottom: '4px' }}>A <strong>Variável Resposta</strong> é o resultado que você mediu. Exemplo: <em>Produtividade (kg/ha)</em>. Digite apenas números aqui.</li>
                  {design === 'DBC' && <li>O <strong>Bloco</strong> indica a repetição ou área no campo. Exemplo: <em>I, II, III...</em></li>}
                </ul>
              </div>
            )}
            
            <div className={styles.dataGrid} style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: 'var(--space-md)' }}>
              <table className={styles.dataTable}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} style={{ padding: isManualMode ? 0 : undefined }}>
                        {isManualMode ? (
                          <input 
                            className={styles.cellInput}
                            style={{ 
                              width: '100%', 
                              border: 'none', 
                              borderRadius: 0, 
                              fontWeight: 'bold', 
                              background: 'transparent', 
                              textAlign: 'center', 
                              color: 'var(--text-primary)' 
                            }}
                            value={h}
                            onChange={(e) => handleHeaderChange(i, e.target.value)}
                          />
                        ) : (
                          h
                        )}
                      </th>
                    ))}
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rawData.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{ padding: 0 }}>
                          <input 
                            className={styles.cellInput}
                            style={{ width: '100%', border: 'none', borderRadius: 0 }}
                            value={cell}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            placeholder="-"
                          />
                        </td>
                      ))}
                        <td style={{ textAlign: 'center', padding: '0 4px' }}>
                          <button 
                            title="Remover linha"
                            onClick={() => removeRow(rIdx)}
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
            </div>
            
            <button className={styles.btnSecondary} onClick={addRow} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              + Adicionar Linha
            </button>
          </div>
        </div>
      )}

      <div className={styles.buttonRow} style={{ marginTop: 'var(--space-xl)' }}>
        <button className={styles.btnSecondary} onClick={onBack}>
          ← Voltar
        </button>
        {headers.length > 0 && (
          <button 
            className={styles.btnPrimary} 
            onClick={handleAnalyzeClick}
            disabled={!isReady}
          >
            Executar Análise Fatorial →
          </button>
        )}
      </div>
    </div>
  );
}

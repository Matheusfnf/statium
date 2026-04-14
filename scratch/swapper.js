const fs = require('fs');

const filePath = 'c:/Users/mathe/OneDrive/Área de Trabalho/MF Marketing Digital/Apps/Statium/src/app/regression/page.tsx';
let data = fs.readFileSync(filePath, 'utf8');

// Find the boundaries
const startAnova = data.indexOf('              {/* === GENERAL ANOVA TABLE === */}');
const startRegression = data.indexOf('              {/* === REGRESSION TABLES === */}');
const endRegression = data.indexOf('              <div className={styles.buttonRow} style={{ marginTop: \'var(--space-2xl)\' }}>');

if (startAnova !== -1 && startRegression !== -1 && endRegression !== -1) {
    const anovaBlock = data.substring(startAnova, startRegression);
    const regressionBlock = data.substring(startRegression, endRegression);
    
    // Now rewrite ANOVA tooltips
    let newAnovaBlock = anovaBlock.replace(
        '<h3 style={{ color: \'#f8fafc\', marginBottom: \'1rem\' }}>Quadro da Análise de Variância (Geral)</h3>',
        `<h3 style={{ color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
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
                               if (row.source === 'Interação AxB') sourceName = \`Interação (\${quantFactorName || 'A'} x \${qualiFactorName || 'B'})\`;
                               if (!hasQualiFactor && (row.source === 'Tratamentos' || row.source === 'Tratamento')) sourceName = quantFactorName || 'Tratamentos (Doses)';
                               if (row.pValue !== null) {
                                  const sig = row.pValue <= alpha;
                                  return (
                                    <li key={\`interp-geral-\${i}\`}>
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
                    </h3>`
    );

    // Remove old anova interpretation logic
    const oldAnovaInterpStart = newAnovaBlock.indexOf('<div style={{ marginTop: \'1.5rem\'');
    const oldAnovaInterpEnd = newAnovaBlock.indexOf('</ul>\n                    </div>\n                  </div>');
    if (oldAnovaInterpStart > -1 && oldAnovaInterpEnd > -1) {
        newAnovaBlock = newAnovaBlock.substring(0, oldAnovaInterpStart) + '                  </div>\n';
    }

    // Rewrite regression tooltips
    let newRegBlock = regressionBlock.replace(
        /<h3 style={{ color: '#f8fafc', marginBottom: '1rem' }}>Quadro da Regressão \(\{regRes\.levelName \|\| 'Geral'\}\)<\/h3>/g,
        `<h3 style={{ color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
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
                  </h3>`
    );

    // Remove old regression interpretation logic
    const oldRegInterpStart = newRegBlock.indexOf('{regRes.models.length > 0 ? (() => {');
    const oldRegInterpEnd = newRegBlock.indexOf('})() : null}\n                </div>\n              ))}', oldRegInterpStart);
    if (oldRegInterpStart > -1 && oldRegInterpEnd > -1) {
        newRegBlock = newRegBlock.substring(0, oldRegInterpStart) + '                </div>\n              ))}';
    }

    const cssStyle = `              <style>{\`
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
              \`}</style>

`;

    const finalData = data.substring(0, startAnova) + cssStyle + newRegBlock + '\n' + newAnovaBlock + '\n' + data.substring(endRegression);
    
    fs.writeFileSync(filePath, finalData, 'utf8');
    console.log("Success");
} else {
    console.log("Failed to find boundaries");
}

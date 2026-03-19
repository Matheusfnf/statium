import Link from 'next/link';
import Header from '@/components/Layout/Header';
import styles from './page.module.css';

export default function Home() {
  return (
    <>
      <Header />
      <main className={styles.page}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroGlow} />
          <div className={styles.heroContent}>
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              Análise estatística simplificada
            </div>
            <h1 className={styles.heroTitle}>
              Seus experimentos,{' '}
              <span className="gradient-text">resultados instantâneos.</span>
            </h1>
            <p className={styles.heroDescription}>
              Realize ANOVA, Tukey e Scott-Knott diretamente no navegador — sem 
              instalação, sem complicação. A ferramenta moderna para pesquisadores 
              que valorizam precisão e agilidade.
            </p>
            <div className={styles.heroActions}>
              <Link href="/analysis" className={styles.btnHero}>
                Começar Análise
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <a href="#features" className={styles.btnOutline}>
                Conheça os recursos
              </a>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>3</span>
                <span className={styles.heroStatLabel}>Testes estatísticos</span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>100%</span>
                <span className={styles.heroStatLabel}>No navegador</span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>0</span>
                <span className={styles.heroStatLabel}>Instalações</span>
              </div>
            </div>
          </div>

          {/* Animated code snippet / visual */}
          <div className={styles.heroVisual}>
            <div className={styles.terminalWindow}>
              <div className={styles.terminalHeader}>
                <span className={styles.terminalDot} style={{ background: '#f87171' }} />
                <span className={styles.terminalDot} style={{ background: '#fbbf24' }} />
                <span className={styles.terminalDot} style={{ background: '#34d399' }} />
                <span className={styles.terminalTitle}>análise de variância</span>
              </div>
              <div className={styles.terminalBody}>
                <div className={styles.terminalLine}>
                  <span className={styles.terminalPrompt}>FV</span>
                  <span className={styles.terminalDim}>GL &nbsp; SQ &nbsp;&nbsp;&nbsp; QM &nbsp;&nbsp;&nbsp; F</span>
                </div>
                <div className={styles.terminalLine}>
                  <span className={styles.terminalKey}>Tratamentos</span>
                  <span className={styles.terminalVal}> 3 &nbsp; 845.2 &nbsp; 281.7 &nbsp; 
                    <span className={styles.terminalHighlight}>14.52**</span>
                  </span>
                </div>
                <div className={styles.terminalLine}>
                  <span className={styles.terminalKey}>Resíduo</span>
                  <span className={styles.terminalVal}> 16 &nbsp; 310.4 &nbsp; 19.40</span>
                </div>
                <div className={styles.terminalLine}>
                  <span className={styles.terminalKey}>Total</span>
                  <span className={styles.terminalVal}> 19 &nbsp; 1155.6</span>
                </div>
                <div className={styles.terminalDivider} />
                <div className={styles.terminalLine}>
                  <span className={styles.terminalSuccess}>✓ CV = 8.24%</span>
                </div>
                <div className={styles.terminalLine}>
                  <span className={styles.terminalSuccess}>✓ Tukey: A &gt; B = C &gt; D</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.features} id="features">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Recursos</span>
            <h2 className={styles.sectionTitle}>
              Tudo que você precisa para{' '}
              <span className="gradient-text">análise experimental</span>
            </h2>
            <p className={styles.sectionDescription}>
              Ferramentas poderosas integradas em uma interface elegante, 
              projetada para pesquisadores e cientistas.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📐</div>
              <h3 className={styles.featureTitle}>ANOVA Completa</h3>
              <p className={styles.featureDescription}>
                Análise de variância para DIC e DBC com tabela completa — SQ, GL, QM, 
                F calculado, p-valor e coeficiente de variação.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔤</div>
              <h3 className={styles.featureTitle}>Tukey HSD</h3>
              <p className={styles.featureDescription}>
                Comparação de médias com o teste de Tukey. Letras de 
                significância geradas automaticamente para identificação rápida.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🧬</div>
              <h3 className={styles.featureTitle}>Scott-Knott</h3>
              <p className={styles.featureDescription}>
                Agrupamento hierárquico de médias sem sobreposição de grupos. Ideal 
                para experimentos com muitos tratamentos.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3 className={styles.featureTitle}>Gráficos Interativos</h3>
              <p className={styles.featureDescription}>
                Visualize suas médias com gráficos de barras, barras de erro padrão 
                e letras de significância sobrepostas.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📋</div>
              <h3 className={styles.featureTitle}>Colar do Excel</h3>
              <p className={styles.featureDescription}>
                Copie dados diretamente do Excel ou Google Sheets e cole na grade — os 
                dados são detectados e preenchidos automaticamente.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔒</div>
              <h3 className={styles.featureTitle}>100% Privado</h3>
              <p className={styles.featureDescription}>
                Todos os cálculos rodam localmente no seu navegador. Nenhum dado é 
                enviado para servidores — privacidade total.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className={styles.howItWorks} id="how-it-works">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Como Funciona</span>
            <h2 className={styles.sectionTitle}>
              Três passos para seus{' '}
              <span className="gradient-text">resultados</span>
            </h2>
          </div>

          <div className={styles.stepsRow}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Configure</h3>
              <p className={styles.stepDescription}>
                Escolha o delineamento (DIC ou DBC), defina o número de tratamentos 
                e repetições.
              </p>
            </div>
            <div className={styles.stepArrow}>→</div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>Insira os dados</h3>
              <p className={styles.stepDescription}>
                Digite ou cole seus dados experimentais diretamente na tabela 
                interativa.
              </p>
            </div>
            <div className={styles.stepArrow}>→</div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>Analise</h3>
              <p className={styles.stepDescription}>
                Receba ANOVA, comparação de médias e gráficos instantaneamente — sem 
                espera.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.cta}>
          <div className={styles.ctaGlow} />
          <h2 className={styles.ctaTitle}>
            Pronto para transformar seus dados em{' '}
            <span className="gradient-text">conhecimento?</span>
          </h2>
          <p className={styles.ctaDescription}>
            Comece agora — é gratuito, sem cadastro e sem instalação.
          </p>
          <Link href="/analysis" className={styles.btnHero}>
            Iniciar Análise Gratuita
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <div className={styles.footerBrand}>
              <span className={styles.footerLogo}>S</span>
              <span className="gradient-text" style={{ fontWeight: 800, fontSize: '1.2rem' }}>Statium</span>
            </div>
            <p className={styles.footerText}>
              Análise estatística moderna para pesquisadores.
            </p>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} Statium. Todos os direitos reservados.</span>
          </div>
        </footer>
      </main>
    </>
  );
}

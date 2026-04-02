'use client';

import { useAnalysisHistory } from '@/hooks/useAnalysisHistory';
import Header from '@/components/Layout/Header';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const { entries, remove } = useAnalysisHistory();

  return (
    <>
      <Header />
      <main className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Meus <span className="gradient-text">Favoritos</span></h1>
          <p className={styles.subtitle}>Gerencie suas análises estatísticas salvas</p>
        </div>

        {entries.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>⭐</span>
            <h2 className={styles.emptyTitle}>Nenhum favorito salvo</h2>
            <p className={styles.emptyText}>
              Você ainda não salvou nenhuma análise aos seus favoritos. Faça uma nova análise e clique em &quot;Adicionar aos Favoritos&quot; para salvá-la na nuvem.
            </p>
            <Link href="/analysis" className={styles.ctaBtn}>
              Nova Análise
            </Link>
          </div>
        ) : (
          <>
            {entries.filter(e => e.comparisonMethod !== 'regression').length > 0 && (
              <div style={{ marginBottom: '3rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Testes de Médias (ANOVA, Fatorial, etc)</h2>
                <div className={styles.grid}>
                  {entries.filter(e => e.comparisonMethod !== 'regression').map((entry) => (
                    <div key={entry.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <div>
                          <h3 className={styles.cardTitle}>{entry.variableName || 'S/ Nome'}</h3>
                          <div className={styles.cardDate}>{formatDate(entry.timestamp)}</div>
                        </div>
                      </div>

                      <div className={styles.cardBody}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>
                          <strong>Modelo:</strong> {entry.label}
                        </p>
                        <div className={styles.tagGroup}>
                          <span className={styles.tag}>{entry.numTreatments} tratamentos</span>
                          <span className={styles.tag}>{entry.numReps} repetições</span>
                          <span className={styles.tag}>{entry.design}</span>
                        </div>
                      </div>

                      <div className={styles.cardFooter}>
                        <Link href={`/analysis?historyId=${entry.id}`} className={styles.openBtn}>
                          Abrir Análise
                        </Link>
                        <button 
                          className={styles.deleteBtn}
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir este favorito?')) {
                              remove(entry.id);
                            }
                          }}
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entries.filter(e => e.comparisonMethod === 'regression').length > 0 && (
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Regressões Polinomiais</h2>
                <div className={styles.grid}>
                  {entries.filter(e => e.comparisonMethod === 'regression').map((entry) => (
                    <div key={entry.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <div>
                          <h3 className={styles.cardTitle}>{entry.variableName || 'S/ Nome'}</h3>
                          <div className={styles.cardDate}>{formatDate(entry.timestamp)}</div>
                        </div>
                      </div>

                      <div className={styles.cardBody}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>
                          <strong>Modelo:</strong> Regressão {entry.design}
                        </p>
                        <div className={styles.tagGroup}>
                          <span className={styles.tag}>{entry.numTreatments} doses</span>
                          <span className={styles.tag}>{entry.numReps} repetições</span>
                        </div>
                      </div>

                      <div className={styles.cardFooter}>
                        <Link href={`/regression?historyId=${entry.id}`} className={styles.openBtn}>
                          Abrir Regressão
                        </Link>
                        <button 
                          className={styles.deleteBtn}
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir esta regressão?')) {
                              remove(entry.id);
                            }
                          }}
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

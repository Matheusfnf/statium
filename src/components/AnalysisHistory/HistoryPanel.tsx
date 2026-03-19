'use client';

import type { HistoryEntry } from '@/hooks/useAnalysisHistory';
import styles from './HistoryPanel.module.css';

interface HistoryPanelProps {
  isOpen: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
  onLoad: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPanel({
  isOpen,
  entries,
  onClose,
  onLoad,
  onDelete,
}: HistoryPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.headerTitle}>
            <span>⭐</span> Favoritos
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {entries.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>⭐</span>
              <p>Nenhum favorito salvo ainda.</p>
              <p className={styles.emptyHint}>
                Após analisar seus dados, clique em &ldquo;Adicionar aos Favoritos&rdquo; para guardá-los.
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {entries.map((entry) => (
                <div key={entry.id} className={styles.entry}>
                  <div
                    className={styles.entryContent}
                    onClick={() => onLoad(entry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onLoad(entry);
                    }}
                  >
                    <div className={styles.entryLabel}>{entry.label}</div>
                    <div className={styles.entryMeta}>
                      <span>{formatDate(entry.timestamp)}</span>
                      <span>·</span>
                      <span>{entry.numTreatments} trat.</span>
                      <span>·</span>
                      <span>{entry.numReps} rep.</span>
                    </div>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(entry.id);
                    }}
                    title="Excluir"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

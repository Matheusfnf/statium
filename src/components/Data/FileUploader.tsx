import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { fileToCsvText, parseSpreadsheetWithAI, type ParsedSpreadsheetResult } from '@/lib/parseSpreadsheet';

interface FileUploaderProps {
  /** Called with raw 2D string array (legacy mode, no AI) */
  onDataLoaded?: (data: string[][], fileName: string) => void;
  /** Called with AI-parsed structured result */
  onAIParsed?: (result: ParsedSpreadsheetResult, fileName: string) => void;
  /** If true, uses Gemini AI to interpret the file instead of raw parsing */
  useAI?: boolean;
  /** Context hint passed to AI for better interpretation */
  aiContext?: string;
  title?: string;
  subtitle?: string;
  style?: React.CSSProperties;
}

export function FileUploader({ 
  onDataLoaded, 
  onAIParsed,
  useAI = false,
  aiContext,
  title = "Importar Arquivo (.xlsx, .xls, .csv, .dbf)", 
  subtitle = "Clique ou arraste para carregar os dados automaticamente",
  style
}: FileUploaderProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);
    setIsLoading(true);

    try {
      if (useAI && onAIParsed) {
        setLoadingMessage('Lendo arquivo...');
        const csv = await fileToCsvText(file);
        
        setLoadingMessage('🤖 IA interpretando tabela...');
        const result = await parseSpreadsheetWithAI(csv, aiContext);
        
        onAIParsed(result, file.name);
      } else if (onDataLoaded) {
        setLoadingMessage('Lendo arquivo...');
        const csv = await fileToCsvText(file);
        
        // Parse CSV back to 2D array for legacy mode
        const rows = csv.split('\n')
          .filter(r => r.trim())
          .map(row => row.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
        
        onDataLoaded(rows, file.name);
      }
    } catch (err: any) {
      console.error('Error processing file:', err);
      setError(err.message || 'Erro ao processar o arquivo');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const borderColor = error ? '#ef4444' : isHovering ? '#10b981' : 'var(--border-color)';
  const bgColor = error ? 'rgba(239, 68, 68, 0.05)' : isHovering ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-card)';

  return (
    <div 
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-xl)',
        textAlign: 'center',
        background: bgColor,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        ...style
      }}
      onDragOver={(e) => { if (!isLoading) { e.preventDefault(); setIsHovering(true); } }}
      onDragLeave={() => setIsHovering(false)}
      onDrop={isLoading ? undefined : handleDrop}
      onClick={() => !isLoading && fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        accept=".xlsx, .xls, .csv, .dbf" 
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleChange}
      />
      
      {isLoading ? (
        <>
          <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>
            ⚙️
          </div>
          <p style={{ color: 'var(--primary)', fontWeight: 600, margin: 0, fontSize: '1rem' }}>
            {loadingMessage}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
            Aguarde, isso pode levar alguns segundos...
          </p>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      ) : error ? (
        <>
          <div style={{ fontSize: '2rem' }}>❌</div>
          <p style={{ color: '#ef4444', fontWeight: 600, margin: 0 }}>{error}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Clique para tentar novamente</p>
        </>
      ) : (
        <>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: isHovering ? '#10b981' : 'var(--text-secondary)' }}>
            {useAI ? '🤖' : '📁'}
          </div>
          <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem' }}>
            {title}
          </h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', margin: 0 }}>
            {subtitle}
          </p>
          {useAI && (
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', background: 'rgba(99,220,190,0.1)', padding: '2px 8px', borderRadius: '999px' }}>
              ✨ Powered by Gemini AI
            </span>
          )}
        </>
      )}
    </div>
  );
}

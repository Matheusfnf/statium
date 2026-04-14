import * as XLSX from 'xlsx';

export interface ParsedSpreadsheetRow {
  dose: string;
  level: string | null;
  reps: string[];
}

export interface ParsedSpreadsheetResult {
  isFatorial: boolean;
  qualiFactorName: string | null;
  responseName: string;
  rows: ParsedSpreadsheetRow[];
}

/**
 * Convert an XLSX File to CSV text for AI interpretation
 */
export function fileToCsvText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('No data');
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(firstSheet);
        resolve(csv);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Call server-side Gemini endpoint to intelligently parse the spreadsheet
 */
export async function parseSpreadsheetWithAI(
  csvText: string,
  context?: string
): Promise<ParsedSpreadsheetResult> {
  const response = await fetch('/api/parse-spreadsheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvText, context }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to parse with AI');
  }

  return response.json();
}

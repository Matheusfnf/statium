import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';
import type { AnovaResult, TukeyResult, ScottKnottResult } from '@/lib/statistics';
import { formatNumber } from '@/lib/statistics';

/**
 * Helper to trigger a reliable file download with correct name and MIME type.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Small delay before cleanup to ensure download starts
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function exportPDF(
  anovaResult: AnovaResult,
  tukeyResult: TukeyResult | null,
  scottKnottResult: ScottKnottResult | null,
  comparisonMethod: 'tukey' | 'scott-knott',
  data: number[][],
  alpha: number
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 220, 190);
  doc.text('Statium', 14, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Relatório de Análise Estatística', 14, y + 8);

  const now = new Date();
  doc.setFontSize(9);
  doc.text(
    `Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`,
    pageWidth - 14,
    y,
    { align: 'right' }
  );

  y += 20;

  // Divider
  doc.setDrawColor(99, 220, 190);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  // Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Resumo do Experimento', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const summaryData = [
    ['Delineamento', anovaResult.design],
    ['Nº de Tratamentos', String(anovaResult.treatmentNames.length)],
    ['Nº de Repetições', String(data[0]?.length || 0)],
    ['Média Geral', formatNumber(anovaResult.overallMean, 4)],
    ['CV (%)', formatNumber(anovaResult.cv, 2)],
    ['QM Resíduo', formatNumber(anovaResult.mse, 4)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Parâmetro', 'Valor']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [99, 220, 190], textColor: [10, 14, 26], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ANOVA Table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Quadro da Análise de Variância', 14, y);
  y += 8;

  const anovaBody = anovaResult.table.map((row) => [
    row.source,
    String(row.df),
    formatNumber(row.ss),
    row.source !== 'Total' ? formatNumber(row.ms) : '-',
    row.fValue !== null ? formatNumber(row.fValue) : '-',
    row.pValue !== null ? formatNumber(row.pValue) : '-',
    row.significance || '-',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['FV', 'GL', 'SQ', 'QM', 'F', 'p-valor', 'Sig.']],
    body: anovaBody,
    theme: 'striped',
    headStyles: { fillColor: [99, 220, 190], textColor: [10, 14, 26], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4, halign: 'center' },
    columnStyles: { 0: { halign: 'left' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text(`${alpha <= 0.01 ? '**' : '*'} significativo a ${Number.isInteger(alpha * 100) ? alpha * 100 : (alpha * 100).toFixed(1)}%   |   ns: não significativo`, 14, y);
  y += 12;

  // Means Comparison
  const groups =
    comparisonMethod === 'tukey'
      ? tukeyResult?.groups
      : scottKnottResult?.groups;

  if (groups && groups.length > 0) {
    const methodName = comparisonMethod === 'tukey' ? 'Tukey HSD' : 'Scott-Knott';

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Comparação de Médias — ${methodName}`, 14, y);
    y += 4;

    if (comparisonMethod === 'tukey' && tukeyResult) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(
        `DMS (5%) = ${formatNumber(tukeyResult.dms05, 4)}   |   DMS (1%) = ${formatNumber(tukeyResult.dms01, 4)}`,
        14,
        y + 4
      );
      y += 8;
    }

    const meansBody = groups.map((g) => [
      g.treatmentName,
      formatNumber(g.mean, 4),
      g.letter,
    ]);

    autoTable(doc, {
      startY: y + 2,
      head: [['Tratamento', 'Média', 'Grupo']],
      body: meansBody,
      theme: 'striped',
      headStyles: { fillColor: [129, 140, 248], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4, halign: 'center' },
      columnStyles: { 0: { halign: 'left' } },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Statium — Análise Estatística Online  |  Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
  downloadBlob(pdfBlob, `statium-analise-${now.toISOString().slice(0, 10)}.pdf`);
}

export function exportCSV(
  anovaResult: AnovaResult,
  tukeyResult: TukeyResult | null,
  scottKnottResult: ScottKnottResult | null,
  comparisonMethod: 'tukey' | 'scott-knott',
  alpha: number
) {
  const lines: string[] = [];

  // Header
  lines.push('Statium - Relatório Estatístico');
  lines.push(`Data: ${new Date().toLocaleDateString('pt-BR')}`);
  lines.push('');

  // Summary
  lines.push('RESUMO');
  lines.push(`Delineamento;${anovaResult.design}`);
  lines.push(`Média Geral;${formatNumber(anovaResult.overallMean, 4)}`);
  lines.push(`CV (%);${formatNumber(anovaResult.cv, 2)}`);
  lines.push(`QM Resíduo;${formatNumber(anovaResult.mse, 4)}`);
  lines.push('');

  // ANOVA Table
  lines.push('QUADRO DE ANÁLISE DE VARIÂNCIA');
  lines.push('FV;GL;SQ;QM;F;p-valor;Sig.');

  for (const row of anovaResult.table) {
    lines.push(
      [
        row.source,
        row.df,
        formatNumber(row.ss),
        row.source !== 'Total' ? formatNumber(row.ms) : '-',
        row.fValue !== null ? formatNumber(row.fValue) : '-',
        row.pValue !== null ? formatNumber(row.pValue) : '-',
        row.significance || '-',
      ].join(';')
    );
  }
  lines.push('');

  // Means Comparison
  const groups =
    comparisonMethod === 'tukey'
      ? tukeyResult?.groups
      : scottKnottResult?.groups;

  if (groups && groups.length > 0) {
    const methodName = comparisonMethod === 'tukey' ? 'Tukey HSD' : 'Scott-Knott';
    lines.push(`COMPARAÇÃO DE MÉDIAS — ${methodName}`);

    if (comparisonMethod === 'tukey' && tukeyResult) {
      lines.push(`DMS (5%);${formatNumber(tukeyResult.dms05, 4)}`);
      lines.push(`DMS (1%);${formatNumber(tukeyResult.dms01, 4)}`);
    }

    lines.push('Tratamento;Média;Grupo');
    for (const g of groups) {
      lines.push(`${g.treatmentName};${formatNumber(g.mean, 4)};${g.letter}`);
    }
  }

  const csvContent = '\uFEFF' + lines.join('\n'); // BOM for Excel encoding
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `statium-analise-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportMeansWord(
  anovaResult: AnovaResult,
  tukeyResult: TukeyResult | null,
  scottKnottResult: ScottKnottResult | null,
  comparisonMethod: 'tukey' | 'scott-knott' | 'none',
  variableName: string,
  alpha: number
) {
  const groups = comparisonMethod === 'tukey' ? tukeyResult?.groups : 
                 comparisonMethod === 'scott-knott' ? scottKnottResult?.groups : 
                 null;
  if (!groups && comparisonMethod !== 'none') return;

  const methodName = comparisonMethod === 'tukey' ? 'Tukey' : 'Scott-Knott';
  const alphaPercent = `${(alpha * 100).toFixed(0)}%`;

  // Create table rows
  const tableRows = [
    // Header Row
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Tratamentos', bold: true }),
                new TextRun({ text: '1', bold: true, superScript: true }),
              ],
            }),
          ],
          width: { size: 4000, type: WidthType.DXA },
          borders: { bottom: { style: BorderStyle.SINGLE, size: 1 } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: variableName, bold: true })] })],
          width: { size: 4000, type: WidthType.DXA },
          borders: { bottom: { style: BorderStyle.SINGLE, size: 1 } },
        }),
      ],
    }),
    // Data Rows
    ...(groups ? groups.map((g) => new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph(g.treatmentName)],
        }),
        new TableCell({
          children: [new Paragraph(`${formatNumber(g.mean, 4)} ${g.letter}`)],
        }),
      ],
    })) : []),
    // DMS Row (only for Tukey)
    ...(comparisonMethod === 'tukey' && tukeyResult ? [
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph('DMS')],
            borders: { top: { style: BorderStyle.SINGLE, size: 1 } },
          }),
          new TableCell({ 
            children: [new Paragraph(formatNumber(tukeyResult.dms05, 4))],
            borders: { top: { style: BorderStyle.SINGLE, size: 1 } },
          }),
        ],
      })
    ] : []),
    // CV Row
    new TableRow({
      children: [
        new TableCell({ 
          children: [new Paragraph('CV (%)')],
          borders: { 
            top: comparisonMethod !== 'tukey' ? { style: BorderStyle.SINGLE, size: 1 } : undefined,
            bottom: { style: BorderStyle.SINGLE, size: 1 }
          },
        }),
        new TableCell({ 
          children: [new Paragraph(formatNumber(anovaResult.cv, 2))],
          borders: { 
            top: comparisonMethod !== 'tukey' ? { style: BorderStyle.SINGLE, size: 1 } : undefined,
            bottom: { style: BorderStyle.SINGLE, size: 1 }
          },
        }),
      ],
    }),
  ];

  const table = new Table({
    rows: tableRows,
    width: { size: 6000, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.NONE }, // Handled by cells
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NIL },
      insideVertical: { style: BorderStyle.NONE },
    },
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `Tabela 1: Médias de ${variableName} em função dos tratamentos.`,
                bold: true,
              }),
            ],
            spacing: { after: 200 },
          }),
          table,
          ...(comparisonMethod !== 'none' ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: `¹Médias seguidas por letras distintas diferem entre si pelo Teste de ${methodName} a ${alphaPercent} de significância.`,
                  size: 18, // ~9pt
                }),
              ],
              spacing: { before: 200 },
            }),
          ] : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `tabela-medias-artigo-${new Date().toISOString().slice(0, 10)}.docx`);
}

export async function exportAnovaWord(
  anovaResult: AnovaResult,
  variableName: string,
  alpha: number
) {
  const tableRows = [
    // Header Row
    new TableRow({
      children: ['FV', 'GL', 'SQ', 'QM', 'F', 'p-valor'].map(
        (text) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
            width: { size: text === 'FV' ? 2500 : 1300, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          })
      ),
    }),
    // Data Rows
    ...anovaResult.table.map((row, idx) => {
      const isLast = idx === anovaResult.table.length - 1;
      
      let fText = row.fValue !== null ? formatNumber(row.fValue) : '-';
      if (row.significance && row.significance !== 'ns') {
        fText += `${row.significance}`;
      } else if (row.significance === 'ns') {
        fText += ` ns`;
      }

      return new TableRow({
        children: [
          row.source,
          String(row.df),
          formatNumber(row.ss),
          row.source !== 'Total' ? formatNumber(row.ms) : '-',
          fText,
          row.pValue !== null ? formatNumber(row.pValue) : '-',
        ].map(
          (text) =>
            new TableCell({
              children: [new Paragraph(text)],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: isLast ? { style: BorderStyle.SINGLE, size: 1 } : { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            })
        ),
      });
    }),
  ];

  const table = new Table({
    rows: tableRows,
    width: { size: 9000, type: WidthType.DXA },
    borders: {
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
  });

  const sigString = alpha <= 0.01 ? '**' : '*';
  const sigValue = Number.isInteger(alpha * 100) ? alpha * 100 : (alpha * 100).toFixed(1);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `Tabela 1: Resumo da análise de variância (ANOVA) para a variável ${variableName}.`,
                bold: true,
              }),
            ],
            spacing: { after: 200 },
          }),
          table,
          new Paragraph({
            children: [
              new TextRun({
                text: `${sigString} significativo a ${sigValue}% de probabilidade; ns: não significativo.`,
                size: 18,
              }),
            ],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `anova-artigo-${new Date().toISOString().slice(0, 10)}.docx`);
}

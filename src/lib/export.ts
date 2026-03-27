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
  ImageRun,
  VerticalAlign,
  ShadingType,
} from 'docx';
import type { AnovaResult, TukeyResult, ScottKnottResult, DunnettResult } from '@/lib/statistics';
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
  dunnettResult: DunnettResult | null,
  comparisonMethod: 'tukey' | 'scott-knott' | 'dunnett',
  data: (number | null)[][],
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
    ['Normalidade (S-W)', anovaResult.assumptions.normality.passed ? 'Atendida' : 'Não Atendida'],
    ['Homocedasticidade', anovaResult.assumptions.homoscedasticity.passed ? 'Atendida' : 'Não Atendida'],
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
  let groups: { treatmentName: string; mean: number; letter: string }[] | undefined;
  if (comparisonMethod === 'tukey') groups = tukeyResult?.groups;
  else if (comparisonMethod === 'scott-knott') groups = scottKnottResult?.groups;
  else if (comparisonMethod === 'dunnett' && dunnettResult) {
    groups = [
      { treatmentName: `${dunnettResult.controlName} (Controle)`, mean: dunnettResult.controlMean, letter: '-' },
      ...dunnettResult.comparisons.map(c => ({
        treatmentName: c.treatmentName,
        mean: c.mean,
        letter: c.significant ? '*' : 'ns'
      }))
    ];
  }

  if (groups && groups.length > 0) {
    const methodName = comparisonMethod === 'tukey' ? 'Tukey HSD' : comparisonMethod === 'scott-knott' ? 'Scott-Knott' : 'Dunnett';

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
        `DMS (5%) = ${tukeyResult.dms05 !== null ? formatNumber(tukeyResult.dms05, 4) : 'Variável (Tukey-Kramer)'}   |   DMS (1%) = ${tukeyResult.dms01 !== null ? formatNumber(tukeyResult.dms01, 4) : 'Variável (Tukey-Kramer)'}`,
        14,
        y + 4
      );
      y += 8;
    } else if (comparisonMethod === 'dunnett' && dunnettResult) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(
        `DMS (${alpha <= 0.01 ? '1%' : '5%'}) = ${dunnettResult.dms05 !== null ? formatNumber(alpha <= 0.01 ? dunnettResult.dms01! : dunnettResult.dms05!, 4) : 'Variável'}`,
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
  dunnettResult: DunnettResult | null,
  comparisonMethod: 'tukey' | 'scott-knott' | 'dunnett',
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
  lines.push(`Normalidade (Shapiro-Wilk);${anovaResult.assumptions.normality.passed ? 'Atendida' : 'Não Atendida'}`);
  lines.push(`Homocedasticidade (Bartlett);${anovaResult.assumptions.homoscedasticity.passed ? 'Atendida' : 'Não Atendida'}`);
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
  let groups: { treatmentName: string; mean: number; letter: string }[] | undefined;
  if (comparisonMethod === 'tukey') groups = tukeyResult?.groups;
  else if (comparisonMethod === 'scott-knott') groups = scottKnottResult?.groups;
  else if (comparisonMethod === 'dunnett' && dunnettResult) {
    groups = [
      { treatmentName: `${dunnettResult.controlName} (Controle)`, mean: dunnettResult.controlMean, letter: '-' },
      ...dunnettResult.comparisons.map(c => ({
        treatmentName: c.treatmentName,
        mean: c.mean,
        letter: c.significant ? '*' : 'ns'
      }))
    ];
  }

  if (groups && groups.length > 0) {
    const methodName = comparisonMethod === 'tukey' ? 'Tukey HSD' : comparisonMethod === 'scott-knott' ? 'Scott-Knott' : 'Dunnett';
    lines.push(`COMPARAÇÃO DE MÉDIAS — ${methodName}`);

    if (comparisonMethod === 'tukey' && tukeyResult) {
      lines.push(`DMS (5%);${tukeyResult.dms05 !== null ? formatNumber(tukeyResult.dms05, 4) : 'Variável (Tukey-Kramer)'}`);
      lines.push(`DMS (1%);${tukeyResult.dms01 !== null ? formatNumber(tukeyResult.dms01, 4) : 'Variável (Tukey-Kramer)'}`);
    } else if (comparisonMethod === 'dunnett' && dunnettResult) {
      lines.push(`DMS (${alpha <= 0.01 ? '1%' : '5%'});${dunnettResult.dms05 !== null ? formatNumber(alpha <= 0.01 ? dunnettResult.dms01! : dunnettResult.dms05!, 4) : 'Variável'}`);
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

export interface ExportMeansTable {
  title: string;
  dmsValueStr?: string;
  groups: { treatmentName: string; mean: number; letter: string }[];
}

export async function exportMeansWord(
  variableName: string,
  comparisonMethod: 'tukey' | 'scott-knott' | 'dunnett' | 'none',
  alpha: number,
  cv: number,
  tablesToExport: ExportMeansTable[]
) {
  if (tablesToExport.length === 0 || comparisonMethod === 'none') return;

  const methodName = comparisonMethod === 'tukey' ? 'Tukey' : comparisonMethod === 'scott-knott' ? 'Scott-Knott' : 'Dunnett';
  const alphaPercent = `${(alpha * 100).toFixed(0)}%`;

  const sections: any[] = [];

  tablesToExport.forEach((tableData, index) => {
    const tableRows = [
      // Header Row (Double bordered top/bottom usually, but DOCX lacks double easily, so top/bottom single)
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${tableData.title}`, bold: true }),
                  new TextRun({ text: '1', bold: true, superScript: true }),
                ],
              }),
            ],
            width: { size: 4000, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: variableName, bold: true })] })],
            width: { size: 4000, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
        ],
      }),
      // Data Rows
      ...tableData.groups.map((g) => new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph(g.treatmentName)],
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
          new TableCell({
            children: [new Paragraph(`${formatNumber(g.mean, 2)} ${g.letter}`)],
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
        ],
      })),
      // DMS Row (only for Tukey)
      ...(comparisonMethod === 'tukey' && tableData.dmsValueStr ? [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph('DMS')],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
            new TableCell({
              children: [new Paragraph(tableData.dmsValueStr)],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
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
              top: comparisonMethod !== 'tukey' ? { style: BorderStyle.SINGLE, size: 1 } : { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
          new TableCell({
            children: [new Paragraph(formatNumber(cv, 2))],
            borders: {
              top: comparisonMethod !== 'tukey' ? { style: BorderStyle.SINGLE, size: 1 } : { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
        ],
      }),
    ];

    const table = new Table({
      rows: tableRows,
      width: { size: 6000, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      },
    });

    sections.push({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `Tabela ${index + 1}: Médias de ${variableName} em função de ${tableData.title}.`,
              bold: true,
            }),
          ],
          spacing: { after: 200 },
        }),
        table,
        new Paragraph({
          children: [
            new TextRun({
              text: `¹Médias seguidas por letras distintas diferem entre si pelo Teste de ${methodName} a ${alphaPercent} de significância.`,
              size: 18, // ~9pt
            }),
          ],
          spacing: { before: 200 },
        }),
      ],
    });
  });

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `tabelas-medias-artigo-${new Date().toISOString().slice(0, 10)}.docx`);
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
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Premissas do Modelo: A normalidade dos resíduos (Shapiro-Wilk) foi ${anovaResult.assumptions.normality.passed ? 'atendida' : 'não atendida'}. A homogeneidade de variâncias (Bartlett) foi ${anovaResult.assumptions.homoscedasticity.passed ? 'atendida' : 'não atendida'}.`,
                size: 18,
                italics: true
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `anova-artigo-${new Date().toISOString().slice(0, 10)}.docx`);
}

export async function exportChartWord(
  base64Image: string,
  variableName: string
) {
  // Convert base64 to Uint8Array
  const base64Data = base64Image.replace(/^data:image\/(png|jpeg);base64,/, '');
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `Figura 1: Gráfico de médias para a variável ${variableName}.`,
                bold: true,
              }),
            ],
            spacing: { after: 200 },
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new ImageRun({
                data: bytes,
                type: 'png',
                transformation: {
                  width: 600,
                  height: 300,
                },
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `grafico-artigo-${new Date().toISOString().slice(0, 10)}.docx`);
}

export function exportLayoutPDF(layout: { id: number; treatment: string; rep: number }[], columns: number) {
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
  doc.text('Croqui Casualizado - Experimento DIC', 14, y + 8);

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
  
  // Create table data based on the layout
  const actualCols = columns > 0 ? columns : Math.ceil(Math.sqrt(layout.length));
  const bodyData: any[][] = [];
  let currentRow: any[] = [];
  
  layout.forEach((plot, index) => {
    const cellText = `${plot.treatment}\nRep ${plot.rep}\n[P: ${plot.id}]`;
    currentRow.push(cellText);

    if ((index + 1) % actualCols === 0 || index === layout.length - 1) {
      while (currentRow.length < actualCols) {
        currentRow.push('');
      }
      bodyData.push(currentRow);
      currentRow = [];
    }
  });

  const headCols = Array.from({length: actualCols}, (_, i) => `Coluna ${i + 1}`);

  autoTable(doc, {
    startY: y,
    head: [headCols],
    body: bodyData,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 10, cellPadding: 6, halign: 'center', valign: 'middle', minCellHeight: 22, overflow: 'linebreak' },
    margin: { left: 14, right: 14 },
  });

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
}

export async function exportLayoutDocx(layout: { id: number; treatment: string; rep: number }[], columns: number) {
  const actualCols = columns > 0 ? columns : Math.ceil(Math.sqrt(layout.length));
  
  const bodyData: any[][] = [];
  let currentRow: any[] = [];
  
  layout.forEach((plot, index) => {
    const cellText = `${plot.treatment}\nRep ${plot.rep}\n[P: ${plot.id}]`;
    currentRow.push(cellText);

    if ((index + 1) % actualCols === 0 || index === layout.length - 1) {
      while (currentRow.length < actualCols) {
        currentRow.push('');
      }
      bodyData.push(currentRow);
      currentRow = [];
    }
  });

  const tableRows = [
    new TableRow({
      children: Array.from({length: actualCols}, (_, i) => 
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: `Coluna ${i + 1}`, color: "ffffff", bold: true })],
              alignment: AlignmentType.CENTER 
            })
          ],
          shading: { fill: "1e293b", type: ShadingType.CLEAR, color: "auto" },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 150, bottom: 150, left: 150, right: 150 },
        })
      )
    }),
    ...bodyData.map(row => 
      new TableRow({
        children: row.map(cell => 
          new TableCell({
            children: cell.split('\n').map((line: string) => 
              new Paragraph({ text: line, alignment: AlignmentType.CENTER })
            ),
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
          })
        )
      })
    )
  ];

  const table = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    columnWidths: Array(actualCols).fill(9000 / actualCols),
    rows: tableRows,
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Statium", bold: true, size: 44, color: "63dcbe" })
            ],
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Croqui Casualizado - Experimento DIC", size: 20, color: "94a3b8" })
            ],
            alignment: AlignmentType.LEFT,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          table,
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const now = new Date();
  downloadBlob(blob, `statium-croqui-${now.toISOString().slice(0, 10)}.docx`);
}

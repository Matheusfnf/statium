'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { AnovaResult } from '@/lib/statistics';
import { standardError } from '@/lib/statistics';
import { exportChartWord } from '@/lib/export';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface GroupInfo {
  name: string;
  mean: number;
  letter: string;
}

interface ResultsChartProps {
  anovaResult: AnovaResult;
  groups: GroupInfo[];
  data: (number | null)[][];
  is3d?: boolean;
}

// Plugin to draw 3D bars
const plugin3d = {
  id: 'plugin3d',
  beforeDatasetsDraw(chart: any) {
    if (!chart.options.is3D) return;
    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    meta.data.forEach((bar: any) => {
      const { x, y, base, width } = bar;
      const depth = 15;
      
      const bgColor = bar.options.backgroundColor;
      const baseClamped = Math.min(base, chart.chartArea ? chart.chartArea.bottom : base);
      
      ctx.save();
      
      // Right face
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width / 2 + depth, y - depth);
      ctx.lineTo(x + width / 2 + depth, baseClamped - depth);
      ctx.lineTo(x + width / 2, baseClamped);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();
      
      // Top face
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y);
      ctx.lineTo(x - width / 2 + depth, y - depth);
      ctx.lineTo(x + width / 2 + depth, y - depth);
      ctx.lineTo(x + width / 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      
      ctx.restore();
    });
  }
};

ChartJS.register(plugin3d);

// Plugin to draw letters above bars
const letterPlugin = {
  id: 'letterPlugin',
  afterDraw(chart: any) {
    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    const letters = chart.options.letterData;
    const is3D = chart.options.is3D;
    if (!letters || !meta.data) return;

    ctx.save();
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = chart.options.letterColor || '#63dcbe';
    ctx.textAlign = 'center';

    meta.data.forEach((bar: any, index: number) => {
      if (letters[index]) {
        const x = bar.x + (is3D ? 7.5 : 0);
        const y = bar.y - (is3D ? 15 : 0) - 12;
        ctx.fillText(letters[index], x, y);
      }
    });
    ctx.restore();
  },
};

ChartJS.register(letterPlugin);

export interface ResultsChartRef {
  exportToWord: (variableName: string) => void;
}

const ResultsChart = forwardRef<ResultsChartRef, ResultsChartProps>(
  ({ anovaResult, groups, data, is3d = false }, ref) => {
    const chartRef = useRef<ChartJS<'bar'>>(null);

    useImperativeHandle(ref, () => ({
      exportToWord: (variableName: string) => {
        // Generate an ABNT-styled chart offscreen
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 800;
        offCanvas.height = 500;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;

        // Fill white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        
        // Draw chart border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, offCanvas.width, offCanvas.height);

        const abntChart = new ChartJS(offCanvas, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Média',
              data: means,
              backgroundColor: '#4A86E8', // standard blue
              borderColor: '#000000',
              borderWidth: is3d ? 0 : 1,
              borderRadius: 0,
              barPercentage: 0.6,
            }]
          },
          options: {
            responsive: false,
            animation: false,
            letterData: letters,
            is3D: is3d,
            letterColor: '#000000',
            layout: {
              padding: { top: is3d ? 50 : 40, right: is3d ? 30 : 20, left: 20, bottom: 20 }
            },
            plugins: {
              legend: { display: false },
              title: { display: false },
              tooltip: { enabled: false },
              // Enable letter and 3D plugin via ID since they are globally registered
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Tratamentos',
                  color: '#000000',
                  font: { family: 'Arial', size: 14, weight: 'bold' }
                },
                grid: { display: false },
                ticks: { color: '#000000', font: { family: 'Arial', size: 12 } }
              },
              y: {
                title: {
                  display: true,
                  text: variableName,
                  color: '#000000',
                  font: { family: 'Arial', size: 14, weight: 'bold' }
                },
                grid: { color: '#E5E5E5' },
                ticks: { color: '#000000', font: { family: 'Arial', size: 12 } },
                beginAtZero: true
              }
            }
          } as any
        });

        // Get base64 synchronously after rendering
        const base64 = abntChart.toBase64Image();
        abntChart.destroy();

        exportChartWord(base64, variableName);
      }
    }));

    // Sort groups by mean descending to match the table
  const sortedGroups = [...groups];

  const labels = sortedGroups.map((g) => g.name);
  const means = sortedGroups.map((g) => g.mean);
  const letters = sortedGroups.map((g) => g.letter);

  // Calculate error bars
  const errors = sortedGroups.map((g) => {
    const treatIdx = anovaResult.treatmentNames.indexOf(g.name);
    if (treatIdx >= 0 && data[treatIdx]) {
      const validData = data[treatIdx].filter(v => v !== null) as number[];
      return standardError(validData);
    }
    return 0;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Média',
        data: means,
        backgroundColor: means.map(
          (_, i) => {
            const hue = 160 + (i * 40) % 200;
            return is3d ? `hsla(${hue}, 70%, 55%, 0.85)` : `hsla(${hue}, 70%, 55%, 0.7)`;
          }
        ),
        borderColor: means.map(
          (_, i) => {
            const hue = 160 + (i * 40) % 200;
            return `hsla(${hue}, 70%, 55%, 1)`;
          }
        ),
        borderWidth: is3d ? 0 : 2,
        borderRadius: is3d ? 0 : 6,
        borderSkipped: false as const,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    letterData: letters,
    is3D: is3d,
    layout: {
      padding: {
        top: is3d ? 50 : 30,
        right: is3d ? 20 : 0,
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f0f2f5',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function (context: any) {
            const idx = context.dataIndex;
            const yVal = context.parsed.y ?? 0;
            return [
              `Média: ${yVal.toFixed(4)}`,
              `Grupo: ${letters[idx]}`,
              `EP: ±${errors[idx].toFixed(4)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255,255,255,0.05)',
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'Inter',
            weight: 600 as const,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(255,255,255,0.05)',
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'Inter',
          },
        },
        beginAtZero: false,
      },
    },
  };

  return <Bar ref={chartRef} data={chartData} options={options} />;
});

export default ResultsChart;

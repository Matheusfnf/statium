'use client';

import { useEffect, useRef } from 'react';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface GroupInfo {
  name: string;
  mean: number;
  letter: string;
}

interface ResultsChartProps {
  anovaResult: AnovaResult;
  groups: GroupInfo[];
  data: number[][];
}

// Plugin to draw letters above bars
const letterPlugin = {
  id: 'letterPlugin',
  afterDraw(chart: ChartJS) {
    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    const letters = (chart.options as unknown as { letterData?: string[] }).letterData;
    if (!letters || !meta.data) return;

    ctx.save();
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = '#63dcbe';
    ctx.textAlign = 'center';

    meta.data.forEach((bar, index) => {
      if (letters[index]) {
        const x = bar.x;
        const y = bar.y - 12;
        ctx.fillText(letters[index], x, y);
      }
    });
    ctx.restore();
  },
};

ChartJS.register(letterPlugin);

export default function ResultsChart({ anovaResult, groups, data }: ResultsChartProps) {
  const chartRef = useRef<ChartJS<'bar'>>(null);

  // Sort groups by mean descending to match the table
  const sortedGroups = [...groups];

  const labels = sortedGroups.map((g) => g.name);
  const means = sortedGroups.map((g) => g.mean);
  const letters = sortedGroups.map((g) => g.letter);

  // Calculate error bars
  const errors = sortedGroups.map((g) => {
    const treatIdx = anovaResult.treatmentNames.indexOf(g.name);
    if (treatIdx >= 0 && data[treatIdx]) {
      return standardError(data[treatIdx]);
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
            return `hsla(${hue}, 70%, 55%, 0.7)`;
          }
        ),
        borderColor: means.map(
          (_, i) => {
            const hue = 160 + (i * 40) % 200;
            return `hsla(${hue}, 70%, 55%, 1)`;
          }
        ),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false as const,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    letterData: letters,
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
}

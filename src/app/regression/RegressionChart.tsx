'use client';

import { forwardRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  LineController
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { RegressionResult } from '@/lib/statistics/regression';

const COLORS = [
  { line: '#10b981', point: '#34d399', bg: 'rgba(16, 185, 129, 0.2)' }, // Emerald
  { line: '#3b82f6', point: '#60a5fa', bg: 'rgba(59, 130, 246, 0.2)' }, // Blue
  { line: '#f43f5e', point: '#fb7185', bg: 'rgba(244, 63, 94, 0.2)' },  // Rose
  { line: '#8b5cf6', point: '#a78bfa', bg: 'rgba(139, 92, 246, 0.2)' }, // Violet
  { line: '#f59e0b', point: '#fbbf24', bg: 'rgba(245, 158, 11, 0.2)' }  // Amber
];

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  LineController
);

interface RegressionChartProps {
  results: RegressionResult[];
  variableName: string;
  quantFactorName?: string;
}

const RegressionChart = forwardRef<unknown, RegressionChartProps>(
  ({ results, variableName, quantFactorName }, ref) => {
    
    // Find absolute min/max across all results
    let globalMinX = Infinity;
    let globalMaxX = -Infinity;
    
    results.forEach(res => {
      const minX = Math.min(...res.xValues);
      const maxX = Math.max(...res.xValues);
      if (minX < globalMinX) globalMinX = minX;
      if (maxX > globalMaxX) globalMaxX = maxX;
    });

    const padding = (globalMaxX - globalMinX) * 0.05;
    const startX = globalMinX - padding;
    const endX = globalMaxX + padding;
    const steps = 100;
    const stepSize = (endX - startX) / steps;
    
    const datasets: any[] = [];

    results.forEach((res, index) => {
      const color = COLORS[index % COLORS.length];
      const labelPrefix = res.levelName && res.levelName !== 'Geral' ? `${res.levelName}: ` : '';

      // Always show observed scatter points
      const scatterPoints = res.xValues.map((x, i) => ({ x, y: res.observedMeans[i] }));
      datasets.push({
        type: 'scatter' as const,
        label: `${labelPrefix}Médias Observadas`,
        data: scatterPoints,
        backgroundColor: color.point,
        borderColor: color.line,
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        order: 1
      });

      // Only plot fitted curve when there is a significant model
      if (res.bestModelIndex >= 0) {
        const model = res.models[res.bestModelIndex];
        const curvePoints = [];
        for (let i = 0; i <= steps; i++) {
          const x = startX + i * stepSize;
          let y = 0;
          for (let j = 0; j <= model.degree; j++) {
            y += model.coefficients[j] * Math.pow(x, j);
          }
          curvePoints.push({ x, y });
        }
        datasets.push({
          type: 'line' as const,
          label: `${labelPrefix}Curva Ajustada (${model.name})`,
          data: curvePoints,
          borderColor: color.line,
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
          order: 2
        });
      }
    });

    const chartData = { datasets };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#e2e8f0',
            font: { family: 'Inter', size: 14 },
            usePointStyle: true,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          type: 'linear' as const,
          title: {
            display: true,
            text: quantFactorName || 'Níveis de Tratamento (Doses)',
            color: '#94a3b8',
            font: { family: 'Inter', size: 14, weight: 600 as const }
          },
          grid: {
            color: 'rgba(255,255,255,0.05)',
          },
          ticks: {
            color: '#94a3b8',
          }
        },
        y: {
          type: 'linear' as const,
          title: {
            display: true,
            text: variableName,
            color: '#94a3b8',
            font: { family: 'Inter', size: 14, weight: 600 as const }
          },
          grid: {
            color: 'rgba(255,255,255,0.05)',
          },
          ticks: {
            color: '#94a3b8',
          }
        }
      }
    };

    return <Chart ref={ref as any} type="scatter" data={chartData} options={options} />;
  }
);

export default RegressionChart;

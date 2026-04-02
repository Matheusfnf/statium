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
import type { PolynomialModel } from '@/lib/statistics/regression';

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
  xValues: number[];
  observedMeans: number[];
  model: PolynomialModel;
  variableName: string;
}

const RegressionChart = forwardRef<unknown, RegressionChartProps>(
  ({ xValues, observedMeans, model, variableName }, ref) => {
    
    // Create finely sampled points for the curve
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const padding = (maxX - minX) * 0.05;
    
    const startX = minX - padding;
    const endX = maxX + padding;
    const steps = 50;
    const stepSize = (endX - startX) / steps;
    
    const curvePoints = [];
    for (let i = 0; i <= steps; i++) {
        const x = startX + i * stepSize;
        let y = 0;
        for (let j = 0; j <= model.degree; j++) {
            y += model.coefficients[j] * Math.pow(x, j);
        }
        curvePoints.push({ x, y });
    }

    const scatterPoints = xValues.map((x, i) => ({ x, y: observedMeans[i] }));

    const chartData = {
      datasets: [
        {
          type: 'scatter' as const,
          label: 'Médias Observadas',
          data: scatterPoints,
          backgroundColor: '#fbbf24', // Yellowish point
          borderColor: '#d97706',
          borderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          order: 1
        },
        {
          type: 'line' as const,
          label: `Curva Ajustada (${model.name})`,
          data: curvePoints,
          borderColor: '#10b981', // Emerald green line
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.4, // smooth curve
          order: 2
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#e2e8f0',
            font: { family: 'Inter', size: 14 }
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
            text: 'Níveis de Tratamento (Doses)',
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

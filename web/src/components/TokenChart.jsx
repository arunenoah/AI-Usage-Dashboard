import React, { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

function fmtM(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

export default function TokenChart({ daily = [], totalTokens = 0 }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current || daily.length === 0) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = daily.map(d => {
      const dt = new Date(d.date)
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Output',
            data: daily.map(d => d.output_tokens),
            backgroundColor: '#81C784',
            borderRadius: { topLeft: 3, topRight: 3 },
            borderSkipped: false,
            order: 0,
          },
          {
            label: 'Cache Read',
            data: daily.map(d => d.cache_read),
            backgroundColor: '#BBDEFB',
            order: 1,
          },
          {
            label: 'Input',
            data: daily.map(d => d.input_tokens),
            backgroundColor: '#7986CB',
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: false,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'rect',
              boxWidth: 10,
              boxHeight: 10,
              font: { family: 'Figtree', size: 12 },
              color: '#7b809a',
              padding: 20,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${(ctx.parsed.y / 1000).toFixed(0)}k`,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { family: 'Figtree', size: 11 },
              color: '#9baabf',
              maxRotation: 0,
              maxTicksLimit: 8,
            },
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
            border: { display: false },
            ticks: {
              font: { family: 'Figtree', size: 11 },
              color: '#9baabf',
              callback: v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v,
            },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [daily])

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px 24px 16px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 13, color: '#7b809a', fontWeight: 500 }}>Token Usage</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#344767', fontFamily: 'Figtree', marginTop: 2 }}>{fmtM(totalTokens)}</div>
          <div style={{ fontSize: 12, color: '#4CAF50', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>📈</span> <span style={{ color: '#4CAF50' }}>+12%</span> <span style={{ color: '#7b809a', fontWeight: 400 }}>than last month</span>
          </div>
        </div>
        <span style={{ background: '#EBF4FF', color: '#1A73E8', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20, letterSpacing: 0.5 }}>30 DAYS</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f2f5', margin: '16px -24px' }} />

      {/* Chart */}
      <div style={{ height: 260 }}>
        <canvas ref={ref} />
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: '#9baabf', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🕐</span> Last updated just now
      </div>
    </div>
  )
}

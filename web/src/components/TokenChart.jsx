import React, { useEffect, useRef, useState } from 'react'
import { Chart, BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, LogarithmicScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, LogarithmicScale, Tooltip, Legend)

function fmtTok(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

const DATE_RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'ALL', days: 0 },
]

const VIEWS = ['Cache', 'I/O', 'All']

export default function TokenChart({ daily = [], totalTokens = 0, onRangeChange, currentDays = 30 }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const [view, setView] = useState('Cache') // Cache | I/O | All

  useEffect(() => {
    if (!ref.current || daily.length === 0) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = daily.map(d => {
      const dt = new Date(d.date)
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    let datasets = []
    let yScale = { type: 'linear' }

    if (view === 'Cache') {
      datasets = [
        {
          label: 'Cache Read',
          data: daily.map(d => d.cache_read || 0),
          backgroundColor: '#BBDEFB',
          borderRadius: { topLeft: 3, topRight: 3 },
          stack: 'cache',
        },
        {
          label: 'Cache Write',
          data: daily.map(d => d.cache_creation || 0),
          backgroundColor: '#FFB74D',
          stack: 'cache',
        },
      ]
    } else if (view === 'I/O') {
      datasets = [
        {
          label: 'Output',
          data: daily.map(d => d.output_tokens || 0),
          backgroundColor: '#81C784',
          borderRadius: { topLeft: 3, topRight: 3 },
          stack: 'io',
        },
        {
          label: 'Input',
          data: daily.map(d => d.input_tokens || 0),
          backgroundColor: '#7986CB',
          stack: 'io',
        },
      ]
    } else {
      // All — use log scale so everything is visible
      yScale = { type: 'logarithmic' }
      datasets = [
        {
          label: 'Cache Read',
          data: daily.map(d => d.cache_read || 1),
          backgroundColor: '#BBDEFB',
          borderRadius: { topLeft: 2, topRight: 2 },
          stack: 'all',
        },
        {
          label: 'Cache Write',
          data: daily.map(d => d.cache_creation || 1),
          backgroundColor: '#FFB74D',
          stack: 'all',
        },
        {
          label: 'Output',
          data: daily.map(d => d.output_tokens || 1),
          backgroundColor: '#81C784',
          stack: 'all',
        },
        {
          label: 'Input',
          data: daily.map(d => d.input_tokens || 1),
          backgroundColor: '#7986CB',
          stack: 'all',
        },
      ]
    }

    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets },
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
              label: ctx => ` ${ctx.dataset.label}: ${fmtTok(ctx.parsed.y)}`,
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
              maxTicksLimit: 10,
            },
          },
          y: {
            stacked: true,
            ...yScale,
            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
            border: { display: false },
            ticks: {
              font: { family: 'Figtree', size: 11 },
              color: '#9baabf',
              callback: v => fmtTok(v),
            },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [daily, view])

  const totalDisplay = view === 'I/O'
    ? fmtTok(daily.reduce((s, d) => s + (d.input_tokens || 0) + (d.output_tokens || 0), 0))
    : view === 'Cache'
    ? fmtTok(daily.reduce((s, d) => s + (d.cache_read || 0) + (d.cache_creation || 0), 0))
    : fmtTok(totalTokens)

  const currentRange = DATE_RANGES.find(r => r.days === currentDays) || DATE_RANGES[3]

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px 24px 16px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 13, color: '#7b809a', fontWeight: 500 }}>Token Usage</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#344767', fontFamily: 'Figtree', marginTop: 2 }}>{totalDisplay}</div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 4 }}>
            {view === 'Cache' ? 'Cache read + write tokens' : view === 'I/O' ? 'Fresh input + output tokens' : 'All token types (log scale)'}
          </div>
        </div>
        {/* Date range + view toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {/* Date range selector */}
          <div style={{ display: 'flex', gap: 4, background: '#f0f2f5', borderRadius: 20, padding: '3px' }}>
            {DATE_RANGES.map(r => (
              <button key={r.label} onClick={() => onRangeChange?.(r.days)} style={{
                padding: '4px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: currentDays === r.days ? '#1A73E8' : 'transparent',
                color: currentDays === r.days ? '#fff' : '#7b809a',
                transition: 'all 0.15s',
              }}>{r.label}</button>
            ))}
          </div>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, background: '#f0f2f5', borderRadius: 20, padding: '3px' }}>
            {VIEWS.map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '4px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: view === v ? '#344767' : 'transparent',
                color: view === v ? '#fff' : '#7b809a',
                transition: 'all 0.15s',
              }}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f2f5', margin: '16px -24px' }} />

      {/* View hint */}
      {view === 'All' && (
        <div style={{ fontSize: 11, color: '#FB8C00', background: '#FFF8E1', borderRadius: 6, padding: '4px 10px', marginBottom: 8, display: 'inline-block' }}>
          Log scale — all token types visible. Cache dominates by 1000×.
        </div>
      )}

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

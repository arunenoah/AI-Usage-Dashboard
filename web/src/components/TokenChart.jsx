import React, { useEffect, useRef, useState } from 'react'
import { Chart, BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

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

const VIEWS = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'cache',  label: 'Cache' },
]

export default function TokenChart({ daily = [], onRangeChange, currentDays = 30 }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const [view, setView] = useState('tokens')

  const periodInput = daily.reduce((s, d) => s + (d.input_tokens || 0), 0)
  const periodOutput = daily.reduce((s, d) => s + (d.output_tokens || 0), 0)
  const periodTotal = periodInput + periodOutput
  const periodCache = daily.reduce((s, d) => s + (d.cache_read || 0), 0)
  const activeDays = daily.filter(d => (d.input_tokens || 0) + (d.output_tokens || 0) > 0).length
  const avgPerDay = activeDays > 0 ? Math.round(periodTotal / activeDays) : 0

  // Trend: compare last 7 days vs previous 7 days
  const last7Total = daily.slice(-7).reduce((s, d) => s + (d.input_tokens || 0) + (d.output_tokens || 0), 0)
  const prev7Total = daily.slice(-14, -7).reduce((s, d) => s + (d.input_tokens || 0) + (d.output_tokens || 0), 0)
  const trendPct = prev7Total > 0 ? ((last7Total - prev7Total) / prev7Total * 100) : 0

  // Output ratio
  const outputRatio = periodInput > 0 ? (periodOutput / periodInput).toFixed(1) : '—'

  // Cache hit rate
  const cacheTotal = periodCache + periodInput
  const cacheHitPct = cacheTotal > 0 ? Math.round(periodCache / cacheTotal * 100) : 0

  useEffect(() => {
    if (!ref.current || daily.length === 0) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = daily.map(d => {
      const dt = new Date(d.date)
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    let datasets = []
    let yAxis = {}

    if (view === 'tokens') {
      datasets = [
        {
          label: 'Output',
          data: daily.map(d => d.output_tokens || 0),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: daily.length > 30 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#22c55e',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderWidth: 2,
        },
        {
          label: 'Input',
          data: daily.map(d => d.input_tokens || 0),
          borderColor: '#818cf8',
          backgroundColor: 'rgba(129, 140, 248, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: daily.length > 30 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#818cf8',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderWidth: 2,
        },
      ]
    } else {
      datasets = [
        {
          label: 'Cache Read',
          data: daily.map(d => d.cache_read || 0),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: daily.length > 30 ? 0 : 2,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
        {
          label: 'Cache Write',
          data: daily.map(d => d.cache_creation || 0),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: daily.length > 30 ? 0 : 2,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
      ]
    }

    yAxis = {
      grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false },
      border: { display: false },
      ticks: { font: { family: 'Figtree', size: 10 }, color: '#9baabf', callback: v => fmtTok(v) },
    }

    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true, position: 'top', align: 'end',
            labels: {
              usePointStyle: true, pointStyle: 'circle', boxWidth: 6, boxHeight: 6,
              font: { family: 'Figtree', size: 11 }, color: '#7b809a', padding: 12,
            },
          },
          tooltip: {
            backgroundColor: '#344767',
            titleFont: { family: 'Figtree', size: 11 },
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            cornerRadius: 8, padding: 10,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${fmtTok(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false }, border: { display: false },
            ticks: { font: { family: 'Figtree', size: 10 }, color: '#9baabf', maxRotation: 0, maxTicksLimit: 8 },
          },
          y: yAxis,
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [daily, view])

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#7b809a', fontWeight: 500, marginBottom: 4 }}>Token Usage</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#344767', lineHeight: 1 }}>{fmtTok(periodTotal)}</div>
            <div style={{ fontSize: 10, color: '#9baabf', marginTop: 4 }}>
              {fmtTok(periodOutput)} output · {fmtTok(periodInput)} input
            </div>
          </div>
          {trendPct !== 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20,
              background: trendPct > 0 ? '#EBF3FF' : '#FEF2F2',
              color: trendPct > 0 ? '#1A73E8' : '#ef4444',
              fontSize: 11, fontWeight: 700,
            }}>
              {trendPct > 0 ? '↑' : '↓'} {Math.abs(trendPct).toFixed(0)}%
              <span style={{ fontWeight: 500, color: '#9baabf', marginLeft: 2 }}>vs prev week</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 3, background: '#f0f2f5', borderRadius: 20, padding: '3px' }}>
            {DATE_RANGES.map(r => (
              <button key={r.label} onClick={() => onRangeChange?.(r.days)} style={{
                padding: '4px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: currentDays === r.days ? '#1A73E8' : 'transparent',
                color: currentDays === r.days ? '#fff' : '#7b809a',
              }}>{r.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, background: '#f0f2f5', borderRadius: 20, padding: '3px' }}>
            {VIEWS.map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '4px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: view === v.id ? '#344767' : 'transparent',
                color: view === v.id ? '#fff' : '#7b809a',
              }}>{v.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Output Tokens', value: fmtTok(periodOutput), sub: 'code Claude generated', color: '#22c55e', icon: '▸' },
          { label: 'Output Ratio', value: `${outputRatio}×`, sub: 'output ÷ input', color: '#8b5cf6', icon: '◎' },
          { label: 'Avg / Day', value: fmtTok(avgPerDay), sub: `${activeDays} active days`, color: '#1A73E8', icon: '◇' },
          { label: 'Cache Hit Rate', value: `${cacheHitPct}%`, sub: `${fmtTok(periodCache)} cached`, color: '#60a5fa', icon: '△' },
        ].map(m => (
          <div key={m.label} style={{
            background: '#f8fafc', borderRadius: 10, padding: '12px 14px',
            borderLeft: `3px solid ${m.color}`,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {m.icon} {m.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: 'Figtree', lineHeight: 1.1 }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 10, color: '#9baabf', marginTop: 3 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      <div style={{ height: 220 }}>
        <canvas ref={ref} />
      </div>

      {/* ── Last 7 days — input/output breakdown ── */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f2f5' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          Last 7 Days
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {daily.slice(-7).map((d) => {
            const input = d.input_tokens || 0
            const output = d.output_tokens || 0
            const total = input + output
            const maxTotal = Math.max(...daily.slice(-7).map(x => (x.input_tokens || 0) + (x.output_tokens || 0)), 1)
            const intensity = total / maxTotal
            const dt = new Date(d.date)
            const dayLabel = dt.toLocaleDateString('en-US', { weekday: 'short' })
            const dateLabel = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const bgColor = total === 0 ? '#f8f9fa'
              : intensity > 0.8 ? '#1A73E8'
              : intensity > 0.5 ? '#60a5fa'
              : intensity > 0.2 ? '#93c5fd'
              : '#dbeafe'
            const textColor = intensity > 0.5 ? '#fff' : '#344767'
            return (
              <div key={d.date} style={{
                background: bgColor, borderRadius: 8, padding: '8px 6px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: total === 0 ? '#9baabf' : textColor, opacity: 0.8 }}>{dayLabel}</div>
                <div style={{ fontSize: 8, color: total === 0 ? '#c4cdd6' : textColor, opacity: 0.7, marginBottom: 4 }}>{dateLabel}</div>
                {total > 0 ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 2 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: textColor, fontFamily: 'JetBrains Mono' }}>{fmtTok(output)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#818cf8', flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: textColor, opacity: 0.8, fontFamily: 'JetBrains Mono' }}>{fmtTok(input)}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 10, color: '#c4cdd6', marginTop: 4 }}>—</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

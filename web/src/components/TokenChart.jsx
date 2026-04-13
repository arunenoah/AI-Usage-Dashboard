import React, { useEffect, useRef, useState } from 'react'
import { Chart, BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

function fmtTok(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

function fmtCost(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  if (n >= 100) return `$${n.toFixed(0)}`
  if (n >= 10) return `$${n.toFixed(1)}`
  return `$${n.toFixed(2)}`
}

const DATE_RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'ALL', days: 0 },
]

const VIEWS = [
  { id: 'cost',   label: 'Cost' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'cache',  label: 'Cache' },
]

// Weekly summary: last 7 days of data
function weeklySummary(daily) {
  const last7 = daily.slice(-7)
  const totalCost = last7.reduce((s, d) => s + (d.est_cost_usd || 0), 0)
  const totalInput = last7.reduce((s, d) => s + (d.input_tokens || 0), 0)
  const totalOutput = last7.reduce((s, d) => s + (d.output_tokens || 0), 0)
  const days = last7.filter(d => (d.input_tokens || 0) + (d.output_tokens || 0) > 0).length || 1
  const avgDaily = totalCost / days
  const projected = avgDaily * 30
  return { totalCost, totalInput, totalOutput, avgDaily, projected, days: last7.length }
}

function SummaryPill({ label, value, sub, color = '#344767' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9baabf' }}>{sub}</div>}
    </div>
  )
}

export default function TokenChart({ daily = [], totalTokens = 0, onRangeChange, currentDays = 30 }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const [view, setView] = useState('cost')

  const summary = weeklySummary(daily)

  useEffect(() => {
    if (!ref.current || daily.length === 0) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = daily.map(d => {
      const dt = new Date(d.date)
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    let datasets = []
    let yAxis = {}
    let xAxis = {}

    if (view === 'cost') {
      // Cost bars per day
      datasets = [
        {
          label: 'Daily Cost (USD)',
          data: daily.map(d => +(d.est_cost_usd || 0).toFixed(3)),
          backgroundColor: daily.map((d, i) => {
            const cost = d.est_cost_usd || 0
            if (cost > 80) return '#ef4444'
            if (cost > 40) return '#f97316'
            return '#1A73E8'
          }),
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: false,
        },
      ]
      yAxis = {
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        border: { display: false },
        ticks: {
          font: { family: 'Figtree', size: 11 },
          color: '#9baabf',
          callback: v => `$${v.toFixed(0)}`,
        },
      }
    } else if (view === 'tokens') {
      // Input + Output stacked
      datasets = [
        {
          label: 'Output tokens',
          data: daily.map(d => d.output_tokens || 0),
          backgroundColor: '#34d399',
          borderRadius: { topLeft: 4, topRight: 4 },
          stack: 'io',
        },
        {
          label: 'Input tokens',
          data: daily.map(d => d.input_tokens || 0),
          backgroundColor: '#818cf8',
          stack: 'io',
        },
      ]
      yAxis = {
        stacked: true,
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        border: { display: false },
        ticks: {
          font: { family: 'Figtree', size: 11 },
          color: '#9baabf',
          callback: v => fmtTok(v),
        },
      }
      xAxis = { stacked: true }
    } else {
      // Cache view
      datasets = [
        {
          label: 'Cache Read',
          data: daily.map(d => d.cache_read || 0),
          backgroundColor: '#93c5fd',
          borderRadius: { topLeft: 4, topRight: 4 },
          stack: 'cache',
        },
        {
          label: 'Cache Write',
          data: daily.map(d => d.cache_creation || 0),
          backgroundColor: '#fcd34d',
          stack: 'cache',
        },
      ]
      yAxis = {
        stacked: true,
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        border: { display: false },
        ticks: {
          font: { family: 'Figtree', size: 11 },
          color: '#9baabf',
          callback: v => fmtTok(v),
        },
      }
      xAxis = { stacked: true }
    }

    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: view !== 'cost',
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'rect',
              boxWidth: 10,
              boxHeight: 10,
              font: { family: 'Figtree', size: 12 },
              color: '#7b809a',
              padding: 16,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (view === 'cost') return ` $${ctx.parsed.y.toFixed(2)}`
                return ` ${ctx.dataset.label}: ${fmtTok(ctx.parsed.y)}`
              },
              title: titles => titles[0]?.label || '',
            },
          },
        },
        scales: {
          x: {
            ...xAxis,
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { family: 'Figtree', size: 11 },
              color: '#9baabf',
              maxRotation: 0,
              maxTicksLimit: 10,
            },
          },
          y: yAxis,
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [daily, view])

  const currentRange = DATE_RANGES.find(r => r.days === currentDays) || DATE_RANGES[3]

  // Period totals for the header
  const periodCost = daily.reduce((s, d) => s + (d.est_cost_usd || 0), 0)
  const periodInput = daily.reduce((s, d) => s + (d.input_tokens || 0), 0)
  const periodOutput = daily.reduce((s, d) => s + (d.output_tokens || 0), 0)

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px 24px 16px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: '#7b809a', fontWeight: 500 }}>Token Usage</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#344767', fontFamily: 'Figtree', marginTop: 2, lineHeight: 1 }}>
            {fmtCost(periodCost)}
          </div>
          <div style={{ fontSize: 12, color: '#9baabf', marginTop: 4 }}>
            {fmtTok(periodInput)} input · {fmtTok(periodOutput)} output
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {/* Date range */}
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
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '4px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: view === v.id ? '#344767' : 'transparent',
                color: view === v.id ? '#fff' : '#7b809a',
                transition: 'all 0.15s',
              }}>{v.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Weekly summary pills ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16, background: '#f8fafc', borderRadius: 12, padding: '14px 20px',
        marginBottom: 20,
      }}>
        <SummaryPill
          label="7-day spend"
          value={fmtCost(summary.totalCost)}
          sub={`${summary.days} active days`}
          color="#1A73E8"
        />
        <SummaryPill
          label="Avg / day"
          value={fmtCost(summary.avgDaily)}
          sub="active days only"
          color="#344767"
        />
        <SummaryPill
          label="Projected / mo"
          value={fmtCost(summary.projected)}
          sub="based on daily avg"
          color={summary.projected > 500 ? '#ef4444' : summary.projected > 200 ? '#f97316' : '#344767'}
        />
        <SummaryPill
          label="Output generated"
          value={fmtTok(summary.totalOutput)}
          sub={`${fmtTok(summary.totalInput)} input`}
          color="#344767"
        />
      </div>

      <div style={{ height: 1, background: '#f0f2f5', margin: '0 -24px 16px' }} />

      {/* ── Chart ── */}
      <div style={{ height: 240 }}>
        <canvas ref={ref} />
      </div>

      {/* ── Daily breakdown table (last 7 days) ── */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
          Recent Days
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {daily.slice(-7).reverse().map((d, i) => {
            const totalTok = (d.input_tokens || 0) + (d.output_tokens || 0)
            const cost = d.est_cost_usd || 0
            const maxCost = Math.max(...daily.map(x => x.est_cost_usd || 0), 1)
            const barW = Math.round((cost / maxCost) * 100)
            const dt = new Date(d.date)
            const label = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            return (
              <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 90, fontSize: 11, color: '#7b809a', flexShrink: 0 }}>{label}</div>
                <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${barW}%`, height: '100%', borderRadius: 3,
                    background: cost > 80 ? '#ef4444' : cost > 40 ? '#f97316' : '#1A73E8',
                    transition: 'width 0.4s',
                  }} />
                </div>
                <div style={{ width: 44, fontSize: 12, fontWeight: 700, color: '#344767', textAlign: 'right', flexShrink: 0 }}>
                  {fmtCost(cost)}
                </div>
                <div style={{ width: 72, fontSize: 11, color: '#9baabf', textAlign: 'right', flexShrink: 0 }}>
                  {fmtTok(totalTok)} tok
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

import React, { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

function buildHourly(sessions) {
  const counts = new Array(24).fill(0)
  for (const s of sessions) {
    if (s.start_time) {
      const h = new Date(s.start_time).getHours()
      if (h >= 0 && h < 24) counts[h]++
    }
  }
  return counts
}

export default function ActivityChart({ sessions = [] }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const hourly = buildHourly(sessions)

  const peakHour = hourly.indexOf(Math.max(...hourly))
  const peakCount = hourly[peakHour]
  const peakLabel = `${peakHour.toString().padStart(2, '0')}:00`

  const LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`)
  const BG_COLORS = hourly.map((_, i) => i === peakHour ? '#388E3C' : '#A5D6A7')

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: LABELS,
        datasets: [{
          data: hourly,
          backgroundColor: BG_COLORS,
          borderRadius: 4,
          hoverBackgroundColor: '#2E7D32',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { family: 'Figtree', size: 10 },
              color: '#9baabf',
              maxRotation: 0,
              callback: (_, i) => i % 2 === 0 ? LABELS[i] : '',
            },
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            border: { display: false },
            ticks: { font: { family: 'Figtree', size: 10 }, color: '#9baabf' },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [sessions])

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 13, color: '#7b809a', fontWeight: 500 }}>Hourly Activity</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#344767', fontFamily: 'Figtree', marginTop: 2 }}>{peakLabel}</div>
          <div style={{ fontSize: 12, color: '#4CAF50', fontWeight: 600, marginTop: 4 }}>
            Peak hour — <span style={{ fontFamily: 'JetBrains Mono' }}>{peakCount}</span> sessions avg
          </div>
        </div>
        <span style={{ background: '#F5F5F5', color: '#7b809a', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>30-DAY AVG</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f2f5', margin: '16px -24px' }} />

      {/* Chart */}
      <div style={{ height: 180 }}>
        <canvas ref={ref} />
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: '#9baabf', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>📊</span> When you&apos;re most productive
      </div>
    </div>
  )
}

import React, { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)

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
  const data = buildHourly(sessions)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: HOURS,
        datasets: [{ data, backgroundColor: 'rgba(73,163,241,0.75)', borderRadius: 3, hoverBackgroundColor: '#1A73E8' }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 9 }, color: '#9baabf', maxRotation: 0 } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'JetBrains Mono', size: 9 }, color: '#9baabf' } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [sessions])

  return <div className="card-chart" style={{ height: 160 }}><canvas ref={ref} /></div>
}

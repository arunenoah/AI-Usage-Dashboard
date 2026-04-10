import React, { useEffect, useRef } from 'react'
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip)

export default function CostChart({ daily = [] }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()
    const labels = daily.map(d => d.date.slice(5))
    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'Cost USD', data: daily.map(d => d.est_cost_usd), borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.08)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#4CAF50', fill: true, tension: 0.4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#9baabf' } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#9baabf', callback: v => `$${v.toFixed(2)}` } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [daily])

  return <div className="card-chart" style={{ height: 200 }}><canvas ref={ref} /></div>
}

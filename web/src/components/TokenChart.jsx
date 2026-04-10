import React, { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

export default function TokenChart({ daily = [] }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()
    const labels = daily.map(d => d.date.slice(5))
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Input', data: daily.map(d => d.input_tokens), backgroundColor: 'rgba(73,163,241,0.85)', borderRadius: 4 },
          { label: 'Output', data: daily.map(d => d.output_tokens), backgroundColor: 'rgba(26,115,232,0.85)', borderRadius: 4 },
          { label: 'Cache', data: daily.map(d => d.cache_read), backgroundColor: 'rgba(156,163,175,0.5)', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#9baabf' } },
          y: { stacked: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#9baabf', callback: v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [daily])

  return <div className="card-chart" style={{ height: 200 }}><canvas ref={ref} /></div>
}

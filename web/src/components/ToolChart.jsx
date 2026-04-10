import React from 'react'

export default function ToolChart({ toolCounts = {} }) {
  const sorted = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const max = sorted[0]?.[1] || 1
  return (
    <div className="tool-bar-list">
      {sorted.map(([name, count]) => (
        <div key={name} className="tool-bar-row">
          <span className="tool-bar-name">{name}</span>
          <div className="tool-bar-track">
            <div className="tool-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="tool-bar-count">{count}</span>
        </div>
      ))}
    </div>
  )
}

import React from 'react'
import Icon from './Icon.jsx'

export default function StatCard({ label, value, delta, icon, colorClass }) {
  const positive = delta && !delta.startsWith('-')
  return (
    <div className="stat-card">
      <div className={`stat-icon-box ${colorClass}`}>
        <Icon name={icon} className="icon-lg" />
      </div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {delta && (
          <div className={`stat-delta ${positive ? 'pos' : 'neg'}`}>
            {positive ? '↑' : '↓'} {delta}
          </div>
        )}
      </div>
    </div>
  )
}

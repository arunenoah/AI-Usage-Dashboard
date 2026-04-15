import React, { useEffect, useState } from 'react'

const CMD_COLORS = {
  git:     '#F44336',
  npm:     '#E91E63',
  go:      '#00BCD4',
  python3: '#4CAF50',
  python:  '#4CAF50',
  node:    '#8BC34A',
  yarn:    '#03A9F4',
  cargo:   '#FF9800',
  make:    '#9C27B0',
  docker:  '#1565C0',
  kubectl: '#326CE5',
  brew:    '#FB8C00',
  curl:    '#607D8B',
  ls:      '#78909C',
  cd:      '#78909C',
}

function cmdColor(cmd) {
  return CMD_COLORS[cmd.toLowerCase()] || '#FB8C00'
}

export default function ShellCommandsPanel({ query = '' }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/shell-commands${query}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [query])

  const rows = data?.commands || []
  const max = rows[0]?.count || 1

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>$_</span> Shell Commands
          </div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
            Top CLI commands from Bash tool
          </div>
        </div>
        <span style={{ background: '#FFF8E1', color: '#FB8C00', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>BASH</span>
      </div>

      {rows.length === 0 && (
        <div style={{ color: '#9baabf', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No Bash tool samples captured yet</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.slice(0, 12).map((row, i) => {
          const color = cmdColor(row.command)
          const pct = max > 0 ? (row.count / max) * 100 : 0
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{
                fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: '#344767',
                width: 80, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {row.command}
              </span>
              <div style={{ flex: 1, height: 5, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s', opacity: 0.8 }} />
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: '#344767', width: 36, textAlign: 'right', flexShrink: 0 }}>
                {row.count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

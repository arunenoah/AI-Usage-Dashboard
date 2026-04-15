import React, { useEffect, useState } from 'react'

const SERVER_COLORS = [
  '#9C27B0', '#673AB7', '#3F51B5', '#1A73E8', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#FF9800', '#FF5722',
]

export default function MCPServersPanel({ query = '' }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/mcp-servers${query}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [query])

  const rows = data?.servers || []
  const max = rows[0]?.calls || 1
  const totalCalls = rows.reduce((s, r) => s + r.calls, 0)

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🔌</span> MCP Servers
          </div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
            {rows.length} server{rows.length !== 1 ? 's' : ''} · {totalCalls.toLocaleString()} total calls
          </div>
        </div>
        <span style={{ background: '#EDE7F6', color: '#9C27B0', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>MCP</span>
      </div>

      {rows.length === 0 && (
        <div style={{ color: '#9baabf', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          No MCP server tool calls found
          <div style={{ fontSize: 11, marginTop: 6 }}>MCP tools appear as <span style={{ fontFamily: 'JetBrains Mono', background: '#f5f5f5', padding: '1px 5px', borderRadius: 3 }}>mcp__server__tool</span></div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.slice(0, 10).map((row, i) => {
          const color = SERVER_COLORS[i % SERVER_COLORS.length]
          const pct = max > 0 ? (row.calls / max) * 100 : 0
          const sharePct = totalCalls > 0 ? Math.round(row.calls / totalCalls * 100) : 0
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{
                fontSize: 12, fontWeight: 600, color: '#344767',
                width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }} title={row.server}>
                {row.server}
              </span>
              <div style={{ flex: 1, height: 5, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: '#344767', width: 40, textAlign: 'right', flexShrink: 0 }}>
                {row.calls.toLocaleString()}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#9baabf', width: 28, textAlign: 'right', flexShrink: 0 }}>
                {sharePct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

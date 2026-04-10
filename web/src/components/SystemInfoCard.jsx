import React, { useEffect, useState } from 'react'

export default function SystemInfoCard() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    fetch('/api/system').then(r => r.json()).then(setInfo).catch(() => {})
  }, [])

  if (!info) return null

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>Claude Code Config</div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>From ~/.claude/settings.json</div>
        </div>
        {info.always_thinking_enabled && (
          <span style={{ background: '#E8F5E9', color: '#2E7D32', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
            Extended Thinking ON
          </span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Session Files', value: info.total_session_files },
          { label: 'Projects', value: info.total_project_dirs },
          { label: 'Plans', value: info.plan_count },
          { label: 'Tasks', value: info.task_count },
        ].map(item => (
          <div key={item.label} style={{ textAlign: 'center', padding: '10px', background: '#fafbfc', borderRadius: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#344767', fontFamily: 'JetBrains Mono' }}>{item.value}</div>
            <div style={{ fontSize: 10, color: '#9baabf', fontWeight: 600, textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.5 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Plugins */}
      {info.enabled_plugins?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Enabled Plugins</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {info.enabled_plugins.map(p => (
              <span key={p} style={{ padding: '3px 10px', borderRadius: 6, background: '#EBF4FF', color: '#1A73E8', fontSize: 11, fontWeight: 600 }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* MCP Servers */}
      {info.mcp_servers?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>MCP Servers</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {info.mcp_servers.map(s => (
              <span key={s} style={{ padding: '3px 10px', borderRadius: 6, background: '#F3E8FF', color: '#7B1FA2', fontSize: 11, fontWeight: 600 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

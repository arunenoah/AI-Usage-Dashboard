import React, { useState } from 'react'

function fmt(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

function relTime(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function SessionTable({ sessions = [] }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')

  const filtered = sessions.filter(s => {
    const q = query.toLowerCase()
    const matchQuery = !q || s.project_dir?.toLowerCase().includes(q) || s.first_prompt?.toLowerCase().includes(q)
    const matchTab =
      tab === 'all' ||
      (tab === 'large' && (s.total_usage?.input_tokens || 0) > 100_000) ||
      (tab === 'recent' && Date.now() - new Date(s.start_time) < 86_400_000)
    return matchQuery && matchTab
  })

  return (
    <>
      <div className="search-bar">
        <input className="search-input" placeholder="Filter by project or prompt…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="tab-bar">
        {['all', 'recent', 'large'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="sessions-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>First Prompt</th>
              <th>Turns</th>
              <th>Input Tokens</th>
              <th>Output Tokens</th>
              <th>Started</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(s => (
              <tr key={s.id}>
                <td><strong>{s.project_dir?.split('/').pop() || '—'}</strong></td>
                <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#7b809a' }}>{s.first_prompt || '—'}</td>
                <td className="mono">{s.user_turns}</td>
                <td className="mono">{fmt(s.total_usage?.input_tokens)}</td>
                <td className="mono">{fmt(s.total_usage?.output_tokens)}</td>
                <td style={{ color: '#7b809a', fontSize: 12 }}>{relTime(s.start_time)}</td>
                <td><span className="badge badge-blue">{s.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

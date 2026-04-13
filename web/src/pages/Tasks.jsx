import React, { useEffect, useState } from 'react'

const STATUS_ORDER = { in_progress: 0, pending: 1, completed: 2 }
const STATUS_COLOR = { completed: '#22c55e', in_progress: '#1A73E8', pending: '#9baabf' }
const STATUS_LABEL = { completed: 'Done', in_progress: 'Active', pending: 'Pending' }
const ALL = 'all'

function shortProject(dir) {
  if (!dir || dir === 'unknown') return 'Unknown'
  const parts = dir.replace('/Users/', '').split('/')
  return parts[parts.length - 1] || dir
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#9baabf'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: color + '18', color, textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export default function Tasks() {
  const [data, setData] = useState(null)
  const [selectedProject, setSelectedProject] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return (
    <div style={{ padding: 40, color: '#7b809a', fontFamily: 'Figtree', fontSize: 14 }}>Loading tasks…</div>
  )

  const { summary, projects } = data

  // All tasks flat list filtered
  const allTasks = projects.flatMap(p =>
    p.tasks.map(t => ({ ...t, _proj: p.project_dir, _rate: p.completion_rate }))
  )

  const visibleTasks = allTasks
    .filter(t => selectedProject === ALL || t.project_dir === selectedProject)
    .filter(t => statusFilter === ALL || t.status === statusFilter)
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))

  return (
    <div style={{ padding: 24, fontFamily: 'Figtree', maxWidth: 900 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#344767' }}>Tasks</div>
        <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
          {summary.completed} completed · {summary.in_progress} in progress · {summary.pending} pending
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', count: summary.total, color: '#344767' },
          { label: 'Done', count: summary.completed, color: '#22c55e' },
          { label: 'Active', count: summary.in_progress, color: '#1A73E8' },
          { label: 'Pending', count: summary.pending, color: '#9baabf' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ background: color + '12', border: `1px solid ${color}25`, borderRadius: 12, padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'JetBrains Mono' }}>{count}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Project completion bars */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#344767', marginBottom: 14 }}>By Project</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map(p => (
            <div key={p.project_dir} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => setSelectedProject(selectedProject === p.project_dir ? ALL : p.project_dir)}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: selectedProject === p.project_dir ? '#1A73E8' : '#344767',
                width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
              }} title={p.project_dir}>
                {shortProject(p.project_dir)}
              </span>
              <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${p.completion_rate}%`, background: '#22c55e', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#344767', width: 34, textAlign: 'right' }}>
                {p.completion_rate}%
              </span>
              <span style={{ fontSize: 10, color: '#9baabf', width: 60, textAlign: 'right' }}>
                {p.completed}/{p.completed + p.in_progress + p.pending}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f0f2f5', borderRadius: 20, padding: '3px' }}>
          {[ALL, 'in_progress', 'completed', 'pending'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
              background: statusFilter === s ? '#1A73E8' : 'transparent',
              color: statusFilter === s ? '#fff' : '#7b809a',
            }}>
              {s === ALL ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {selectedProject !== ALL && (
          <button onClick={() => setSelectedProject(ALL)} style={{
            padding: '4px 12px', borderRadius: 16, border: '1px solid #1A73E8',
            fontSize: 11, fontWeight: 600, color: '#1A73E8', background: '#EBF3FF', cursor: 'pointer',
          }}>
            {shortProject(selectedProject)} ✕
          </button>
        )}
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleTasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9baabf', fontSize: 13 }}>No tasks match this filter</div>
        )}
        {visibleTasks.map((t, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: '14px 16px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
            borderLeft: `3px solid ${STATUS_COLOR[t.status] || '#f0f2f5'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#344767', marginBottom: 4 }}>{t.subject}</div>
                {t.description && (
                  <div style={{ fontSize: 11, color: '#7b809a', lineHeight: 1.5, marginBottom: 6 }}>{t.description}</div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#9baabf', background: '#f8f9fa', padding: '2px 8px', borderRadius: 8 }}>
                    {shortProject(t.project_dir)}
                  </span>
                  {t.session_date && (
                    <span style={{ fontSize: 10, color: '#9baabf' }}>{t.session_date}</span>
                  )}
                </div>
              </div>
              <StatusBadge status={t.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

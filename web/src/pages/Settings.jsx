import Icon from '../components/Icon.jsx'

const ADAPTERS = [
  { name: 'Claude Code', icon: 'activity', status: 'active', path: '~/.claude/projects/' },
  { name: 'Cursor', icon: 'laptop', status: 'coming-soon', path: '~/.cursor/logs/' },
  { name: 'GitHub Copilot', icon: 'globe', status: 'active', path: '%APPDATA%\\Code\\User\\workspaceStorage\\' },
  { name: 'Windsurf', icon: 'zap', status: 'coming-soon', path: '~/.windsurf/sessions/' },
]

export default function Settings() {
  return (
    <>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Configure data sources and tool adapters</div>
      </div>
      <div className="card">
        <div className="card-strip strip-blue" />
        <div className="card-body">
          <div className="card-title">Tool Adapters</div>
          <div className="card-sub" style={{ marginBottom: 20 }}>Supported AI tools — community adapters welcome</div>
          {ADAPTERS.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid #f0f2f5' }}>
              <Icon name={a.icon} className="icon-md" style={{ color: '#1A73E8' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: '#9baabf', fontFamily: 'JetBrains Mono', marginTop: 2 }}>{a.path}</div>
              </div>
              <span className={`badge ${a.status === 'active' ? 'badge-green' : 'badge-blue'}`}>
                {a.status === 'active' ? 'Active' : 'Coming Soon'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

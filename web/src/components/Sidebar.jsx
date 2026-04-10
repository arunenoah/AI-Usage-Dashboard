import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'

// Inline SVGs — avoids sprite viewBox coordinate issues
function NavIcon({ name }) {
  const icons = {
    home: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    ),
    sessions: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    settings: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
    activity: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  }
  return icons[name] || null
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/sessions', label: 'Sessions', icon: 'sessions' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export default function Sidebar({ source = 'Claude Code' }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sb-collapsed') === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('sb-collapsed', String(collapsed)) } catch {}
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '68px' : '240px')
  }, [collapsed])

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      {/* Brand */}
      <div className="sb-header">
        <div className="sb-logo-icon">
          <NavIcon name="activity" />
        </div>
        <div className="sb-brand-wrap">
          <span className="sb-brand">ai-sessions</span>
          <span className="sb-brand-sub">Developer Analytics</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="sb-nav-section">
        <span className="sb-section-label">Navigation</span>
      </div>
      <nav className="sb-nav-wrap">
        <ul className="sb-nav">
          {navItems.map(({ to, label, icon }) => (
            <li key={to} className="sb-item">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => `sb-link${isActive ? ' sb-link--active' : ''}`}
              >
                <span className="sb-icon-box">
                  <NavIcon name={icon} />
                </span>
                <span className="sb-label">{label}</span>
              </NavLink>
              <div className="sb-tooltip">{label}</div>
            </li>
          ))}
        </ul>
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div className="sb-footer">
        <div className="sb-source">
          <span className="sb-source-dot" />
          <span className="sb-source-label">{source}</span>
        </div>
        <button
          className="sb-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed
              ? <polyline points="9 18 15 12 9 6" />
              : <polyline points="15 18 9 12 15 6" />
            }
          </svg>
        </button>
      </div>
    </aside>
  )
}

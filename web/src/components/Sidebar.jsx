import React from 'react'
import { NavLink } from 'react-router-dom'

function NavIcon({ name }) {
  const icons = {
    home: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    ),
    sessions: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    settings: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
    activity: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    tasks: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  }
  return icons[name] || null
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/sessions', label: 'Sessions', icon: 'sessions' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

const TRANSITION = '280ms cubic-bezier(0.4,0,0.2,1)'

export default function Sidebar({ collapsed, onToggle, source = 'Claude Code' }) {
  const sidebarW = collapsed ? 68 : 240

  return (
    <aside style={{
      position: 'fixed',
      inset: '0 auto 0 0',
      width: sidebarW,
      background: '#0d0f14',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      overflow: 'hidden',
      transition: `width ${TRANSITION}`,
    }}>

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 40% at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 70%),
          radial-gradient(ellipse 60% 60% at 0% 100%, rgba(139,92,246,0.07) 0%, transparent 60%)
        `,
      }} />

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, position: 'relative', overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Logo icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
          display: 'grid', placeItems: 'center', color: '#fff',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(37,99,235,0.35)',
        }}>
          <NavIcon name="activity" />
        </div>

        {/* Brand text — slides away on collapse */}
        <div style={{
          overflow: 'hidden',
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : 160,
          transition: `opacity ${TRANSITION}, max-width ${TRANSITION}`,
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', lineHeight: 1.2 }}>
            ai-sessions
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginTop: 2 }}>
            Developer Analytics
          </div>
        </div>
      </div>

      {/* ── SECTION LABEL ── */}
      <div style={{
        padding: '16px 18px 6px', flexShrink: 0,
        overflow: 'hidden',
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)',
          letterSpacing: '1.8px', textTransform: 'uppercase', whiteSpace: 'nowrap',
          display: 'block',
          opacity: collapsed ? 0 : 1,
          transition: `opacity ${TRANSITION}`,
        }}>Navigation</span>
      </div>

      {/* ── NAV ITEMS ── */}
      <nav style={{ flexShrink: 0, position: 'relative' }}>
        <ul style={{ listStyle: 'none', padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, label, icon }) => (
            <li key={to} style={{ position: 'relative' }}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => isActive ? 'sb-link sb-link--active' : 'sb-link'}
                title={collapsed ? label : undefined}
              >
                {/* Icon box */}
                <span style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  transition: 'background 0.16s',
                }} className="sb-icon-box">
                  <NavIcon name={icon} />
                </span>

                {/* Label — collapses out */}
                <span style={{
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  opacity: collapsed ? 0 : 1,
                  maxWidth: collapsed ? 0 : 140,
                  transition: `opacity ${TRANSITION}, max-width ${TRANSITION}`,
                  fontSize: 13,
                  fontWeight: 500,
                }}>
                  {label}
                </span>
              </NavLink>

              {/* Tooltip for collapsed mode */}
              {collapsed && (
                <span style={{
                  position: 'absolute',
                  left: 'calc(100% + 8px)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#1e2435',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 12, fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  opacity: 0,
                }} className="sb-tooltip-inner">
                  {label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── TOGGLE BUTTON — prominent, always visible ── */}
      <div style={{
        padding: '12px 8px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
        position: 'relative',
      }}>

        {/* Source badge — hidden when collapsed */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0,
          overflow: 'hidden',
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : 180,
          transition: `opacity ${TRANSITION}, max-width ${TRANSITION}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
            boxShadow: '0 0 0 3px rgba(34,197,94,0.15)',
          }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {source}
          </span>
        </div>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: 32, height: 32,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.6)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
            marginLeft: 'auto',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed
              ? <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>
              : <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>
            }
          </svg>
        </button>
      </div>
    </aside>
  )
}

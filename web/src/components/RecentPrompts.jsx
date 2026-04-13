import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useWebSocket } from '../hooks/useWebSocket.js'

const PERIODS = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: 'week' },
  { label: '30 Days', value: 'month' },
  { label: 'All', value: 'all' },
]

function fmtTok(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1e3).toFixed(1)}K`
  return `${n}`
}

function fmtMs(ms) {
  if (!ms) return null
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

function shortProject(p) {
  if (!p) return '—'
  return p.split('/').filter(Boolean).pop() || p
}

function shortModel(m) {
  if (!m) return ''
  return m.replace('claude-', '').replace(/-20\d{6}$/, '').replace('google/', '').replace('openai/', '')
}

function ctxColor(pct) {
  if (pct >= 80) return '#F44336'
  if (pct >= 50) return '#FB8C00'
  return '#4CAF50'
}

// Extract image paths from text like "[Image: source: /path/to/file.png]"
function extractImages(text) {
  const imgs = []
  const re = /\[Image(?:\s+#\d+)?[:\s]+source:\s*([^\]]+\.(?:png|jpg|jpeg|gif|webp))\]/gi
  let m
  while ((m = re.exec(text)) !== null) {
    imgs.push(m[1].trim())
  }
  return imgs
}

// Replace image markers with placeholder text for clean display
function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/\[Image(?:\s+#\d+)?[:\s]+source:\s*[^\]]+\]/gi, '[📷 image]')
    .replace(/\[Image #\d+\]/gi, '[📷 image]')
    .replace(/\[Pasted text[^\]]*\]/gi, '[📋 paste]')
    .trim()
}

const TOOL_COLOR = {
  Read: '#1A73E8', Bash: '#FB8C00', Edit: '#4CAF50', Grep: '#00BCD4',
  Glob: '#9C27B0', Write: '#FF7043', Agent: '#E91E63', Task: '#F44336',
}

// ────────── ExpandableText ──────────
const COLLAPSED_MAX = 280 // px before "Read more" appears

function ExpandableText({ text, style }) {
  const ref = useRef(null)
  const [overflow, setOverflow] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    setOverflow(ref.current.scrollHeight > COLLAPSED_MAX + 4)
  }, [text])

  return (
    <div>
      <div
        ref={ref}
        style={{
          ...style,
          maxHeight: expanded ? 'none' : COLLAPSED_MAX,
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        {text}
      </div>
      {overflow && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, color: '#1A73E8', padding: 0,
          }}
        >
          {expanded ? '▲ Show less' : '▼ Read more'}
        </button>
      )}
    </div>
  )
}

// ────────── ToolDetailList ──────────
function ToolDetailList({ details }) {
  // Group by tool preserving order of first occurrence
  const grouped = []
  const seen = {}
  for (const d of details) {
    if (!seen[d.tool]) {
      seen[d.tool] = { tool: d.tool, inputs: [] }
      grouped.push(seen[d.tool])
    }
    if (d.input) seen[d.tool].inputs.push(d.input)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grouped.map((g, i) => {
        const color = TOOL_COLOR[g.tool] || '#9baabf'
        return (
          <div key={i} style={{ borderRadius: 8, border: `1px solid ${color}22`, overflow: 'hidden' }}>
            {/* Tool header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: color + '12' }}>
              <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono', color }}>{g.tool}</span>
              <span style={{ fontSize: 10, color: '#9baabf', marginLeft: 'auto' }}>{g.inputs.length} call{g.inputs.length !== 1 ? 's' : ''}</span>
            </div>
            {/* Input list */}
            {g.inputs.length > 0 && (
              <div style={{ padding: '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: 4, background: '#fff' }}>
                {g.inputs.map((inp, j) => (
                  <div key={j} style={{
                    fontSize: 11, fontFamily: 'JetBrains Mono', color: '#344767',
                    background: '#f8f9fc', borderRadius: 4, padding: '3px 8px',
                    wordBreak: 'break-all', lineHeight: 1.5,
                  }}>
                    {inp}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ────────── ConversationPanel (right slide-over) ──────────
function ConversationPanel({ pair, onClose }) {
  const u = pair?.usage
  const images = extractImages(pair?.user_text || '')
  const assistImages = extractImages(pair?.assist_text || '')
  const tools = [...new Set(pair?.tool_calls || [])]

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 600, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div style={{
        width: 700, height: '100vh', background: '#fff',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#344767' }}>Conversation Detail</div>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: '#7b809a', marginTop: 4 }}>
              {shortProject(pair.project_dir)} · ⎇ {pair.git_branch || 'main'} · {shortModel(pair.model)} · {relTime(pair.timestamp)}
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 22, color: '#9baabf', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Token Summary Bar */}
        {u && (
          <div style={{ padding: '12px 24px', background: '#fafbfc', borderBottom: '1px solid #f0f2f5' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Token Usage — What you paid for this response
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                {
                  label: 'Your Prompt', sub: 'Fresh text you typed',
                  val: u.input_tokens, color: '#7986CB',
                  tip: 'Tiny — just your message words',
                },
                {
                  label: 'Claude Response', sub: 'Output tokens billed',
                  val: u.output_tokens, color: '#4CAF50',
                  tip: 'All text + thinking Claude wrote',
                },
                {
                  label: 'Context Loaded', sub: 'Conversation history',
                  val: u.cache_read_input_tokens, color: '#29B6F6',
                  tip: 'Cached history re-read — very cheap ($0.30/M)',
                },
                {
                  label: 'Context Saved', sub: 'New cache written',
                  val: u.cache_creation_input_tokens, color: '#FFB74D',
                  tip: 'Stored for next turn — moderate cost ($3.75/M)',
                },
              ].map(item => (
                <div key={item.label} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: `1px solid ${item.color}30` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#344767' }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono', color: item.color }}>{fmtTok(item.val)}</div>
                  <div style={{ fontSize: 9, color: '#9baabf', marginTop: 2 }}>{item.sub}</div>
                  <div style={{ fontSize: 9, color: '#9baabf', marginTop: 1, fontStyle: 'italic' }}>{item.tip}</div>
                </div>
              ))}
            </div>

            {/* Context window progress bar */}
            {pair.context_pct > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: '#7b809a' }}>Context window used <span style={{ color: '#9baabf' }}>(history / 200k limit)</span></span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: ctxColor(pair.context_pct) }}>{pair.context_pct}%</span>
                </div>
                <div style={{ height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pair.context_pct)}%`, background: ctxColor(pair.context_pct), borderRadius: 3 }} />
                </div>
                {pair.context_pct > 70 && (
                  <div style={{ fontSize: 10, color: '#F57F17', marginTop: 4 }}>
                    ⚠️ Context is {pair.context_pct >= 90 ? 'nearly full' : 'getting large'} — consider <code style={{ fontFamily: 'JetBrains Mono' }}>/clear</code> to start fresh and save cost
                  </div>
                )}
              </div>
            )}

            {/* Cost + duration */}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
              <span>💰 <strong style={{ color: '#4CAF50' }}>${pair.cost?.toFixed(5)}</strong> <span style={{ color: '#9baabf' }}>this response</span></span>
              {pair.duration_ms > 0 && <span>⏱ <strong style={{ color: '#344767' }}>{fmtMs(pair.duration_ms)}</strong> <span style={{ color: '#9baabf' }}>thinking time</span></span>}
            </div>
          </div>
        )}

        {/* Prompt Quality Score */}
        {pair.prompt_score > 0 && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f2f5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Score circle */}
              {(() => {
                const s = pair.prompt_score
                const color = s >= 9 ? '#22c55e' : s >= 7 ? '#1A73E8' : s >= 5 ? '#f59e0b' : '#ef4444'
                const label = s >= 9 ? 'Good' : s >= 7 ? 'Decent' : s >= 5 ? 'Needs Work' : 'Weak'
                const r = 20
                const circ = 2 * Math.PI * r
                const dash = (s / 10) * circ
                return (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <svg width={52} height={52} viewBox="0 0 52 52">
                      <circle cx={26} cy={26} r={r} fill="none" stroke="#f0f2f5" strokeWidth={4} />
                      <circle cx={26} cy={26} r={r} fill="none" stroke={color} strokeWidth={4}
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 26 26)" />
                      <text x={26} y={24} textAnchor="middle" style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 800, fill: color }}>{s}</text>
                      <text x={26} y={35} textAnchor="middle" style={{ fontFamily: 'Figtree', fontSize: 7, fontWeight: 600, fill: '#9baabf' }}>{label}</text>
                    </svg>
                  </div>
                )
              })()}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#344767', marginBottom: 4 }}>Prompt Quality</div>
                {(pair.prompt_tips || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {pair.prompt_tips.map((tip, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ color: '#f59e0b', fontSize: 10, marginTop: 1, flexShrink: 0 }}>→</span>
                        <span style={{ fontSize: 11, color: '#7b809a', lineHeight: 1.4 }}>{tip}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#22c55e' }}>This prompt follows best practices.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* User input */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: 5, background: '#EBF4FF', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: '#1A73E8' }}>U</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A73E8' }}>Your Input</span>
            </div>
            <div style={{ background: '#F8FBFF', borderRadius: 10, border: '1px solid #DDEEFF', padding: '14px 16px' }}>
              {/* Images from user message */}
              {images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {images.map((src, i) => (
                    <img key={i} src={`/api/image?path=${encodeURIComponent(src)}`}
                      alt={`screenshot ${i + 1}`}
                      style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6, border: '1px solid #ddd', objectFit: 'contain' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ))}
                </div>
              )}
              {cleanText(pair.user_text)
                ? <ExpandableText
                    text={cleanText(pair.user_text)}
                    style={{ fontSize: 13, color: '#344767', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  />
                : <em style={{ color: '#9baabf', fontSize: 13 }}>(no text)</em>
              }
            </div>
          </div>

          {/* Claude response */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: 5, background: '#F3E8FF', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: '#7B1FA2' }}>A</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#7B1FA2' }}>Claude Response</span>
              {pair.model && <span style={{ fontSize: 10, color: '#9baabf', background: '#f0f2f5', padding: '2px 6px', borderRadius: 4 }}>{shortModel(pair.model)}</span>}
              {u && <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: '#7b809a' }}>{fmtTok(u.output_tokens)} tokens</span>}
            </div>
            <div style={{ background: '#fafbfc', borderRadius: 10, border: '1px solid #f0f2f5', padding: '14px 16px' }}>
              {assistImages.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {assistImages.map((src, i) => (
                    <img key={i} src={`/api/image?path=${encodeURIComponent(src)}`} alt="" style={{ maxHeight: 200, borderRadius: 6 }} onError={e => { e.target.style.display = 'none' }} />
                  ))}
                </div>
              )}
              {pair.assist_text ? (
                <ExpandableText
                  text={cleanText(pair.assist_text)}
                  style={{ fontSize: 13, color: '#344767', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                />
              ) : (
                <div style={{ color: '#9baabf', fontSize: 12, fontStyle: 'italic' }}>
                  Claude worked silently using tools — no text response in this turn
                </div>
              )}
            </div>
          </div>

          {/* Tools used */}
          {(pair.tool_details?.length > 0 || tools.length > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                Tools Used ({pair.tool_calls?.length} calls)
              </div>
              {pair.tool_details?.length > 0 ? (
                <ToolDetailList details={pair.tool_details} />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tools.map((t, i) => {
                    const cnt = (pair.tool_calls || []).filter(x => x === t).length
                    return (
                      <span key={i} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: (TOOL_COLOR[t] || '#9baabf') + '18',
                        color: TOOL_COLOR[t] || '#9baabf',
                        fontFamily: 'JetBrains Mono',
                      }}>{t}{cnt > 1 ? ` ×${cnt}` : ''}</span>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────── Main RecentPrompts Component ──────────
const PAGE_SIZE = 20

const SCORE_FILTERS = [
  { label: 'All', min: 0, max: 10 },
  { label: 'Weak (1-4)', min: 1, max: 4, color: '#ef4444' },
  { label: 'Needs Work (5-6)', min: 5, max: 6, color: '#f59e0b' },
  { label: 'Decent (7-8)', min: 7, max: 8, color: '#1A73E8' },
  { label: 'Good (9-10)', min: 9, max: 10, color: '#22c55e' },
]

export default function RecentPrompts({ onSessionClick }) {
  const [pairs, setPairs] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [period, setPeriod] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)
  const [scoreFilter, setScoreFilter] = useState(SCORE_FILTERS[0])

  const fetchConversations = useCallback(() => {
    setLoading(true)
    let url = `/api/conversations?period=${period}&limit=${PAGE_SIZE}&page=${page}`
    if (scoreFilter.min > 0 || scoreFilter.max < 10) {
      url += `&score_min=${scoreFilter.min}&score_max=${scoreFilter.max}`
    }
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setPairs(d.pairs || [])
        setTotal(d.total || 0)
        setTotalPages(d.total_pages || 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [period, page, scoreFilter])

  useEffect(() => {
    setSelected(null)
    fetchConversations()
  }, [fetchConversations])

  useWebSocket((msg) => {
    if (msg.type === 'session_updated') fetchConversations()
  })

  const paged = pairs

  return (
    <>
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>Conversations</div>
            <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
              Your prompts + Claude responses with token breakdown · {total} conversations
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3, background: '#f0f2f5', borderRadius: 20, padding: '3px' }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => { setPeriod(p.value); setPage(1) }} style={{
                padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700,
                background: period === p.value ? '#1A73E8' : 'transparent',
                color: period === p.value ? '#fff' : '#7b809a',
                transition: 'all 0.15s',
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Score filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.5 }}>Score:</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SCORE_FILTERS.map(sf => {
              const isActive = scoreFilter.label === sf.label
              const btnColor = sf.color || '#344767'
              return (
                <button key={sf.label} onClick={() => { setScoreFilter(sf); setPage(1) }} style={{
                  padding: '3px 10px', borderRadius: 14, border: `1px solid ${isActive ? btnColor : '#e8eaf0'}`,
                  cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  background: isActive ? btnColor + '15' : '#fff',
                  color: isActive ? btnColor : '#7b809a',
                  transition: 'all 0.15s',
                }}>{sf.label}</button>
              )
            })}
          </div>
        </div>

        <div style={{ height: 1, background: '#f0f2f5', margin: '0 -24px 16px' }} />

        {loading && (
          <div style={{ color: '#9baabf', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>
            Loading conversations…
          </div>
        )}

        {!loading && pairs.length === 0 && (
          <div style={{ color: '#9baabf', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>
            No conversations found for this period
          </div>
        )}

        {/* Table header */}
        {!loading && paged.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 80px 80px 80px 60px', gap: 12, padding: '4px 12px', marginBottom: 4 }}>
            {['Prompt / Response', 'Score', 'Output', 'Context', 'Cost', 'Time'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>
        )}

        {/* Conversation rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {paged.map((pair, i) => {
            const u = pair.usage
            const images = extractImages(pair.user_text || '')
            const cleanPrompt = cleanText(pair.user_text)
            const cleanResponse = cleanText(pair.assist_text)
            const tools = [...new Set(pair.tool_calls || [])]
            const displayText = cleanPrompt || (images.length > 0 ? `📷 ${images.length} image${images.length > 1 ? 's' : ''}` : '—')

            return (
              <div
                key={i}
                onClick={() => setSelected(pair)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 50px 80px 80px 80px 60px',
                  gap: 12, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid transparent', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fafbfc'; e.currentTarget.style.borderColor = '#f0f2f5' }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = 'transparent' }}
              >
                {/* Prompt + response preview */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, background: '#EBF4FF', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800, color: '#1A73E8', flexShrink: 0 }}>U</span>
                    <div style={{ fontSize: 12, color: '#344767', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayText}
                    </div>
                  </div>
                  {cleanResponse && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 3, background: '#F3E8FF', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800, color: '#7B1FA2', flexShrink: 0 }}>A</span>
                      <div style={{ fontSize: 11, color: '#7b809a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cleanResponse}
                      </div>
                    </div>
                  )}
                  {/* Tool chips */}
                  {tools.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                      {tools.slice(0, 5).map((t, j) => {
                        const cnt = (pair.tool_calls || []).filter(x => x === t).length
                        return (
                          <span key={j} style={{
                            padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                            background: (TOOL_COLOR[t] || '#9baabf') + '18',
                            color: TOOL_COLOR[t] || '#9baabf',
                            fontFamily: 'JetBrains Mono',
                          }}>{t}{cnt > 1 ? ` ×${cnt}` : ''}</span>
                        )
                      })}
                      {tools.length > 5 && <span style={{ fontSize: 9, color: '#9baabf' }}>+{tools.length - 5}</span>}
                    </div>
                  )}
                  {/* Meta */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 9, color: '#9baabf', background: '#f0f2f5', padding: '1px 5px', borderRadius: 3, fontFamily: 'JetBrains Mono' }}>
                      {shortProject(pair.project_dir)}
                    </span>
                    {pair.git_branch && <span style={{ fontSize: 9, color: '#9baabf' }}>⎇ {pair.git_branch}</span>}
                  </div>
                </div>

                {/* Prompt Score */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pair.prompt_score > 0 ? (() => {
                    const s = pair.prompt_score
                    const color = s >= 9 ? '#22c55e' : s >= 7 ? '#1A73E8' : s >= 5 ? '#f59e0b' : '#ef4444'
                    return (
                      <span style={{
                        fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono',
                        color, background: color + '15', borderRadius: 6,
                        padding: '2px 8px', minWidth: 28, textAlign: 'center',
                      }}>{s}</span>
                    )
                  })() : <span style={{ color: '#c4cdd6', fontSize: 11 }}>—</span>}
                </div>

                {/* Output tokens */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#4CAF50' }}>
                    {u ? fmtTok(u.output_tokens) : '—'}
                  </div>
                  {u?.input_tokens > 0 && <div style={{ fontSize: 9, color: '#9baabf' }}>in: {fmtTok(u.input_tokens)}</div>}
                </div>

                {/* Context % */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                  {pair.context_pct > 0 ? (
                    <>
                      <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 700, color: ctxColor(pair.context_pct) }}>
                        {pair.context_pct}%
                      </div>
                      <div style={{ height: 3, background: '#f0f2f5', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pair.context_pct)}%`, background: ctxColor(pair.context_pct), borderRadius: 2 }} />
                      </div>
                    </>
                  ) : <span style={{ color: '#9baabf', fontSize: 11 }}>—</span>}
                </div>

                {/* Cost */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: pair.cost > 0 ? '#344767' : '#9baabf' }}>
                    {pair.cost > 0 ? `$${pair.cost.toFixed(4)}` : '—'}
                  </span>
                </div>

                {/* Time */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, color: '#9baabf' }}>{relTime(pair.timestamp)}</span>
                  {pair.duration_ms > 0 && <span style={{ fontSize: 9, color: '#9baabf' }}>⏱{fmtMs(pair.duration_ms)}</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '4px 12px', border: '1px solid #f0f2f5', borderRadius: 6, background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#9baabf' : '#344767', fontSize: 12 }}>
              ‹ Prev
            </button>
            <span style={{ fontSize: 12, color: '#7b809a' }}>Page {page} of {totalPages} · {total} total</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '4px 12px', border: '1px solid #f0f2f5', borderRadius: 6, background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#9baabf' : '#344767', fontSize: 12 }}>
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* Right panel */}
      {selected && (
        <ConversationPanel
          pair={selected}
          onClose={() => setSelected(null)}
          onSessionClick={onSessionClick}
        />
      )}
    </>
  )
}

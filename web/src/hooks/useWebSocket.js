import { useEffect, useRef, useState } from 'react'

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname === 'localhost' ? 'localhost:8765' : window.location.host
    const url = `${protocol}//${host}/ws`

    function connect() {
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, 3000)
      }
      ws.onmessage = (e) => {
        try { onMessage?.(JSON.parse(e.data)) } catch (_) {}
      }
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  return { connected }
}

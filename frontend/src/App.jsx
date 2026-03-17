import React, { useState, useRef, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ChatArea from './components/ChatArea.jsx'
import './App.css'

const SUGGESTED_QUERIES = [
  "Show me the top 5 products by revenue",
  "Draw the ER diagram for this database",
  "What are sales trends by month in 2024?",
  "Show customer distribution by city as a pie chart",
  "Create a flowchart of the order process",
  "Which product category has the most orders?",
]

export default function App() {
  const [sessions, setSessions] = useState([
    { id: 'default', title: 'New Conversation', messages: [], createdAt: new Date() }
  ])
  const [activeSessionId, setActiveSessionId] = useState('default')
  const [isLoading, setIsLoading] = useState(false)

  // ── Rate limit state ──
  const [rateLimited, setRateLimited] = useState(false)
  const [countdown, setCountdown] = useState('')
  const countdownIntervalRef = useRef(null)

  const activeSession = sessions.find(s => s.id === activeSessionId)

  const updateSession = (id, updater) => {
    setSessions(prev => prev.map(s => s.id === id ? updater(s) : s))
  }

  const newSession = () => {
    const id = Date.now().toString()
    setSessions(prev => [...prev, { id, title: 'New Conversation', messages: [], createdAt: new Date() }])
    setActiveSessionId(id)
  }

  const deleteSession = (id) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id)
      if (filtered.length === 0) {
        const newId = Date.now().toString()
        return [{ id: newId, title: 'New Conversation', messages: [], createdAt: new Date() }]
      }
      return filtered
    })
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id)
      setActiveSessionId(remaining[0]?.id || 'default')
    }
  }

  // ── Start polling /rate-limit-status every second ──
  const startCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    countdownIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/rate-limit-status`)
        const data = await res.json()

        if (!data.is_limited || data.remaining_seconds <= 0) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
          setRateLimited(false)
          setCountdown('')
        } else {
          const m = Math.floor(data.remaining_seconds / 60)
          const s = Math.floor(data.remaining_seconds % 60)
          setCountdown(m > 0 ? `${m}m ${s}s` : `${s}s`)
        }
      } catch {
        // If polling fails, don't crash — just keep trying
      }
    }, 1000)
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [])

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading || rateLimited) return

    const userMsg = { id: Date.now(), role: 'user', content: text, timestamp: new Date() }

    updateSession(activeSessionId, s => ({
      ...s,
      title: s.messages.length === 0 ? text.slice(0, 40) + (text.length > 40 ? '…' : '') : s.title,
      messages: [...s.messages, userMsg]
    }))

    setIsLoading(true)

    const assistantMsgId = Date.now() + 1
    const assistantMsg = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      artifacts: [],
      toolCalls: [],
      timestamp: new Date(),
      streaming: true
    }

    updateSession(activeSessionId, s => ({ ...s, messages: [...s.messages, assistantMsg] }))

    try {
      const history = activeSession.messages.map(m => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: text })

      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, stream: true })
      })

      // ── Handle 429 from pre-request guard ──
      if (res.status === 429) {
        const err = await res.json()
        const detail = err.detail || {}
        const remaining = detail.remaining_seconds || 60

        const m = Math.floor(remaining / 60)
        const s = Math.floor(remaining % 60)
        const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`

        updateSession(activeSessionId, s => ({
          ...s,
          messages: s.messages.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: `⚠️ Rate limit active. You can prompt again in **${timeStr}**.`, streaming: false, isRateLimit: true }
              : m
          )
        }))

        setRateLimited(true)
        setCountdown(timeStr)
        startCountdown()
        return
      }

      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            handleStreamEvent(event, assistantMsgId)

            // ── Handle rate_limit event mid-stream ──
            if (event.type === 'rate_limit') {
              const remaining = event.wait_seconds || 60
              const m = Math.floor(remaining / 60)
              const s = Math.floor(remaining % 60)
              const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`
              setRateLimited(true)
              setCountdown(timeStr)
              startCountdown()
            }
          } catch {}
        }
      }
    } catch (err) {
      updateSession(activeSessionId, s => ({
        ...s,
        messages: s.messages.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `Error: ${err.message}`, streaming: false }
            : m
        )
      }))
    } finally {
      setIsLoading(false)
      updateSession(activeSessionId, s => ({
        ...s,
        messages: s.messages.map(m =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        )
      }))
    }
  }

  const handleStreamEvent = (event, msgId) => {
    updateSession(activeSessionId, s => ({
      ...s,
      messages: s.messages.map(m => {
        if (m.id !== msgId) return m
        if (event.type === 'text') {
          return { ...m, content: m.content + (m.content ? '\n\n' : '') + event.content }
        }
        if (event.type === 'rate_limit') {
          return {
            ...m,
            content: event.message,
            isRateLimit: true,
            waitSeconds: event.wait_seconds,
            retryAfterTs: event.retry_after_ts,
          }
        }
        if (event.type === 'tool_result') {
          const result = event.result
          if (result?.type === 'chart' || result?.type === 'diagram') {
            return { ...m, artifacts: [...(m.artifacts || []), result] }
          }
          if (result?.columns && result?.rows) {
            return { ...m, artifacts: [...(m.artifacts || []), { type: 'table', ...result }] }
          }
          if (result?.schema) {
            return { ...m, artifacts: [...(m.artifacts || []), { type: 'schema', ...result }] }
          }
        }
        if (event.type === 'tool_call') {
          return { ...m, toolCalls: [...(m.toolCalls || []), { tool: event.tool, inputs: event.inputs }] }
        }
        return m
      })
    }))
  }

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onNew={newSession}
        onDelete={deleteSession}
      />
      <ChatArea
        session={activeSession}
        isLoading={isLoading}
        onSend={sendMessage}
        suggestions={SUGGESTED_QUERIES}
        rateLimited={rateLimited}
        countdown={countdown}
      />
    </div>
  )
}

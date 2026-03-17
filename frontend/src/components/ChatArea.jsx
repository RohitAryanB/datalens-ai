import React, { useRef, useEffect } from 'react'
import Message from './Message.jsx'
import ChatInput from './ChatInput.jsx'
import { Database, BarChart2, GitMerge, Zap } from 'lucide-react'
import './ChatArea.css'

export default function ChatArea({ session, isLoading, onSend, suggestions, rateLimited, countdown }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages])

  const isEmpty = !session?.messages?.length

  return (
    <main className="chat-area">
      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-hero">
            <div className="empty-icon-ring">
              <Zap size={28} />
            </div>
            <h1 className="empty-title">DataLens AI</h1>
            <p className="empty-sub">
              Your intelligent database analyst. Ask anything about your data.
            </p>
          </div>

          <div className="capability-grid">
            <div className="capability-card">
              <Database size={18} />
              <span>Query any table in plain English</span>
            </div>
            <div className="capability-card">
              <BarChart2 size={18} />
              <span>Auto-generate charts & visualizations</span>
            </div>
            <div className="capability-card">
              <GitMerge size={18} />
              <span>Draw ER diagrams & flowcharts</span>
            </div>
          </div>

          <div className="suggestions">
            <p className="suggestions-label">Try asking:</p>
            <div className="suggestion-chips">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => onSend(s)}
                  disabled={rateLimited}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="messages-container">
          {session.messages.map(msg => (
            <Message key={msg.id} message={msg} />
          ))}
          {isLoading && session.messages[session.messages.length - 1]?.streaming === false && (
            <div className="thinking-indicator">
              <span /><span /><span />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <ChatInput
        onSend={onSend}
        isLoading={isLoading}
        rateLimited={rateLimited}
        countdown={countdown}
      />
    </main>
  )
}

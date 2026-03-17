import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader } from 'lucide-react'
import './ChatInput.css'

export default function ChatInput({ onSend, isLoading }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'
  }, [value])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="chat-input-bar">
      <div className={`input-container ${isLoading ? 'loading' : ''}`}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask anything about your data... (Enter to send, Shift+Enter for newline)"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
        />
        <button
          className={`send-btn ${isLoading ? 'sending' : ''} ${value.trim() ? 'active' : ''}`}
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          title="Send message"
        >
          {isLoading ? <Loader size={16} className="spin" /> : <Send size={16} />}
        </button>
      </div>
      <p className="input-hint">DataLens AI may make mistakes. Verify important data.</p>
    </div>
  )
}

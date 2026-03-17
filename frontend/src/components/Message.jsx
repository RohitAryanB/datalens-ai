import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Zap, ChevronDown, ChevronUp, Terminal, Copy, Check } from 'lucide-react'
import ChartRenderer from './ChartRenderer.jsx'
import DiagramRenderer from './DiagramRenderer.jsx'
import TableRenderer from './TableRenderer.jsx'
import SchemaRenderer from './SchemaRenderer.jsx'

import './Message.css'

export default function Message({ message }) {
  const isUser = message.role === 'user'
  const [showTools, setShowTools] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyContent = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderArtifact = (artifact, i) => {
    if (artifact.type === 'chart') return <ChartRenderer key={i} config={artifact} />
    if (artifact.type === 'diagram') return <DiagramRenderer key={i} config={artifact} />
    if (artifact.type === 'table') return <TableRenderer key={i} data={artifact} />
    if (artifact.type === 'schema') return <SchemaRenderer key={i} data={artifact} />
    return null
  }

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        {isUser ? <User size={14} /> : <Zap size={14} />}
      </div>

      <div className="message-body">
        {isUser ? (
          <div className="user-bubble">{message.content}</div>
        ) : (
          <div className="assistant-bubble">
            {/* Tool calls indicator */}
            {message.toolCalls?.length > 0 && (
              <div className="tool-calls-section">
                <button className="tool-calls-toggle" onClick={() => setShowTools(!showTools)}>
                  <Terminal size={11} />
                  <span>{message.toolCalls.length} tool{message.toolCalls.length > 1 ? 's' : ''} used</span>
                  {showTools ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {showTools && (
                  <div className="tool-calls-list">
                    {message.toolCalls.map((tc, i) => (
                      <div key={i} className="tool-call-item">
                        <span className="tool-name">{tc.tool}</span>
                        {tc.inputs?.sql && (
                          <code className="tool-sql">{tc.inputs.sql}</code>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Main text */}
            {message.content && (
              <div className="message-text">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      if (inline) return <code className="inline-code" {...props}>{children}</code>
                      return (
                        <div className="code-block">
                          <pre><code {...props}>{children}</code></pre>
                        </div>
                      )
                    },
                    table({ children }) {
                      return <div className="md-table-wrap"><table>{children}</table></div>
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Streaming cursor */}
            {message.streaming && <span className="streaming-cursor" />}

            {/* Artifacts */}
            {message.artifacts?.length > 0 && (
              <div className="artifacts-list">
                {message.artifacts.map((a, i) => renderArtifact(a, i))}
              </div>
            )}

            {/* Copy button */}
            {!message.streaming && message.content && (
              <button className="copy-btn" onClick={copyContent}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
        )}
        <div className="message-time">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

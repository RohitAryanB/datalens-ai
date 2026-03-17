import React, { useState } from 'react'
import { Plus, MessageSquare, Trash2, Database, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import './Sidebar.css'

export default function Sidebar({ sessions, activeSessionId, onSelect, onNew, onDelete }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="brand">
            <div className="brand-icon"><Zap size={14} /></div>
            <span className="brand-name">DataLens AI</span>
          </div>
        )}
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <button className="new-chat-btn" onClick={onNew} title="New conversation">
        <Plus size={14} />
        {!collapsed && <span>New Chat</span>}
      </button>

      {!collapsed && (
        <>
          <div className="sidebar-section-label">Conversations</div>
          <div className="session-list">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`session-item ${s.id === activeSessionId ? 'active' : ''}`}
                onClick={() => onSelect(s.id)}
              >
                <MessageSquare size={13} className="session-icon" />
                <span className="session-title">{s.title}</span>
                <button
                  className="session-delete"
                  onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <div className="db-badge">
              <Database size={12} />
              <span>ecommerce.db</span>
              <span className="db-dot" />
            </div>
          </div>
        </>
      )}
    </aside>
  )
}

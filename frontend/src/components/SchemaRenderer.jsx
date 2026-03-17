import React, { useState } from 'react'
import { Database, Key, Link, ChevronDown, ChevronRight, Hash } from 'lucide-react'
import './SchemaRenderer.css'

export default function SchemaRenderer({ data }) {
  const { schema, tables, table_count } = data
  const [expanded, setExpanded] = useState({})

  const toggle = (t) => setExpanded(prev => ({ ...prev, [t]: !prev[t] }))

  const typeColor = (type) => {
    const t = type?.toLowerCase() || ''
    if (t.includes('int') || t.includes('real') || t.includes('float') || t.includes('numeric')) return 'num'
    if (t.includes('text') || t.includes('char') || t.includes('varchar')) return 'str'
    if (t.includes('date') || t.includes('time')) return 'date'
    return 'other'
  }

  return (
    <div className="schema-card">
      <div className="schema-header">
        <Database size={13} />
        <span>{table_count} tables in database</span>
      </div>
      <div className="schema-tables">
        {tables?.map(tableName => {
          const tbl = schema[tableName]
          const isOpen = expanded[tableName]
          return (
            <div key={tableName} className="schema-table">
              <button className="schema-table-toggle" onClick={() => toggle(tableName)}>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="schema-table-name">{tableName}</span>
                <span className="schema-table-rows">{tbl.row_count.toLocaleString()} rows</span>
                {tbl.foreign_keys?.length > 0 && (
                  <span className="schema-fk-count">
                    <Link size={10} /> {tbl.foreign_keys.length} FK
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="schema-columns">
                  {tbl.columns.map(col => (
                    <div key={col.name} className={`schema-column ${col.pk ? 'is-pk' : ''}`}>
                      <div className="col-name">
                        {col.pk ? <Key size={10} className="pk-icon" /> : <Hash size={10} className="col-icon" />}
                        <span>{col.name}</span>
                      </div>
                      <span className={`col-type ${typeColor(col.type)}`}>{col.type || 'TEXT'}</span>
                      {col.notnull && <span className="col-notnull">NOT NULL</span>}
                    </div>
                  ))}
                  {tbl.foreign_keys?.map((fk, i) => (
                    <div key={i} className="schema-fk">
                      <Link size={10} />
                      <span>{fk.from}</span>
                      <span className="fk-arrow">→</span>
                      <span>{fk.to_table}.{fk.to_col}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

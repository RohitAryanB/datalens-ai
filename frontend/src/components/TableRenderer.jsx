import React, { useState } from 'react'
import { Table, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import './TableRenderer.css'

const PAGE_SIZE = 15

export default function TableRenderer({ data }) {
  const { columns, rows, row_count, sql } = data
  const [page, setPage] = useState(0)
  const [showSQL, setShowSQL] = useState(false)

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const exportCSV = () => {
    const header = columns.join(',')
    const body = rows.map(r => columns.map(c => {
      const v = r[c]
      if (v === null || v === undefined) return ''
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) return `"${v.replace(/"/g, '""')}"`
      return v
    }).join(',')).join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'query_result.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (!columns?.length) return null

  return (
    <div className="table-card">
      <div className="table-header">
        <div className="table-meta">
          <Table size={13} />
          <span className="table-row-count">{row_count} rows</span>
          <span className="table-col-count">{columns.length} columns</span>
        </div>
        <div className="table-actions">
          {sql && (
            <button className="table-action-btn" onClick={() => setShowSQL(!showSQL)}>
              {showSQL ? 'Hide SQL' : 'Show SQL'}
            </button>
          )}
          <button className="table-action-btn export" onClick={exportCSV}>
            <Download size={11} /> CSV
          </button>
        </div>
      </div>

      {showSQL && sql && (
        <div className="table-sql">
          <code>{sql}</code>
        </div>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col}>
                    {row[col] === null || row[col] === undefined
                      ? <span className="null-val">NULL</span>
                      : String(row[col])
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="table-pagination">
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft size={13} />
          </button>
          <span className="page-info">
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

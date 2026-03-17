import React, { useEffect, useRef, useState } from 'react'
import { GitMerge, AlertCircle } from 'lucide-react'
import './DiagramRenderer.css'

let mermaidLoaded = false

async function loadMermaid() {
  if (mermaidLoaded) return
  const m = await import('mermaid')
  m.default.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      background: '#1a1f2e',
      primaryColor: '#7c6aff',
      primaryTextColor: '#e8ecf4',
      primaryBorderColor: '#252d3d',
      lineColor: '#8892a4',
      secondaryColor: '#141820',
      tertiaryColor: '#0e1117',
      edgeLabelBackground: '#141820',
      fontFamily: 'Space Mono, monospace',
      fontSize: '13px',
    },
    er: {
      diagramPadding: 20,
      layoutDirection: 'TB',
    },
    flowchart: {
      curve: 'basis',
      padding: 20,
    }
  })
  mermaidLoaded = true
}

export default function DiagramRenderer({ config }) {
  const { diagram_type, mermaid: code, title } = config
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [svg, setSvg] = useState(null)

  useEffect(() => {
    if (!code) return
    let cancelled = false

    async function render() {
      try {
        await loadMermaid()
        const mermaid = (await import('mermaid')).default
        const id = 'diagram-' + Math.random().toString(36).slice(2)
        const { svg } = await mermaid.render(id, code)
        if (!cancelled) setSvg(svg)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to render diagram')
      }
    }

    render()
    return () => { cancelled = true }
  }, [code])

  return (
    <div className="diagram-card">
      <div className="diagram-header">
        <span className="diagram-title">
          <GitMerge size={13} />
          {title}
        </span>
        <span className="diagram-type-badge">{diagram_type}</span>
      </div>

      <div className="diagram-body">
        {error ? (
          <div className="diagram-error">
            <AlertCircle size={16} />
            <div>
              <p>Failed to render diagram</p>
              <pre>{error}</pre>
              <details>
                <summary>Mermaid source</summary>
                <pre className="mermaid-source">{code}</pre>
              </details>
            </div>
          </div>
        ) : svg ? (
          <div
            className="diagram-svg-wrap"
            ref={containerRef}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="diagram-loading">
            <span className="diagram-spinner" />
            <span>Rendering diagram…</span>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

// Strip ANSI escape codes for clean display
const stripAnsi = (str) =>
  str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '').replace(/\r/g, '')

export default function Installing({ config, onDone }) {
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState('running') // running | success | error
  const logEndRef = useRef(null)

  useEffect(() => {
    window.electronAPI?.removeAllListeners()

    window.electronAPI?.onLog((msg) => {
      const clean = stripAnsi(msg)
      if (clean.trim()) {
        setLogs((prev) => [...prev, clean])
      }
    })

    window.electronAPI?.onDone(({ success }) => {
      setStatus(success ? 'success' : 'error')
      setTimeout(() => onDone(success), success ? 1500 : 0)
    })

    window.electronAPI?.runInstall({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
    })

    return () => window.electronAPI?.removeAllListeners()
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="step">
      <div className="install-top">
        <h2 className="step-title">Installing OctoClaw</h2>
        <StatusPill status={status} />
      </div>

      <div className="log-box">
        {logs.length === 0 && (
          <span className="log-placeholder">Starting installer…</span>
        )}
        {logs.map((line, i) => (
          <div key={i} className={`log-line ${getLineClass(line)}`}>
            {line}
          </div>
        ))}
        {status === 'running' && (
          <div className="log-cursor">▌</div>
        )}
        <div ref={logEndRef} />
      </div>

      {status === 'error' && (
        <button className="btn-back" onClick={() => onDone(false)}>
          ← Go Back &amp; Retry
        </button>
      )}
    </div>
  )
}

function StatusPill({ status }) {
  if (status === 'running') {
    return (
      <span className="status-pill running">
        <span className="dot pulse" />
        Installing…
      </span>
    )
  }
  if (status === 'success') {
    return (
      <span className="status-pill success">
        ✓ Done
      </span>
    )
  }
  return (
    <span className="status-pill error">
      ✕ Failed
    </span>
  )
}

function getLineClass(line) {
  if (line.includes('[ERR') || line.includes('error') || line.includes('Error')) return 'log-error'
  if (line.includes('[ OK ]') || line.includes('✅') || line.includes('Done')) return 'log-success'
  if (line.includes('[WARN]') || line.includes('warning')) return 'log-warn'
  if (line.includes('[INFO]') || line.includes('──')) return 'log-info'
  return ''
}

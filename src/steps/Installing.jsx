import { useEffect, useRef, useState } from 'react'

const stripAnsi = (str) =>
  str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '').replace(/\r/g, '')

// Each entry: log substring to match → { pct, label }
const STEP_MAP = [
  { match: 'Starting OpenClaw installer',        pct:  5, label: 'Starting installer…' },
  { match: 'Checking OpenClaw installation',     pct: 10, label: 'Checking CLI…' },
  { match: 'Already installed',                  pct: 20, label: 'CLI found, skipping…' },
  { match: 'Not found. Installing',              pct: 11, label: 'CLI not found — installing…' },
  { match: 'Trying official installer',          pct: 12, label: 'Trying official installer…' },
  // Node.js bootstrap phase (only runs when Node is missing or too old)
  { match: 'Setting up Node.js automatically',   pct: 13, label: 'Setting up Node.js…' },
  { match: 'Downloading nvm',                    pct: 14, label: 'Downloading nvm…' },
  { match: 'Installing Node.js v22',             pct: 16, label: 'Installing Node.js…' },
  { match: 'Installing Node.js via Homebrew',    pct: 16, label: 'Installing Node.js…' },
  { match: 'Node.js ready',                      pct: 19, label: 'Node.js ready…' },
  { match: 'Installing openclaw via npm',        pct: 21, label: 'Installing CLI via npm…' },
  { match: 'Ensuring openclaw is on PATH',       pct: 25, label: 'Configuring PATH…' },
  { match: 'Setting up directories',             pct: 33, label: 'Setting up directories…' },
  { match: 'Saving API key',                     pct: 44, label: 'Saving API key…' },
  { match: 'Generating gateway auth token',      pct: 55, label: 'Generating auth token…' },
  { match: 'Writing config to',                  pct: 62, label: 'Writing config…' },
  { match: 'Installing gateway daemon',          pct: 70, label: 'Installing gateway…' },
  { match: 'Writing auth profile',               pct: 80, label: 'Writing auth profile…' },
  { match: 'Starting gateway',                   pct: 88, label: 'Starting gateway…' },
  { match: 'Verifying',                          pct: 95, label: 'Verifying setup…' },
  { match: 'OpenClaw is live',                   pct: 100, label: 'Almost done…' },
]

export default function Installing({ config, onDone }) {
  const [status, setStatus]   = useState('running') // running | success | error
  const [pct, setPct]         = useState(0)
  const [label, setLabel]     = useState('Preparing…')
  const [errorMsg, setErrorMsg] = useState('')
  // Smoothly animate percentage to target
  const targetPct = useRef(0)
  const animRef   = useRef(null)

  // Smooth counter: ticks toward targetPct
  const tick = () => {
    setPct((cur) => {
      if (cur >= targetPct.current) return cur
      const next = Math.min(cur + 1, targetPct.current)
      if (next < targetPct.current) animRef.current = requestAnimationFrame(tick)
      return next
    })
  }

  const advanceTo = (newPct, newLabel) => {
    if (newPct <= targetPct.current) return
    targetPct.current = newPct
    setLabel(newLabel)
    cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    window.electronAPI?.removeAllListeners()

    window.electronAPI?.onLog((msg) => {
      const clean = stripAnsi(msg).trim()
      if (!clean) return

      for (const step of STEP_MAP) {
        if (clean.includes(step.match)) {
          advanceTo(step.pct, step.label)
          break
        }
      }

      if (clean.startsWith('[ERR') || clean.startsWith('[stderr]')) {
        // Skip known non-fatal noise lines
        if (clean.includes('complete log of this run can be found')) return
        if (clean.includes('non-interactive mode')) return
        if (clean.includes('not a TTY')) return
        if (clean.includes('Warning:') || clean.includes('warning:')) return
        if (clean.includes('npm warn') || clean.includes('npm WARN')) return
        // Keep the FIRST meaningful error — later lines are usually less specific
        setErrorMsg((prev) => prev || clean)
      }
    })

    window.electronAPI?.onDone(({ success }) => {
      cancelAnimationFrame(animRef.current)
      if (success) {
        targetPct.current = 100
        setPct(100)
        setLabel('Done!')
        setStatus('success')
        setTimeout(() => onDone(true), 1400)
      } else {
        setStatus('error')
      }
    })

    window.electronAPI?.runInstall({
      provider: config.provider,
      model:    config.model,
      apiKey:   config.apiKey,
    })

    return () => {
      cancelAnimationFrame(animRef.current)
      window.electronAPI?.removeAllListeners()
    }
  }, [])

  // Circumference of the progress ring (r=28)
  const R   = 28
  const CIRC = 2 * Math.PI * R
  const dash = CIRC * (pct / 100)

  return (
    <div className="inst-step">
      <div className="inst-body">

        {status === 'running' && (
          <>
            {/* Spinner with percentage overlay */}
            <div className="inst-spinner">
              {/* Background track ring */}
              <svg className="inst-svg" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r={R} className="inst-track" />
                <circle
                  cx="36" cy="36" r={R}
                  className="inst-progress-arc"
                  strokeDasharray={`${dash} ${CIRC}`}
                  strokeDashoffset="0"
                  transform="rotate(-90 36 36)"
                />
              </svg>
              {/* Spinning ring overlay */}
              <div className="inst-ring" />
              {/* Percentage text in center */}
              <span className="inst-pct-text">{pct}%</span>
            </div>

            <h2 className="inst-title">Installing OctoClaw</h2>
            <p className="inst-sub">{label}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inst-success-icon">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                <circle cx="36" cy="36" r="33" stroke="#10D981" strokeWidth="2.5" />
                <path d="M22 36l10 10 18-18" stroke="#10D981" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="inst-title">Installation Complete</h2>
            <p className="inst-sub inst-sub-green">Launching your dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inst-error-icon">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                <circle cx="36" cy="36" r="33" stroke="#EF4444" strokeWidth="2.5" />
                <path d="M24 24l24 24M48 24L24 48" stroke="#EF4444" strokeWidth="3"
                  strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="inst-title">Installation Failed</h2>
            {errorMsg && <p className="inst-error-msg">{errorMsg}</p>}
            <button className="inst-retry-btn" onClick={() => onDone(false)}>
              ← Go Back &amp; Retry
            </button>
          </>
        )}

      </div>
    </div>
  )
}

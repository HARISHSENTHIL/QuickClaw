import { useEffect, useState, useRef } from 'react'

// Maps log line substrings → { pct, label }
// Ordered by specificity — first match wins.
const STEP_MAP = [
  { match: 'Starting OpenClaw installer',       pct:  3, label: 'Initializing installer…'        },
  { match: 'Checking OpenClaw installation',     pct:  8, label: 'Checking existing installation…' },
  { match: 'Not found. Installing',              pct: 10, label: 'OpenClaw not found, installing…' },
  { match: 'Trying official installer',          pct: 15, label: 'Downloading official installer…' },
  { match: 'Setting up Node.js',                 pct: 18, label: 'Setting up Node.js…'             },
  { match: 'Downloading nvm',                    pct: 21, label: 'Downloading nvm…'                },
  { match: 'Installing Node.js v22',             pct: 26, label: 'Installing Node.js v22 LTS…'     },
  { match: 'Node.js ready',                      pct: 32, label: 'Node.js ready'                   },
  { match: 'Installing openclaw via npm',        pct: 38, label: 'Installing OpenClaw via npm…'    },
  { match: 'Official installer complete',        pct: 48, label: 'OpenClaw installed'              },
  { match: 'Already installed',                  pct: 48, label: 'OpenClaw already installed'      },
  { match: 'Installed →',                        pct: 52, label: 'OpenClaw installed'              },
  { match: 'Ensuring openclaw is on PATH',       pct: 55, label: 'Configuring PATH…'               },
  { match: 'Setting up directories',             pct: 59, label: 'Setting up directories…'         },
  { match: 'Directories ready',                  pct: 62, label: 'Directories ready'               },
  { match: 'Saving API key',                     pct: 65, label: 'Saving API credentials…'         },
  { match: 'Generating gateway auth token',      pct: 68, label: 'Generating auth token…'          },
  { match: 'Writing config',                     pct: 71, label: 'Writing configuration…'          },
  { match: 'Config written',                     pct: 74, label: 'Config saved'                    },
  { match: 'Installing gateway daemon',          pct: 77, label: 'Installing gateway daemon…'      },
  { match: 'Daemon installed',                   pct: 82, label: 'Gateway daemon installed'        },
  { match: 'Writing auth profile',               pct: 85, label: 'Writing auth profile…'           },
  { match: 'Auth profile written',               pct: 88, label: 'Auth profile ready'              },
  { match: 'Starting gateway',                   pct: 91, label: 'Starting gateway…'               },
  { match: 'Gateway started',                    pct: 94, label: 'Gateway started'                 },
  { match: 'Verifying',                          pct: 96, label: 'Verifying installation…'         },
  { match: 'OpenClaw is live',                   pct: 99, label: 'Almost done…'                    },
]

function parseLog(line) {
  for (const step of STEP_MAP) {
    if (line.includes(step.match)) return step
  }
  return null
}

// SVG arc for a filled circle sector
const RADIUS = 36
const CIRC   = 2 * Math.PI * RADIUS

function ProgressRing({ pct }) {
  const filled = (pct / 100) * CIRC
  return (
    <div className="inst-spinner">
      <svg className="inst-svg" viewBox="0 0 88 88">
        <circle className="inst-track"        cx="44" cy="44" r={RADIUS} />
        <circle
          className="inst-progress-arc"
          cx="44" cy="44" r={RADIUS}
          strokeDasharray={`${filled} ${CIRC - filled}`}
          strokeDashoffset={CIRC / 4}   /* start from top */
        />
      </svg>
      <div className="inst-ring" />
      <div className="inst-pct-text">{pct}%</div>
    </div>
  )
}

export default function Installing({ config, onDone }) {
  const [status,  setStatus]  = useState('running')
  const [pct,     setPct]     = useState(3)
  const [stepLabel, setStepLabel] = useState('Initializing…')
  const pctRef = useRef(3)

  useEffect(() => {
    window.electronAPI?.removeAllListeners()

    window.electronAPI?.onLog((line) => {
      const step = parseLog(line)
      if (step && step.pct > pctRef.current) {
        pctRef.current = step.pct
        setPct(step.pct)
        setStepLabel(step.label)
      }
    })

    window.electronAPI?.onDone(async ({ success }) => {
      if (success) {
        setPct(100)
        setStepLabel('Installation complete')
        setStatus('success')
        setTimeout(() => onDone(true), 1200)
        return
      }
      const installed = await window.electronAPI?.checkInstalled?.().catch(() => null)
      if (installed) {
        setPct(100)
        setStepLabel('Installation complete')
        setStatus('success')
        setTimeout(() => onDone(true), 1200)
      } else {
        setStatus('error')
      }
    })

    window.electronAPI?.runInstall({
      provider: config.provider,
      model:    config.model,
      apiKey:   config.apiKey,
    })

    return () => window.electronAPI?.removeAllListeners()
  }, [])

  return (
    <div className="inst-step">
      <div className="inst-body">

        {status === 'running' && (
          <>
            <ProgressRing pct={pct} />
            <h2 className="inst-title">Installing OctoClaw</h2>
            <p className="inst-sub">{stepLabel}</p>
            <p className="inst-hint">This may take a few minutes on first run</p>
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
            <p className="inst-sub">Something went wrong. Please go back and try again.</p>
            <button className="inst-retry-btn" onClick={() => onDone(false)}>
              ← Go Back &amp; Retry
            </button>
          </>
        )}

      </div>
    </div>
  )
}

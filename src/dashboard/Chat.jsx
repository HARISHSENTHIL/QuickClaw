import { useEffect, useRef, useState } from 'react'

export default function Chat() {
  // 'init' → 'starting' → 'ready' | 'failed'
  const [phase, setPhase] = useState('init')
  const [statusMsg, setStatusMsg] = useState('Connecting…')
  const [chatUrl, setChatUrl] = useState(null)
  const webviewRef = useRef(null)
  const tokenRef = useRef(null)

  // On mount: read token → ensure gateway is up → show webview
  useEffect(() => {
    let cancelled = false

    async function init() {
      // 1. Read the gateway token
      const tok = await window.electronAPI?.readGatewayToken().catch(() => null)
      if (cancelled) return
      tokenRef.current = tok

      // 2. Auto-start gateway if not running (polls until ready, ~12 s max)
      setPhase('starting')
      setStatusMsg('Starting gateway…')
      const result = await window.electronAPI?.ensureGateway().catch(() => ({ success: false }))
      if (cancelled) return

      if (result?.success) {
        if (!tok) {
          // Token missing — loading webview without it causes "1008 unauthorized" disconnect
          setStatusMsg('Gateway token not found. Your ~/.openclaw/.env may be missing or corrupted. Please restart the app — if the issue persists, use the RESET button to re-run setup.')
          setPhase('failed')
          return
        }
        setChatUrl(`http://127.0.0.1:18789/?token=${tok}`)
        setPhase('ready')
      } else if (result?.error === 'BINARY_NOT_FOUND') {
        setStatusMsg('openclaw binary not found — please re-run setup')
        setPhase('failed')
      } else {
        setStatusMsg('Gateway failed to start')
        setPhase('failed')
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // Auto-inject token into the gateway web UI after page load
  useEffect(() => {
    if (phase !== 'ready' || !chatUrl) return
    const webview = webviewRef.current
    if (!webview) return

    const inject = () => {
      const tok = tokenRef.current

      if (!tok) return
      webview.executeJavaScript(`
        (function () {
          var tok = ${JSON.stringify(tok)};
          ['openclaw_gateway_token','gatewayToken','gateway_token','OPENCLAW_GATEWAY_TOKEN']
            .forEach(function (k) { try { localStorage.setItem(k, tok); } catch (e) {} });
          var inputs = document.querySelectorAll('input');
          var filled = false;
          for (var i = 0; i < inputs.length; i++) {
            var ph   = (inputs[i].placeholder || '').toLowerCase();
            var id   = (inputs[i].id          || '').toLowerCase();
            var name = (inputs[i].name        || '').toLowerCase();
            if (ph.includes('token') || id.includes('token') || name.includes('token') ||
                ph.includes('gateway') || id.includes('gateway')) {
              var setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
              ).set;
              setter.call(inputs[i], tok);
              inputs[i].dispatchEvent(new Event('input',  { bubbles: true }));
              inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
              filled = true;
              break;
            }
          }
          if (filled) {
            setTimeout(function () {
              var btns = document.querySelectorAll('button');
              for (var j = 0; j < btns.length; j++) {
                if ((btns[j].textContent || '').toLowerCase().includes('connect')) {
                  btns[j].click(); break;
                }
              }
            }, 300);
          }
        })();
      `).catch(() => {})
    }

    webview.addEventListener('did-finish-load', inject)
    return () => webview.removeEventListener('did-finish-load', inject)
  }, [phase, chatUrl])

  if (phase === 'init' || phase === 'starting') {
    return (
      <div className="dash-placeholder">
        <div className="dash-spinner" />
        <p>{statusMsg}</p>
      </div>
    )
  }

  if (phase === 'failed') {
    return (
      <div className="dash-placeholder">
        <p className="dash-error">⚠ {statusMsg}</p>
        <p className="dash-hint">
          Run <code>openclaw gateway start</code> in your terminal, then click Retry.
        </p>
        <button className="dash-btn-primary" onClick={() => setPhase('init')}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="chat-frame-wrap">
      <webview
        ref={webviewRef}
        src={chatUrl}
        className="chat-webview"
        allowpopups="true"
      />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

export default function Chat() {
  const [phase, setPhase] = useState('init')   // init | ready | failed
  const [failMsg, setFailMsg] = useState('')
  const [overlayMsg, setOverlayMsg] = useState('Connecting…')
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [chatUrl, setChatUrl] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const webviewRef = useRef(null)
  const tokenRef = useRef(null)

  // Live stage labels while ensureGateway runs
  useEffect(() => {
    const unsub = window.electronAPI?.onGatewayStage?.((msg) => setOverlayMsg(msg))
    return () => unsub?.()
  }, [])

  // Show overlay whenever any action (Skills, Telegram, Reset) restarts the gateway
  useEffect(() => {
    const unsub = window.electronAPI?.onGatewayRestart?.((data) => {
      if (data.state === 'restarting') {
        setOverlayMsg(data.msg || 'Restarting gateway…')
        setOverlayVisible(true)
      } else {
        // Give webview a moment to reload before hiding
        setTimeout(() => {
          webviewRef.current?.reload()
          setOverlayVisible(false)
        }, 800)
      }
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      // 1. Read token (fast file read — ~10ms)
      const tok = await window.electronAPI?.readGatewayToken().catch(() => null)
      if (cancelled) return

      if (!tok) {
        setFailMsg('Gateway token not found. Your ~/.openclaw/.env may be missing or corrupted. Restart the app — if the issue persists, use the RESET button to re-run setup.')
        setPhase('failed')
        return
      }

      // 2. Render WebView immediately — don't wait for gateway
      tokenRef.current = tok
      setChatUrl(`http://127.0.0.1:18789/?token=${tok}`)
      setOverlayMsg('Connecting…')
      setOverlayVisible(true)
      setPhase('ready')

      // 3. Single 300ms probe in background — non-blocking
      const alive = await window.electronAPI?.probeGateway().catch(() => false)
      if (cancelled) return

      if (alive) {
        // Gateway up — overlay clears on did-finish-load
        return
      }

      // 4. Not responding — start it
      setOverlayMsg('Starting gateway…')
      const result = await window.electronAPI?.ensureGateway().catch(() => ({ success: false }))
      if (cancelled) return

      if (result?.success) {
        webviewRef.current?.reload()
        // overlay clears on did-finish-load after reload
      } else if (result?.error === 'BINARY_NOT_FOUND') {
        setOverlayVisible(false)
        setFailMsg('openclaw binary not found — please re-run setup')
        setPhase('failed')
      } else {
        setOverlayVisible(false)
        setFailMsg('Gateway failed to start')
        setPhase('failed')
      }
    }

    init()
    return () => { cancelled = true }
  }, [retryCount])

  // Clear overlay + inject token once WebView finishes loading
  useEffect(() => {
    if (phase !== 'ready' || !chatUrl) return
    const webview = webviewRef.current
    if (!webview) return

    const onLoad = () => {
      setOverlayVisible(false)
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

    webview.addEventListener('did-finish-load', onLoad)
    return () => webview.removeEventListener('did-finish-load', onLoad)
  }, [phase, chatUrl])

  if (phase === 'init') {
    return (
      <div className="dash-placeholder">
        <div className="dash-spinner" />
        <p>Loading…</p>
      </div>
    )
  }

  if (phase === 'failed') {
    return (
      <div className="dash-placeholder">
        <p className="dash-error">{failMsg}</p>
        <p className="dash-hint">
          Run <code>openclaw gateway start</code> in your terminal, then click Retry.
        </p>
        <button className="dash-btn-primary" onClick={() => { setPhase('init'); setRetryCount((c) => c + 1) }}>
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
      {overlayVisible && (
        <div className="chat-connecting-overlay">
          <div className="dash-spinner" />
          <p>{overlayMsg}</p>
        </div>
      )}
    </div>
  )
}

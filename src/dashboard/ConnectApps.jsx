import { useState, useEffect } from 'react'

// Telegram bot token format: numeric_id:35-char-alphanumeric
// e.g. 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ123456789
const TELEGRAM_TOKEN_RE = /^\d+:[A-Za-z0-9_-]{35,}$/

export default function ConnectApps() {
  const [telegramExpanded, setTelegramExpanded] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  // On mount: check openclaw.json — if Telegram is already configured show CONNECTED
  // This persists the connected state across tab navigation (component remounts)
  useEffect(() => {
    window.electronAPI?.readConfig().then((config) => {
      if (config?.channels?.telegram?.botToken) setSaved(true)
    }).catch(() => {})
  }, [])

  const isValidToken = TELEGRAM_TOKEN_RE.test(botToken.trim())

  const handleSave = async () => {
    if (!botToken.trim()) return

    if (!isValidToken) {
      setError('Invalid token format. It should look like: 1234567890:ABCdef...')
      return
    }

    setSaving(true)
    setError(null)
    const result = await window.electronAPI?.saveTelegramConfig({ botToken: botToken.trim() })
    setSaving(false)

    if (result?.success) {
      setSaved(true)
    } else {
      setError(result?.error || 'Failed to save config')
    }
  }

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <p className="dash-page-label">CONFIG</p>
        <h1 className="dash-page-title">Connect Apps</h1>
        <p className="dash-page-sub">Extend the agent to external ecosystems.</p>
      </div>

      <div className="app-cards">
        <div className={`app-card${telegramExpanded ? ' app-card-open' : ''}`}>
          <div className="app-card-header">
            <div className="app-card-icon telegram-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
              </svg>
            </div>
            <div className="app-card-info">
              <h3 className="app-card-name">Telegram</h3>
              <p className="app-card-desc">
                {saved ? '✓ Connected — bot is active' : 'Create a dedicated AI bot.'}
              </p>
            </div>
            {!saved && (
              <button
                className="app-connect-btn"
                onClick={() => { setTelegramExpanded((v) => !v); setError(null) }}
              >
                {telegramExpanded ? 'CANCEL' : 'CONNECT'}
              </button>
            )}
            {saved && <span className="app-connected-badge">CONNECTED</span>}
          </div>

          {telegramExpanded && !saved && (
            <div className="app-card-form">
              <p className="app-form-hint">
                Create a bot via{' '}
                <button className="inline-link" onClick={() => window.electronAPI?.openUrl('https://t.me/BotFather')}>
                  @BotFather
                </button>{' '}
                on Telegram, copy the token it gives you, then paste it below.
              </p>
              <div className="form-row">
                <input
                  className="dash-input"
                  placeholder="1234567890:ABCDefGhIJKlmNoPQRsTUVwxyZ..."
                  value={botToken}
                  onChange={(e) => { setBotToken(e.target.value); setError(null) }}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  className="dash-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !botToken.trim()}
                >
                  {saving ? 'Connecting…' : 'Connect'}
                </button>
              </div>
              {botToken.trim() && !isValidToken && (
                <p className="form-hint-warn">Token format: 1234567890:ABCdef... (numbers, colon, then 35+ characters)</p>
              )}
              {error && <p className="form-error">{error}</p>}
              {saving && (
                <p className="form-hint-saving">Saving config and restarting gateway — this takes a few seconds…</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

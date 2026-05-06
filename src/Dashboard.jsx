import { useState, useEffect } from 'react'
import logoSrc from './assets/octoclaw-logo.webp?inline'
import Chat from './dashboard/Chat'
import ConnectApps from './dashboard/ConnectApps'
import Skills from './dashboard/Skills'
import Balance from './dashboard/Balance'

const NAV = [
  { id: 'chat', label: 'CHAT' },
  { id: 'connect', label: 'CONNECT APPS' },
  { id: 'skills', label: 'SKILLS' },
  { id: 'balance', label: 'BALANCE' },
]

export default function Dashboard({ config, onReset }) {
  const [active, setActive] = useState('chat')
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const offAvailable = window.electronAPI?.onUpdateAvailable?.((info) => setUpdateInfo(info))
    const offDownloaded = window.electronAPI?.onUpdateDownloaded?.((info) => { setUpdateInfo(info); setUpdateReady(true) })
    return () => { offAvailable?.(); offDownloaded?.() }
  }, [])

  const handleReset = async () => {
    setResetting(true)
    await window.electronAPI?.factoryReset().catch(() => {})
    setResetting(false)
    onReset()
  }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-drag" />
        <div className="sidebar-logo">
          <img src={logoSrc} alt="OctoClaw" className="sidebar-logo-img" />
          <span className="sidebar-logo-name">OctoClaw</span>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section-label">MENU</p>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item${active === item.id ? ' nav-active' : ''}`}
              onClick={() => setActive(item.id)}
            >
              <span className="nav-dot" />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {updateInfo && (
          <div className="update-banner">
            <span className="update-banner-text">
              v{updateInfo.version} available{updateReady ? ' — ready' : ' — downloading…'}
            </span>
            {updateReady && (
              <button className="update-banner-btn" onClick={() => window.electronAPI?.installUpdate()}>
                RESTART
              </button>
            )}
          </div>
        )}

        <div className="sidebar-footer">
          {confirmReset ? (
            <div className="footer-reset-confirm">
              <p className="footer-reset-warn">{resetting ? 'Clearing data and restarting gateway…' : 'This will delete all integration keys, Telegram config, and restart the setup wizard.'}</p>
              <div className="footer-reset-actions">
                <button className="footer-reset-confirm-btn" onClick={handleReset} disabled={resetting}>{resetting ? '…' : 'CONFIRM'}</button>
                {!resetting && <button className="footer-reset-cancel-btn" onClick={() => setConfirmReset(false)}>CANCEL</button>}
              </div>
            </div>
          ) : (
            <>
              <div className="footer-info">
                <span className="footer-provider">{config.provider}</span>
                <span className="footer-model">{config.model}</span>
              </div>
              <button className="footer-reset" onClick={() => setConfirmReset(true)}>
                RESET
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content — always mounted, toggled with CSS so Chat never loses session */}
      <main className="dash-content">
        <div style={{ display: active === 'chat'    ? 'contents' : 'none' }}><Chat config={config} isActive={active === 'chat'} /></div>
        <div style={{ display: active === 'connect' ? 'contents' : 'none' }}><ConnectApps /></div>
        <div style={{ display: active === 'skills'  ? 'contents' : 'none' }}><Skills /></div>
        <div style={{ display: active === 'balance' ? 'contents' : 'none' }}><Balance /></div>
      </main>
    </div>
  )
}

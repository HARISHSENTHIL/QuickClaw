import { useState } from 'react'
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

        <div className="sidebar-footer">
          <div className="footer-info">
            <span className="footer-provider">{config.provider}</span>
            <span className="footer-model">{config.model}</span>
          </div>
          <button className="footer-reset" onClick={onReset}>
            RESET
          </button>
        </div>
      </aside>

      {/* Main content — always mounted, toggled with CSS so Chat never loses session */}
      <main className="dash-content">
        <div style={{ display: active === 'chat'    ? 'contents' : 'none' }}><Chat config={config} /></div>
        <div style={{ display: active === 'connect' ? 'contents' : 'none' }}><ConnectApps /></div>
        <div style={{ display: active === 'skills'  ? 'contents' : 'none' }}><Skills /></div>
        <div style={{ display: active === 'balance' ? 'contents' : 'none' }}><Balance /></div>
      </main>
    </div>
  )
}

import { useState, useEffect } from 'react'
import logoSrc from '../assets/octoclaw-logo.webp?inline'

function IconCube() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconBolt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.5 7.5L6 11L12.5 4" stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const CAPABILITIES = [
  'Track whale movements in real time',
  'Analyze token fundamentals & sentiment',
  'Execute strategy-based trades',
  'Monitor your portfolio with AI insights',
]

export default function Welcome({ onNext }) {
  const [version, setVersion] = useState('')
  useEffect(() => {
    window.electronAPI?.getAppVersion().then(setVersion).catch(() => { })
  }, [])

  return (
    <div className="welcome-v2">
      {/* Drag region replacing the global titlebar */}
      <div className="wv2-drag" />

      {/* Hero: logo + title + subtitle */}
      <div className="wv2-hero">
        <div className="wv2-logo">
          <img src={logoSrc} alt="OctoClaw" className="wv2-logo-img" />
        </div>
        <div className="wv2-hero-text">
          <h1 className="wv2-title">
            OctoClaw <span className="wv2-title-dim">Crypto Agent</span>
          </h1>
          <p className="wv2-subtitle">Your autonomous AI for on-chain intelligence &amp; execution</p>
        </div>
      </div>

      {/* Three feature cards */}
      <div className="wv2-cards">
        <div className="wv2-card">
          <div className="wv2-card-icon wv2-icon-purple"><IconCube /></div>
          <h3 className="wv2-card-title">Multi-LLM<br />Intelligence Layer</h3>
          <p className="wv2-card-desc">Route tasks across OpenAI, Anthropic, Groq & more, optimized for crypto workflows.</p>
        </div>
        <div className="wv2-card wv2-card-teal">
          <div className="wv2-card-icon wv2-icon-teal"><IconLock /></div>
          <h3 className="wv2-card-title">Secure Local<br />Execution</h3>
          <p className="wv2-card-desc">Private keys &amp; API credentials stay on your device never exposed.</p>
        </div>
        <div className="wv2-card wv2-card-blue">
          <div className="wv2-card-icon wv2-icon-blue"><IconBolt /></div>
          <h3 className="wv2-card-title">Automated<br />Crypto Actions</h3>
          <p className="wv2-card-desc">Analyze markets, monitor wallets, trigger trades, and execute strategies autonomously.</p>
        </div>
      </div>

      {/* Capability checklist */}
      <div className="wv2-checklist-wrap">
        <p className="wv2-checklist-heading">What you can do:</p>
        <ul className="wv2-checklist">
          {CAPABILITIES.map((c) => (
            <li key={c}><IconCheck /><span>{c}</span></li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <button className="wv2-cta" onClick={onNext}>Get Started →</button>

      {/* Footer */}
      <p className="wv2-footer">{version ? `v${version}` : ''} &nbsp;&middot;&nbsp; Local-first &nbsp;&middot;&nbsp; Secure &nbsp;&middot;&nbsp; Extensible</p>
    </div>
  )
}

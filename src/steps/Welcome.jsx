import logoSrc from '../assets/octoclaw-logo.webp?inline'

function IconProviders() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 6V3M10 6V3M12 6V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 17v-3M10 17v-3M12 17v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 8H3M6 10H3M6 12H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M17 8h-3M17 10h-3M17 12h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L17 5v5c0 4.5-3.1 7.4-7 8.5C6.1 17.4 3 14.5 3 10V5l7-3z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 10.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconTerminal() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 8l3 2.5L6 13" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function Welcome({ onNext }) {
  return (
    <div className="step center">
      <div className="welcome-logo">
        <img src={logoSrc} alt="OctoClaw" className="welcome-logo-img" />
      </div>

      <h1 className="welcome-title">OctoClaw</h1>
      <p className="welcome-subtitle">One-click AI agent setup for macOS</p>

      <div className="feature-chips">
        <div className="chip">
          <div className="chip-icon purple"><IconProviders /></div>
          <span>9 AI providers — OpenAI, Anthropic, Google &amp; more</span>
        </div>
        <div className="chip">
          <div className="chip-icon cyan"><IconShield /></div>
          <span>API key stored locally, never transmitted</span>
        </div>
        <div className="chip">
          <div className="chip-icon green"><IconTerminal /></div>
          <span>Auto-installs &amp; configures local gateway</span>
        </div>
      </div>

      <button className="btn-primary" onClick={onNext}>
        Get Started →
      </button>

      <p className="footer-note">OctoClaw Desktop · v1.0.0</p>
    </div>
  )
}

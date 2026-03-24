import { useState } from 'react'
import logoSrc from '../assets/octoclaw-logo.webp?inline'

const KEY_HINTS = {
  openai: {
    placeholder: 'sk-proj-...',
    link: 'https://platform.openai.com/api-keys',
    label: 'OpenAI Platform',
  },
  anthropic: {
    placeholder: 'sk-ant-...',
    link: 'https://console.anthropic.com/settings/keys',
    label: 'Anthropic Console',
  },
  google: {
    placeholder: 'AIza...',
    link: 'https://aistudio.google.com/app/apikey',
    label: 'Google AI Studio',
  },
  mistral: {
    placeholder: 'Paste your Mistral key...',
    link: 'https://console.mistral.ai/api-keys',
    label: 'Mistral Console',
  },
  groq: {
    placeholder: 'gsk_...',
    link: 'https://console.groq.com/keys',
    label: 'Groq Console',
  },
  cohere: {
    placeholder: 'Paste your Cohere key...',
    link: 'https://dashboard.cohere.com/api-keys',
    label: 'Cohere Dashboard',
  },
  together: {
    placeholder: 'Paste your Together AI key...',
    link: 'https://api.together.xyz/settings/api-keys',
    label: 'Together Dashboard',
  },
  openrouter: {
    placeholder: 'sk-or-...',
    link: 'https://openrouter.ai/keys',
    label: 'OpenRouter Keys',
  },
  ollama: {
    placeholder: null,
    link: null,
    label: null,
  },
}

function IconEye({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  )
}

export default function ApiKey({ config, onChange, onNext, onBack }) {
  const [show, setShow] = useState(false)
  const hint = KEY_HINTS[config.provider] || KEY_HINTS.openai
  const canContinue = config.apiKey.trim().length > 10

  const openLink = () => {
    if (hint.link) window.electronAPI?.openUrl(hint.link)
  }

  return (
    <div className="ak-step">
      {/* Header — transparent drag bar */}
      <div className="ak-header">
        <button className="ak-back" onClick={onBack}>← Back</button>
        <div className="ak-brand">
          <img src={logoSrc} alt="" className="ak-brand-img" />
          <span className="ak-brand-name">OctoClaw</span>
        </div>
        <span className="ak-badge">Step 2 of 2</span>
      </div>

      {/* Vertically centered body */}
      <div className="ak-body">
        <h2 className="ak-title">Enter Your API Key</h2>
        <p className="ak-subtitle">Your key is securely encrypted and stored locally on your device.</p>

        {/* Full-width orange divider */}
        <div className="ak-divider" />

        <div className="ak-form">
          {/* Label row */}
          <div className="ak-field-row">
            <span className="ak-label">API Key</span>
            {hint.link && (
              <button className="ak-get-key" onClick={openLink}>
                Get one from {hint.label} ↗
              </button>
            )}
          </div>

          {/* Input */}
          <div className="ak-input-wrap">
            <input
              className="ak-input"
              type={show ? 'text' : 'password'}
              placeholder={hint.placeholder || ''}
              value={config.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              autoFocus
              spellCheck={false}
            />
            <button
              className="ak-vis-btn"
              onClick={() => setShow((s) => !s)}
              tabIndex={-1}
              aria-label={show ? 'Hide key' : 'Show key'}
            >
              <IconEye open={show} />
            </button>
          </div>

          {/* Security note */}
          <div className="ak-security">
            <IconShield />
            <span>Your key is securely encrypted (chmod 600) and kept private.</span>
          </div>

          {/* Install CTA */}
          <button className="ak-install-btn" onClick={onNext} disabled={!canContinue}>
            Install OctoClaw →
          </button>
        </div>
      </div>
    </div>
  )
}

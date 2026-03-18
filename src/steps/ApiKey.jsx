import { useState } from 'react'

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

export default function ApiKey({ config, onChange, onNext, onBack }) {
  const [show, setShow] = useState(false)
  const hint = KEY_HINTS[config.provider] || KEY_HINTS.openai
  const canContinue = config.apiKey.trim().length > 10

  const openLink = () => {
    if (hint.link) window.electronAPI?.openUrl(hint.link)
  }

  return (
    <div className="step">
      {/* Step header */}
      <div className="step-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <span className="step-badge">Step 2 of 2</span>
      </div>

      <h2 className="step-title">Enter Your API Key</h2>
      <p className="step-sub">
        Your key is stored locally in <code>~/.octoclaw/.env</code> and never sent anywhere else.
      </p>

      <div className="field-group">
        <label className="field-label">
          API Key
          {hint.link && (
            <button className="link-btn" onClick={openLink}>
              Get one from {hint.label} ↗
            </button>
          )}
        </label>

        <div className="key-wrap">
          <input
            className="field-input monospace"
            type={show ? 'text' : 'password'}
            placeholder={hint.placeholder || ''}
            value={config.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value })}
            autoFocus
            spellCheck={false}
          />
          <button
            className="vis-toggle"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            aria-label={show ? 'Hide key' : 'Show key'}
          >
            {show ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <div className="security-note">
        <span className="lock-icon">🔒</span>
        <span>
          Key is saved with <code>chmod 600</code> — only readable by you.
        </span>
      </div>

      <button className="btn-primary" onClick={onNext} disabled={!canContinue}>
        Install OctoClaw →
      </button>
    </div>
  )
}

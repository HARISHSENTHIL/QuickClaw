const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    abbr: 'AI',
    color: '#10A37F',
    bg: 'rgba(16,163,127,0.15)',
    desc: 'GPT-4o & family',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini', 'gpt-3.5-turbo'],
    modelLabels: {
      'gpt-4o':         'GPT-4o',
      'gpt-4o-mini':    'GPT-4o mini',
      'gpt-4-turbo':    'GPT-4 Turbo',
      'o1-preview':     'o1 Preview',
      'o1-mini':        'o1 mini',
      'gpt-3.5-turbo':  'GPT-3.5 Turbo',
    },
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    abbr: 'AN',
    color: '#D97757',
    bg: 'rgba(217,119,87,0.15)',
    desc: 'Claude series',
    models: [
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-haiku-4-5-20251001',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ],
    modelLabels: {
      'claude-sonnet-4-6':           'Claude Sonnet 4.6',
      'claude-opus-4-6':             'Claude Opus 4.6',
      'claude-haiku-4-5-20251001':   'Claude Haiku 4.5',
      'claude-3-5-sonnet-20241022':  'Claude 3.5 Sonnet',
      'claude-3-opus-20240229':      'Claude 3 Opus',
      'claude-3-haiku-20240307':     'Claude 3 Haiku',
    },
  },
  {
    id: 'google',
    label: 'Google',
    abbr: 'GG',
    color: '#4285F4',
    bg: 'rgba(66,133,244,0.12)',
    desc: 'Gemini models',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
    modelLabels: {
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'gemini-1.5-pro':   'Gemini 1.5 Pro',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
      'gemini-pro':       'Gemini Pro',
    },
  },
  {
    id: 'mistral',
    label: 'Mistral',
    abbr: 'MS',
    color: '#FF7000',
    bg: 'rgba(255,112,0,0.12)',
    desc: 'Mistral & Mixtral',
    models: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'mixtral-8x7b-instruct',
      'open-mistral-7b',
    ],
    modelLabels: {
      'mistral-large-latest':   'Mistral Large',
      'mistral-medium-latest':  'Mistral Medium',
      'mistral-small-latest':   'Mistral Small',
      'mixtral-8x7b-instruct':  'Mixtral 8x7B',
      'open-mistral-7b':        'Mistral 7B',
    },
  },
  {
    id: 'groq',
    label: 'Groq',
    abbr: 'GQ',
    color: '#F55036',
    bg: 'rgba(245,80,54,0.12)',
    desc: 'Ultra-fast inference',
    models: [
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.2-90b-text-preview',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    modelLabels: {
      'llama-3.1-70b-versatile':     'Llama 3.1 70B',
      'llama-3.1-8b-instant':        'Llama 3.1 8B',
      'llama-3.2-90b-text-preview':  'Llama 3.2 90B',
      'mixtral-8x7b-32768':          'Mixtral 8x7B',
      'gemma2-9b-it':                'Gemma 2 9B',
    },
  },
  {
    id: 'cohere',
    label: 'Cohere',
    abbr: 'CO',
    color: '#39B398',
    bg: 'rgba(57,179,152,0.12)',
    desc: 'Enterprise LLMs',
    models: ['command-r-plus', 'command-r', 'command'],
    modelLabels: {
      'command-r-plus': 'Command R+',
      'command-r':      'Command R',
      'command':        'Command',
    },
  },
  {
    id: 'together',
    label: 'Together AI',
    abbr: 'TA',
    color: '#0066FF',
    bg: 'rgba(0,102,255,0.1)',
    desc: 'Open-source models',
    models: [
      'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
    ],
    modelLabels: {
      'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo': 'Llama 3.1 405B',
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo':  'Llama 3.1 70B',
      'mistralai/Mixtral-8x7B-Instruct-v0.1':           'Mixtral 8x7B',
    },
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    abbr: 'OR',
    color: '#6467F2',
    bg: 'rgba(100,103,242,0.12)',
    desc: 'Any model via API',
    models: null, // custom text input
    modelLabels: {},
  },
  {
    id: 'ollama',
    label: 'Ollama',
    abbr: 'OL',
    color: '#6B7280',
    bg: 'rgba(107,114,128,0.12)',
    desc: 'Local · no key needed',
    models: null, // custom text input
    modelLabels: {},
    noKey: true,
  },
]

export default function ProviderModel({ config, onChange, onNext, onBack }) {
  const selectedProvider = PROVIDERS.find((p) => p.id === config.provider)
  const isCustom = selectedProvider?.models === null

  const handleProviderClick = (p) => {
    const firstModel = p.models ? p.models[0] : ''
    onChange({ provider: p.id, model: firstModel })
  }

  const canContinue = Boolean(config.provider && config.model)

  return (
    <div className="step">
      {/* Step header */}
      <div className="step-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <span className="step-badge">Step 1 of 2</span>
      </div>

      <h2 className="step-title">Choose Provider &amp; Model</h2>
      <p className="step-sub">Select the AI provider and model you want OctoClaw to use.</p>

      {/* Scrollable provider grid — 3 columns × 3 rows */}
      <div className="provider-scroll">
        <div className="provider-grid">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              className={`provider-card${config.provider === p.id ? ' active' : ''}`}
              onClick={() => handleProviderClick(p)}
            >
              <div
                className="provider-logo"
                style={{ background: p.bg, color: p.color }}
              >
                {p.abbr}
              </div>
              <div className="provider-info">
                <span className="provider-name">{p.label}</span>
                <span className="provider-desc">{p.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Model selector */}
      <div className="field-group">
        <label className="field-label">Model</label>
        {isCustom ? (
          <input
            className="field-input"
            placeholder={
              config.provider === 'ollama'
                ? 'e.g. llama3, mistral, phi3...'
                : 'e.g. anthropic/claude-3-opus'
            }
            value={config.model}
            onChange={(e) => onChange({ model: e.target.value })}
            autoFocus
            spellCheck={false}
          />
        ) : (
          <select
            className="field-select"
            value={config.model}
            onChange={(e) => onChange({ model: e.target.value })}
          >
            {selectedProvider?.models?.map((m) => (
              <option key={m} value={m}>
                {selectedProvider.modelLabels?.[m] || m}
              </option>
            ))}
          </select>
        )}
      </div>

      <button className="btn-primary" onClick={onNext} disabled={!canContinue}>
        Continue →
      </button>
    </div>
  )
}

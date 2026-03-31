import { useState, useEffect } from 'react'

// To add a new exchange: append an entry here + drop SKILL.md into assets/skills/
const INTEGRATION_SKILLS = [
  {
    id: 'binance',
    label: 'Binance',
    desc: 'Spot, derivatives, margin, convert & more',
    Icon: BinanceIcon,
    accentColor: '#F0B90B',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'Your Binance API Key',
        secret: false,
        validate: (v) => v.trim().length >= 32,
        errorMsg: 'API key looks too short',
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        placeholder: 'Your Binance Secret Key',
        secret: true,
        validate: (v) => v.trim().length >= 32,
        errorMsg: 'Secret key looks too short',
      },
    ],
    buildEnvVars: (vals) => ({
      BINANCE_API_KEY:    vals.apiKey.trim(),
      BINANCE_API_SECRET: vals.secretKey.trim(),
    }),
    // Official skills from github.com/binance/binance-skills-hub
    // assetFile = path inside assets/skills/, skillFolder = dest under <workspace>/skills/
    modules: [
      { id: 'spot',                             label: 'Spot Trading',         assetFile: 'binance/spot.md',                                 skillFolder: 'binance-spot',                    defaultOn: true },
      { id: 'alpha',                            label: 'Alpha',                assetFile: 'binance/alpha.md',                                skillFolder: 'binance-alpha',                   defaultOn: true },
      { id: 'assets',                           label: 'Assets',               assetFile: 'binance/assets.md',                               skillFolder: 'binance-assets',                  defaultOn: true },
      { id: 'convert',                          label: 'Convert',              assetFile: 'binance/convert.md',                              skillFolder: 'binance-convert',                 defaultOn: true },
      { id: 'margin-trading',                   label: 'Margin Trading',       assetFile: 'binance/margin-trading.md',                       skillFolder: 'binance-margin-trading',          defaultOn: true },
      { id: 'derivatives-usds-futures',         label: 'USDS Futures',         assetFile: 'binance/derivatives-trading-usds-futures.md',     skillFolder: 'binance-usds-futures',            defaultOn: true },
      { id: 'derivatives-coin-futures',         label: 'COIN Futures',         assetFile: 'binance/derivatives-trading-coin-futures.md',     skillFolder: 'binance-coin-futures',            defaultOn: true },
      { id: 'derivatives-options',              label: 'Options',              assetFile: 'binance/derivatives-trading-options.md',          skillFolder: 'binance-options',                 defaultOn: true },
      { id: 'derivatives-portfolio-margin',     label: 'Portfolio Margin',     assetFile: 'binance/derivatives-trading-portfolio-margin.md', skillFolder: 'binance-portfolio-margin',        defaultOn: true },
      { id: 'derivatives-portfolio-margin-pro', label: 'Portfolio Margin Pro', assetFile: 'binance/derivatives-trading-portfolio-margin-pro.md', skillFolder: 'binance-portfolio-margin-pro', defaultOn: true },
      { id: 'onchain-pay',                      label: 'On-chain Pay',         assetFile: 'binance/onchain-pay.md',                          skillFolder: 'binance-onchain-pay',             defaultOn: true },
      { id: 'square-post',                      label: 'Square Post',          assetFile: 'binance/square-post.md',                          skillFolder: 'binance-square-post',             defaultOn: true },
    ],
  },
  {
    id: 'coingecko',
    label: 'CoinGecko',
    desc: 'Crypto prices, market data, on-chain analytics',
    Icon: CoinGeckoIcon,
    accentColor: '#8DC63F',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key (optional)',
        placeholder: 'Demo or Pro key — leave blank for keyless (10 req/min)',
        secret: false,
        validate: (v) => v.trim().length === 0 || v.trim().length >= 10,
        errorMsg: 'Key looks too short',
      },
    ],
    buildEnvVars: (vals) => ({ COINGECKO_API_KEY: vals.apiKey.trim() }),
    modules: [
      { id: 'core',                  label: 'Core',                assetFile: 'coingecko/core.md',                  skillFolder: 'coingecko-core',                  defaultOn: true  },
      { id: 'coins',                 label: 'Coins',               assetFile: 'coingecko/coins.md',                 skillFolder: 'coingecko-coins',                 defaultOn: true  },
      { id: 'global',                label: 'Global Market',       assetFile: 'coingecko/global.md',                skillFolder: 'coingecko-global',                defaultOn: true  },
      { id: 'categories',            label: 'Categories',          assetFile: 'coingecko/categories.md',            skillFolder: 'coingecko-categories',            defaultOn: true  },
      { id: 'exchanges',             label: 'Exchanges',           assetFile: 'coingecko/exchanges.md',             skillFolder: 'coingecko-exchanges',             defaultOn: true  },
      { id: 'coin-history',          label: 'Coin History',        assetFile: 'coingecko/coin-history.md',          skillFolder: 'coingecko-coin-history',          defaultOn: true  },
      { id: 'coin-supply',           label: 'Coin Supply',         assetFile: 'coingecko/coin-supply.md',           skillFolder: 'coingecko-coin-supply',           defaultOn: true  },
      { id: 'asset-platforms',       label: 'Asset Platforms',     assetFile: 'coingecko/asset-platforms.md',       skillFolder: 'coingecko-asset-platforms',       defaultOn: true  },
      { id: 'contract',              label: 'Contract',            assetFile: 'coingecko/contract.md',              skillFolder: 'coingecko-contract',              defaultOn: true  },
      { id: 'utils',                 label: 'Utils',               assetFile: 'coingecko/utils.md',                 skillFolder: 'coingecko-utils',                 defaultOn: true  },
      { id: 'derivatives',           label: 'Derivatives',         assetFile: 'coingecko/derivatives.md',           skillFolder: 'coingecko-derivatives',           defaultOn: false },
      { id: 'nfts',                  label: 'NFTs',                assetFile: 'coingecko/nfts.md',                  skillFolder: 'coingecko-nfts',                  defaultOn: false },
      { id: 'treasury',              label: 'Treasury',            assetFile: 'coingecko/treasury.md',              skillFolder: 'coingecko-treasury',              defaultOn: false },
      { id: 'onchain-networks',      label: 'On-chain Networks',   assetFile: 'coingecko/onchain-networks.md',      skillFolder: 'coingecko-onchain-networks',      defaultOn: false },
      { id: 'onchain-pools',         label: 'On-chain Pools',      assetFile: 'coingecko/onchain-pools.md',         skillFolder: 'coingecko-onchain-pools',         defaultOn: false },
      { id: 'onchain-tokens',        label: 'On-chain Tokens',     assetFile: 'coingecko/onchain-tokens.md',        skillFolder: 'coingecko-onchain-tokens',        defaultOn: false },
      { id: 'onchain-categories',    label: 'On-chain Categories', assetFile: 'coingecko/onchain-categories.md',    skillFolder: 'coingecko-onchain-categories',    defaultOn: false },
      { id: 'onchain-ohlcv-trades',  label: 'On-chain OHLCV',      assetFile: 'coingecko/onchain-ohlcv-trades.md',  skillFolder: 'coingecko-onchain-ohlcv-trades',  defaultOn: false },
    ],
  },
]

export default function Skills() {
  const [installedModules, setInstalledModules] = useState({})

  useEffect(() => {
    window.electronAPI?.readIntegrationSkills().then((entries) => {
      const installed = {}
      for (const key of Object.keys(entries || {})) {
        installed[key] = true
      }
      setInstalledModules(installed)
    }).catch(() => {})
  }, [])

  const handleModulesInstalled = (moduleKeys) => {
    setInstalledModules((prev) => {
      const next = { ...prev }
      moduleKeys.forEach((k) => { next[k] = true })
      return next
    })
  }

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <p className="dash-page-label">AGENT</p>
        <h1 className="dash-page-title">Skills</h1>
        <p className="dash-page-sub">Connect exchange integrations to extend the agent.</p>
      </div>

      <p className="skills-section-label">INTEGRATIONS</p>
      <div className="integration-list">
        {INTEGRATION_SKILLS.map((skill) => (
          <IntegrationCard
            key={skill.id}
            skill={skill}
            installedModules={installedModules}
            onModulesInstalled={handleModulesInstalled}
          />
        ))}
      </div>
    </div>
  )
}

function IntegrationCard({ skill, installedModules, onModulesInstalled }) {
  const { Icon, label, desc, accentColor, fields, modules, buildEnvVars } = skill

  const connectedModuleKeys = modules.filter((m) => installedModules[m.skillFolder]).map((m) => m.skillFolder)
  const isConnected = connectedModuleKeys.length > 0

  const [expanded, setExpanded] = useState(false)
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, ''])))
  const [fieldErrors, setFieldErrors] = useState({})
  const [revealed, setRevealed] = useState({})
  const [selectedModules, setSelectedModules] = useState(
    () => Object.fromEntries(modules.map((m) => [m.id, m.defaultOn]))
  )

  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState(null)

  const setField = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }))
    setFieldErrors((prev) => ({ ...prev, [key]: null }))
    setError(null)
  }

  const toggleModule = (id) => {
    setSelectedModules((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const validate = () => {
    const errs = {}
    for (const f of fields) {
      if (!f.validate(values[f.key])) errs[f.key] = f.errorMsg
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleConnect = async () => {
    if (!validate()) return

    const chosenModules = modules.filter((m) => selectedModules[m.id])
    if (chosenModules.length === 0) {
      setError('Select at least one skill module to install.')
      return
    }

    setInstalling(true)
    setError(null)

    const result = await window.electronAPI?.installIntegrationSkill({
      modules: chosenModules.map((m) => ({ assetFile: m.assetFile, skillFolder: m.skillFolder })),
      envVars: buildEnvVars(values),
    })

    setInstalling(false)

    if (result?.success) {
      onModulesInstalled(chosenModules.map((m) => m.skillFolder))
      setExpanded(false)
    } else {
      setError(result?.error || 'Installation failed')
    }
  }

  return (
    <div className={`integration-card${expanded ? ' integration-card-open' : ''}`}>
      <div className="integration-card-header">
        <div className="integration-icon" style={{ background: accentColor + '22', color: accentColor }}>
          <Icon />
        </div>
        <div className="integration-info">
          <span className="integration-name">{label}</span>
          <span className="integration-desc">
            {isConnected
              ? `✓ ${connectedModuleKeys.length} of ${modules.length} modules active`
              : desc}
          </span>
        </div>
        {isConnected ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="integration-badge">ACTIVE</span>
            <button className="integration-connect-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'CLOSE' : 'MANAGE'}
            </button>
          </div>
        ) : (
          <button className="integration-connect-btn" onClick={() => { setExpanded((v) => !v); setError(null) }}>
            {expanded ? 'CANCEL' : 'CONNECT'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="integration-form">
          {fields.map((f) => (
            <div key={f.key} className="integration-field">
              <label className="integration-field-label">{f.label}</label>
              <div className="integration-field-wrap">
                <input
                  className={`dash-input integration-field-input${fieldErrors[f.key] ? ' input-error' : ''}`}
                  type={f.secret && !revealed[f.key] ? 'password' : 'text'}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
                {f.secret && (
                  <button
                    className="integration-reveal-btn"
                    onClick={() => setRevealed((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
                    tabIndex={-1}
                  >
                    {revealed[f.key] ? '🙈' : '👁'}
                  </button>
                )}
              </div>
              {fieldErrors[f.key] && <span className="integration-field-error">{fieldErrors[f.key]}</span>}
            </div>
          ))}

          <div className="integration-modules-label">SKILL MODULES</div>
          <div className="integration-modules-grid">
            {modules.map((m) => {
              const alreadyInstalled = !!installedModules[m.skillFolder]
              const checked = alreadyInstalled || selectedModules[m.id]
              return (
                <button
                  key={m.id}
                  className={`module-chip${checked ? ' module-chip-on' : ''}`}
                  style={checked ? { borderColor: accentColor + '66', background: accentColor + '12' } : {}}
                  onClick={() => { if (!alreadyInstalled) toggleModule(m.id) }}
                  disabled={alreadyInstalled}
                  title={alreadyInstalled ? 'Already installed' : undefined}
                >
                  <span className={`module-chip-dot${checked ? ' module-chip-dot-on' : ''}`} style={checked ? { background: accentColor } : {}} />
                  {m.label}
                  {alreadyInstalled && <span className="module-chip-tick"> ✓</span>}
                </button>
              )
            })}
          </div>

          {error && <p className="form-error">{error}</p>}
          {installing && <p className="form-hint-saving">Installing modules — this may take a moment…</p>}

          <button
            className="dash-btn-primary"
            onClick={handleConnect}
            disabled={installing}
            style={{ marginTop: 14 }}
          >
            {installing ? 'Installing…' : isConnected ? `Update ${label}` : `Connect ${label}`}
          </button>
        </div>
      )}
    </div>
  )
}

function BinanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L7.27 4.73 9.4 6.86 12 4.27l2.6 2.59 2.13-2.13L12 0zM4.73 7.27L2.13 9.87 4.26 12l-2.13 2.13 2.6 2.6 2.13-2.13L9.4 17.14l-2.13 2.13L12 24l4.73-4.73-2.13-2.13L17.14 14.6l2.13 2.13 2.6-2.6L19.74 12l2.13-2.13-2.6-2.6-2.13 2.13L14.6 6.86l2.13-2.13L12 0 4.73 7.27zM12 8.9L15.1 12 12 15.1 8.9 12 12 8.9z"/>
    </svg>
  )
}

function CoinGeckoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm0 2a8 8 0 100 16A8 8 0 0012 4zm-1 4a1 1 0 110 2 1 1 0 010-2zm4 1a1 1 0 110 2 1 1 0 010-2zm-5 3c0-.552.895-1 2-1h2c1.105 0 2 .448 2 1v1c0 1.657-1.343 3-3 3s-3-1.343-3-3v-1z"/>
    </svg>
  )
}

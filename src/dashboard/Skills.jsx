import { useState, useEffect } from 'react'

// ── Agent capability toggles ──────────────────────────────────────────────
const CAPABILITY_SKILLS = [
  { id: 'web_search',   label: 'Web Search',        desc: 'Search the internet for up-to-date info',   icon: '🔍', enabled: true  },
  { id: 'shell',        label: 'Shell / Terminal',   desc: 'Execute shell commands on your machine',    icon: '💻', enabled: true  },
  { id: 'file_manager', label: 'File Manager',       desc: 'Read, write and manage local files',        icon: '📁', enabled: true  },
  { id: 'code_runner',  label: 'Code Runner',        desc: 'Run Python, JS and other code snippets',    icon: '⚡', enabled: false },
  { id: 'browser',      label: 'Browser Automation', desc: 'Control a headless browser for scraping',   icon: '🌐', enabled: false },
  { id: 'memory',       label: 'Long-term Memory',   desc: 'Persist knowledge across sessions',         icon: '🧠', enabled: true  },
]

// ── Integration registry ──────────────────────────────────────────────────
// Each entry has:
//   id, label, desc, Icon, accentColor
//   fields[]        — credential fields shown to user
//   buildEnvVars()  — maps field values → env vars
//   modules[]       — individual SKILL.md files to install
//     { id, label, bundledSkillFile, skillFile, skillKey, defaultOn }
//
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
    // All 12 official skills from github.com/binance/binance-skills-hub
    // assetFile   = path inside assets/skills/ (bundled in app.asar)
    // skillFolder = destination folder name under <workspace>/skills/
    // Official skills from github.com/binance/binance-skills-hub
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
  // ── Add future integrations below ─────────────────────────────────────
  // {
  //   id: 'coingecko', label: 'CoinGecko', ...
  //   modules: [{ id: 'pro', label: 'Pro API', bundledSkillFile: 'coingecko/pro.md', ... }],
  // },
]

// ─────────────────────────────────────────────────────────────────────────────

export default function Skills() {
  const [capabilities, setCapabilities] = useState(CAPABILITY_SKILLS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Map of skillKey → true for each installed module
  const [installedModules, setInstalledModules] = useState({})

  useEffect(() => {
    // read-integration-skills returns { 'binance-spot': true, ... }
    // keyed by skillFolder — just use the key presence directly
    window.electronAPI?.readIntegrationSkills().then((entries) => {
      const installed = {}
      for (const key of Object.keys(entries || {})) {
        installed[key] = true
      }
      setInstalledModules(installed)
    }).catch(() => {})
  }, [])

  const toggleCapability = (id) => {
    setSaved(false)
    setCapabilities((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  const handleSaveCapabilities = async () => {
    setSaving(true)
    const skillMap = Object.fromEntries(capabilities.map((s) => [s.id, { enabled: s.enabled }]))
    await window.electronAPI?.saveSkillsConfig(skillMap)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

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
        <p className="dash-page-sub">Manage agent capabilities and exchange integrations.</p>
      </div>

      {/* ── Capabilities ── */}
      <p className="skills-section-label">CAPABILITIES</p>
      <div className="skills-grid">
        {capabilities.map((skill) => (
          <button
            key={skill.id}
            className={`skill-card${skill.enabled ? ' skill-on' : ''}`}
            onClick={() => toggleCapability(skill.id)}
          >
            <div className="skill-icon">{skill.icon}</div>
            <div className="skill-info">
              <span className="skill-name">{skill.label}</span>
              <span className="skill-desc">{skill.desc}</span>
            </div>
            <div className={`skill-toggle${skill.enabled ? ' toggle-on' : ''}`} />
          </button>
        ))}
      </div>

      <div className="skills-footer">
        <button className="dash-btn-primary" onClick={handleSaveCapabilities} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Capabilities'}
        </button>
      </div>

      {/* ── Integrations ── */}
      <p className="skills-section-label" style={{ marginTop: 32 }}>INTEGRATIONS</p>
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

// ── IntegrationCard ───────────────────────────────────────────────────────────
function IntegrationCard({ skill, installedModules, onModulesInstalled }) {
  const { Icon, label, desc, accentColor, fields, modules, buildEnvVars } = skill

  // A card is "connected" if at least one module slug folder exists in workspace/skills/
  const connectedModuleKeys = modules.filter((m) => installedModules[m.skillFolder]).map((m) => m.skillFolder)
  const isConnected = connectedModuleKeys.length > 0

  const [expanded, setExpanded] = useState(false)

  // Credential field values
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, ''])))
  const [fieldErrors, setFieldErrors] = useState({})
  const [revealed, setRevealed] = useState({})

  // Module selection (default: each module's defaultOn)
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
      {/* Header */}
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

      {/* Expanded form */}
      {expanded && (
        <div className="integration-form">
          {/* Credential fields */}
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

          {/* Module checkboxes */}
          <div className="integration-modules-label">SKILL MODULES</div>
          <div className="integration-modules-grid">
            {modules.map((m) => {
              const alreadyInstalled = !!installedModules[m.skillFolder]
              const checked = alreadyInstalled || selectedModules[m.id]
              return (
                <button
                  key={m.id}
                  className={`module-chip${checked ? ' module-chip-on' : ''}`}
                  onClick={() => { if (!alreadyInstalled) toggleModule(m.id) }}
                  disabled={alreadyInstalled}
                  title={alreadyInstalled ? 'Already installed' : undefined}
                >
                  <span className={`module-chip-dot${checked ? ' module-chip-dot-on' : ''}`} />
                  {m.label}
                  {alreadyInstalled && <span className="module-chip-tick"> ✓</span>}
                </button>
              )
            })}
          </div>

          {error && <p className="form-error">{error}</p>}
          {installing && <p className="form-hint-saving">Installing modules & restarting gateway…</p>}

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

// ── Icons ─────────────────────────────────────────────────────────────────────
function BinanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L7.27 4.73 9.4 6.86 12 4.27l2.6 2.59 2.13-2.13L12 0zM4.73 7.27L2.13 9.87 4.26 12l-2.13 2.13 2.6 2.6 2.13-2.13L9.4 17.14l-2.13 2.13L12 24l4.73-4.73-2.13-2.13L17.14 14.6l2.13 2.13 2.6-2.6L19.74 12l2.13-2.13-2.6-2.6-2.13 2.13L14.6 6.86l2.13-2.13L12 0 4.73 7.27zM12 8.9L15.1 12 12 15.1 8.9 12 12 8.9z"/>
    </svg>
  )
}

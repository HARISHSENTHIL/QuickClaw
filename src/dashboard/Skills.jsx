import { useState, useEffect } from 'react'
import coingeckoImg from '../assets/coingecko.png'

// To add a new exchange: append an entry here + drop SKILL.md into assets/skills/
const INTEGRATION_SKILLS = [
  {
    id: 'binance',
    label: 'Binance',
    desc: 'Spot, derivatives, margin, convert & more',
    Icon: BinanceIcon,
    accentColor: '#F0B90B',
    envVarKeys: ['BINANCE_API_KEY', 'BINANCE_API_SECRET'],
    toolsHeading: '## Binance Accounts',
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
      BINANCE_API_KEY: vals.apiKey.trim(),
      BINANCE_API_SECRET: vals.secretKey.trim(),
    }),
    // Official skills from github.com/binance/binance-skills-hub
    // assetFile = path inside assets/skills/, skillFolder = dest under <workspace>/skills/
    modules: [
      { id: 'spot', label: 'Spot Trading', assetFile: 'binance/spot.md', skillFolder: 'binance-spot', defaultOn: true },
      { id: 'alpha', label: 'Alpha', assetFile: 'binance/alpha.md', skillFolder: 'binance-alpha', defaultOn: true },
      { id: 'assets', label: 'Assets', assetFile: 'binance/assets.md', skillFolder: 'binance-assets', defaultOn: true },
      { id: 'convert', label: 'Convert', assetFile: 'binance/convert.md', skillFolder: 'binance-convert', defaultOn: true },
      { id: 'margin-trading', label: 'Margin Trading', assetFile: 'binance/margin-trading.md', skillFolder: 'binance-margin-trading', defaultOn: true },
      { id: 'derivatives-usds-futures', label: 'USDS Futures', assetFile: 'binance/derivatives-trading-usds-futures.md', skillFolder: 'binance-usds-futures', defaultOn: true },
      { id: 'derivatives-coin-futures', label: 'COIN Futures', assetFile: 'binance/derivatives-trading-coin-futures.md', skillFolder: 'binance-coin-futures', defaultOn: true },
      { id: 'derivatives-options', label: 'Options', assetFile: 'binance/derivatives-trading-options.md', skillFolder: 'binance-options', defaultOn: true },
      { id: 'derivatives-portfolio-margin', label: 'Portfolio Margin', assetFile: 'binance/derivatives-trading-portfolio-margin.md', skillFolder: 'binance-portfolio-margin', defaultOn: true },
      { id: 'derivatives-portfolio-margin-pro', label: 'Portfolio Margin Pro', assetFile: 'binance/derivatives-trading-portfolio-margin-pro.md', skillFolder: 'binance-portfolio-margin-pro', defaultOn: true },
      { id: 'onchain-pay', label: 'On-chain Pay', assetFile: 'binance/onchain-pay.md', skillFolder: 'binance-onchain-pay', defaultOn: true },
      { id: 'square-post', label: 'Square Post', assetFile: 'binance/square-post.md', skillFolder: 'binance-square-post', defaultOn: true },
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
        placeholder: 'Demo or Pro key leave blank for keyless (10 req/min)',
        secret: false,
        validate: (v) => v.trim().length === 0 || v.trim().length >= 10,
        errorMsg: 'Key looks too short',
      },
    ],
    envVarKeys: ['COINGECKO_API_KEY'],
    toolsHeading: '## CoinGecko',
    buildEnvVars: (vals) => ({ COINGECKO_API_KEY: vals.apiKey.trim() }),
    modules: [
      { id: 'core', label: 'Core', assetFile: 'coingecko/core.md', skillFolder: 'coingecko-core', defaultOn: true },
      { id: 'coins', label: 'Coins', assetFile: 'coingecko/coins.md', skillFolder: 'coingecko-coins', defaultOn: true },
      { id: 'global', label: 'Global Market', assetFile: 'coingecko/global.md', skillFolder: 'coingecko-global', defaultOn: true },
      { id: 'categories', label: 'Categories', assetFile: 'coingecko/categories.md', skillFolder: 'coingecko-categories', defaultOn: true },
      { id: 'exchanges', label: 'Exchanges', assetFile: 'coingecko/exchanges.md', skillFolder: 'coingecko-exchanges', defaultOn: true },
      { id: 'coin-history', label: 'Coin History', assetFile: 'coingecko/coin-history.md', skillFolder: 'coingecko-coin-history', defaultOn: true },
      { id: 'coin-supply', label: 'Coin Supply', assetFile: 'coingecko/coin-supply.md', skillFolder: 'coingecko-coin-supply', defaultOn: true },
      { id: 'asset-platforms', label: 'Asset Platforms', assetFile: 'coingecko/asset-platforms.md', skillFolder: 'coingecko-asset-platforms', defaultOn: true },
      { id: 'contract', label: 'Contract', assetFile: 'coingecko/contract.md', skillFolder: 'coingecko-contract', defaultOn: true },
      { id: 'utils', label: 'Utils', assetFile: 'coingecko/utils.md', skillFolder: 'coingecko-utils', defaultOn: true },
      { id: 'derivatives', label: 'Derivatives', assetFile: 'coingecko/derivatives.md', skillFolder: 'coingecko-derivatives', defaultOn: false },
      { id: 'nfts', label: 'NFTs', assetFile: 'coingecko/nfts.md', skillFolder: 'coingecko-nfts', defaultOn: false },
      { id: 'treasury', label: 'Treasury', assetFile: 'coingecko/treasury.md', skillFolder: 'coingecko-treasury', defaultOn: false },
      { id: 'onchain-networks', label: 'On-chain Networks', assetFile: 'coingecko/onchain-networks.md', skillFolder: 'coingecko-onchain-networks', defaultOn: false },
      { id: 'onchain-pools', label: 'On-chain Pools', assetFile: 'coingecko/onchain-pools.md', skillFolder: 'coingecko-onchain-pools', defaultOn: false },
      { id: 'onchain-tokens', label: 'On-chain Tokens', assetFile: 'coingecko/onchain-tokens.md', skillFolder: 'coingecko-onchain-tokens', defaultOn: false },
      { id: 'onchain-categories', label: 'On-chain Categories', assetFile: 'coingecko/onchain-categories.md', skillFolder: 'coingecko-onchain-categories', defaultOn: false },
      { id: 'onchain-ohlcv-trades', label: 'On-chain OHLCV', assetFile: 'coingecko/onchain-ohlcv-trades.md', skillFolder: 'coingecko-onchain-ohlcv-trades', defaultOn: false },
    ],
  },
  {
    id: 'eth',
    label: 'Ethereum',
    desc: 'Smart contracts, DeFi, L2s, gas, wallets & onchain dev',
    Icon: EthereumIcon,
    accentColor: '#627EEA',
    fields: [],
    envVarKeys: ['ETH_SKILLS'],
    toolsHeading: '## ETH Skills',
    buildEnvVars: () => ({ ETH_SKILLS: 'true' }),
    modules: [
      { id: 'ship', label: 'Ship', assetFile: 'eth/ship.md', skillFolder: 'eth-ship', defaultOn: true },
      { id: 'protocol', label: 'Protocol', assetFile: 'eth/protocol.md', skillFolder: 'eth-protocol', defaultOn: true },
      { id: 'gas', label: 'Gas & Costs', assetFile: 'eth/gas.md', skillFolder: 'eth-gas', defaultOn: true },
      { id: 'wallets', label: 'Wallets', assetFile: 'eth/wallets.md', skillFolder: 'eth-wallets', defaultOn: true },
      { id: 'l2s', label: 'Layer 2s', assetFile: 'eth/l2s.md', skillFolder: 'eth-l2s', defaultOn: true },
      { id: 'standards', label: 'Standards', assetFile: 'eth/standards.md', skillFolder: 'eth-standards', defaultOn: true },
      { id: 'tools', label: 'Tools', assetFile: 'eth/tools.md', skillFolder: 'eth-tools', defaultOn: true },
      { id: 'building-blocks', label: 'Money Legos', assetFile: 'eth/building-blocks.md', skillFolder: 'eth-building-blocks', defaultOn: true },
      { id: 'security', label: 'Security', assetFile: 'eth/security.md', skillFolder: 'eth-security', defaultOn: true },
      { id: 'addresses', label: 'Addresses', assetFile: 'eth/addresses.md', skillFolder: 'eth-addresses', defaultOn: true },
      { id: 'testing', label: 'Testing', assetFile: 'eth/testing.md', skillFolder: 'eth-testing', defaultOn: false },
      { id: 'indexing', label: 'Indexing', assetFile: 'eth/indexing.md', skillFolder: 'eth-indexing', defaultOn: false },
      { id: 'frontend-ux', label: 'Frontend UX', assetFile: 'eth/frontend-ux.md', skillFolder: 'eth-frontend-ux', defaultOn: false },
      { id: 'frontend-playbook', label: 'Frontend Playbook', assetFile: 'eth/frontend-playbook.md', skillFolder: 'eth-frontend-playbook', defaultOn: false },
      { id: 'orchestration', label: 'Orchestration', assetFile: 'eth/orchestration.md', skillFolder: 'eth-orchestration', defaultOn: false },
      { id: 'concepts', label: 'Concepts', assetFile: 'eth/concepts.md', skillFolder: 'eth-concepts', defaultOn: false },
      { id: 'why', label: 'Why Ethereum', assetFile: 'eth/why.md', skillFolder: 'eth-why', defaultOn: false },
      { id: 'qa', label: 'QA', assetFile: 'eth/qa.md', skillFolder: 'eth-qa', defaultOn: false },
      { id: 'audit', label: 'Audit', assetFile: 'eth/audit.md', skillFolder: 'eth-audit', defaultOn: false },
    ],
  },
  {
    id: 'okx',
    label: 'OKX',
    desc: 'DEX swaps, DeFi, wallet, on-chain analytics & security',
    Icon: OkxIcon,
    accentColor: '#0066FF',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'Your OKX API Key',
        secret: false,
        validate: (v) => v.trim().length >= 20,
        errorMsg: 'API key looks too short',
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        placeholder: 'Your OKX Secret Key',
        secret: true,
        validate: (v) => v.trim().length >= 20,
        errorMsg: 'Secret key looks too short',
      },
      {
        key: 'passphrase',
        label: 'Passphrase',
        placeholder: 'Your OKX API Passphrase',
        secret: true,
        validate: (v) => v.trim().length >= 1,
        errorMsg: 'Passphrase is required',
      },
    ],
    envVarKeys: ['OKX_API_KEY', 'OKX_SECRET_KEY', 'OKX_PASSPHRASE'],
    toolsHeading: '## OKX Account',
    buildEnvVars: (vals) => ({
      OKX_API_KEY: vals.apiKey.trim(),
      OKX_SECRET_KEY: vals.secretKey.trim(),
      OKX_PASSPHRASE: vals.passphrase.trim(),
    }),
    modules: [
      { id: 'agentic-wallet', label: 'Wallet', assetFile: 'okx/agentic-wallet.md', skillFolder: 'okx-agentic-wallet', defaultOn: true },
      { id: 'dex-swap', label: 'DEX Swap', assetFile: 'okx/dex-swap.md', skillFolder: 'okx-dex-swap', defaultOn: true },
      { id: 'dex-market', label: 'DEX Market', assetFile: 'okx/dex-market.md', skillFolder: 'okx-dex-market', defaultOn: true },
      { id: 'dex-token', label: 'Token Data', assetFile: 'okx/dex-token.md', skillFolder: 'okx-dex-token', defaultOn: true },
      { id: 'security', label: 'Security', assetFile: 'okx/security.md', skillFolder: 'okx-security', defaultOn: true },
      { id: 'wallet-portfolio', label: 'Portfolio', assetFile: 'okx/wallet-portfolio.md', skillFolder: 'okx-wallet-portfolio', defaultOn: true },
      { id: 'onchain-gateway', label: 'Onchain Gateway', assetFile: 'okx/onchain-gateway.md', skillFolder: 'okx-onchain-gateway', defaultOn: true },
      { id: 'defi-invest', label: 'DeFi Invest', assetFile: 'okx/defi-invest.md', skillFolder: 'okx-defi-invest', defaultOn: false },
      { id: 'defi-portfolio', label: 'DeFi Portfolio', assetFile: 'okx/defi-portfolio.md', skillFolder: 'okx-defi-portfolio', defaultOn: false },
      { id: 'dex-signal', label: 'DEX Signals', assetFile: 'okx/dex-signal.md', skillFolder: 'okx-dex-signal', defaultOn: false },
      { id: 'dex-trenches', label: 'Trenches', assetFile: 'okx/dex-trenches.md', skillFolder: 'okx-dex-trenches', defaultOn: false },
      { id: 'audit-log', label: 'Audit Log', assetFile: 'okx/audit-log.md', skillFolder: 'okx-audit-log', defaultOn: false },
      { id: 'x402-payment', label: 'x402 Payment', assetFile: 'okx/x402-payment.md', skillFolder: 'okx-x402-payment', defaultOn: false },
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
    }).catch(() => { })
  }, [])

  const handleModulesInstalled = (moduleKeys) => {
    setInstalledModules((prev) => {
      const next = { ...prev }
      moduleKeys.forEach((k) => { next[k] = true })
      return next
    })
  }

  const handleModulesDeleted = (moduleKeys) => {
    setInstalledModules((prev) => {
      const next = { ...prev }
      moduleKeys.forEach((k) => { delete next[k] })
      return next
    })
  }

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <p className="dash-page-label">AGENT</p>
        <h1 className="dash-page-title">Skills</h1>
        <p className="dash-page-sub">Connect integrations to extend the agent.</p>
      </div>

      <p className="skills-section-label">INTEGRATIONS</p>
      <div className="integration-list">
        {INTEGRATION_SKILLS.map((skill) => (
          <IntegrationCard
            key={skill.id}
            skill={skill}
            installedModules={installedModules}
            onModulesInstalled={handleModulesInstalled}
            onModulesDeleted={handleModulesDeleted}
          />
        ))}
      </div>
    </div>
  )
}

function IntegrationCard({ skill, installedModules, onModulesInstalled, onModulesDeleted }) {
  const { Icon, label, desc, accentColor, fields, modules, buildEnvVars, envVarKeys, toolsHeading } = skill

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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    const result = await window.electronAPI?.resetIntegrationSkill({
      envVarKeys,
      toolsHeading,
      skillFolders: modules.map((m) => m.skillFolder),
    })
    setDeleting(false)
    if (result?.success) {
      onModulesDeleted(modules.map((m) => m.skillFolder))
      setConfirmDelete(false)
      setExpanded(false)
    } else {
      setError(result?.error || 'Failed to remove integration')
      setConfirmDelete(false)
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
            <button
              className="integration-connect-btn app-connect-btn-danger"
              onClick={() => { setConfirmDelete(true); setExpanded(true); setError(null) }}
              disabled={deleting}
            >
              REMOVE
            </button>
          </div>
        ) : (
          <button className="integration-connect-btn" onClick={() => { setExpanded((v) => !v); setError(null) }}>
            {expanded ? 'CANCEL' : 'CONNECT'}
          </button>
        )}
      </div>

      {expanded && confirmDelete && (
        <div className="integration-form">
          <p className="form-hint-warn">
            This will remove all {label} API keys and skill modules. The agent will lose access to {label} immediately.
          </p>
          {error && <p className="form-error">{error}</p>}
          <div className="form-row" style={{ marginTop: 10 }}>
            <button
              className="dash-btn-primary dash-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Removing…' : 'Confirm Remove'}
            </button>
            <button
              className="integration-connect-btn"
              onClick={() => { setConfirmDelete(false); setExpanded(false); setError(null) }}
              disabled={deleting}
            >
              CANCEL
            </button>
          </div>
          {deleting && <p className="form-hint-saving">Removing keys and restarting gateway…</p>}
        </div>
      )}

      {expanded && !confirmDelete && (
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
                    aria-label={revealed[f.key] ? 'Hide' : 'Show'}
                  >
                    {revealed[f.key] ? <EyeOffIcon /> : <EyeIcon />}
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
          {installing && <p className="form-hint-saving">Installing modules this may take a moment…</p>}

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


function EthereumIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2L6 16.5l10 5.9 10-5.9z" opacity="0.9" />
      <path d="M6 16.5l10 5.9v-20.4z" opacity="0.6" />
      <path d="M16 22.4L6 16.5l10 13.5z" opacity="0.9" />
      <path d="M16 30L26 16.5 16 22.4z" opacity="0.6" />
      <path d="M16 22.4l10-5.9-10-5.9z" opacity="0.4" />
      <path d="M6 16.5l10-5.9v11.8z" opacity="0.4" />
    </svg>
  )
}

function BinanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z" />
    </svg>
  )
}

function CoinGeckoIcon() {
  return (
    <img src={coingeckoImg} alt="CoinGecko" style={{ width: 22, height: 22, objectFit: 'contain' }} />
  )
}

function OkxIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.15 8.685C7.18 8.705 7.2 8.745 7.2 8.785v6.44c0 .04-.02.08-.05.1-.029.03-.068.047-.11.05H.16c-.042-.003-.081-.02-.11-.05C.02 15.3.002 15.264 0 15.225V8.785c0-.04.02-.08.05-.1.029-.03.068-.047.11-.05h6.88c.04 0 .08.02.11.05zM4.8 11.035c-.002-.039-.02-.075-.05-.1-.029-.03-.068-.048-.11-.05H2.56c-.04 0-.079.014-.11.04-.03.025-.048.061-.05.1v1.95c0 .04.02.08.05.1.03.04.07.05.11.05h2.08c.04 0 .08-.01.11-.04.03-.025.048-.061.05-.1v-1.95zm16.8 0v1.94c0 .09-.07.15-.16.15h-2.08c-.09 0-.16-.06-.16-.15v-1.94c0-.08.07-.15.16-.15h2.08c.09 0 .16.06.16.15zM19.2 8.785v1.95c0 .08-.07.15-.16.15h-2.08c-.09 0-.16-.07-.16-.15V8.785c0-.08.07-.15.16-.15h2.08c.09 0 .16.07.16.15zM24 8.785v1.95c0 .08-.07.15-.16.15h-2.08c-.09 0-.16-.07-.16-.15V8.785c0-.08.07-.15.16-.15h2.08c.09 0 .16.07.16.15zm-4.8 4.5v1.94c0 .08-.07.15-.16.15h-2.08c-.09 0-.16-.07-.16-.15v-1.95c0-.08.07-.15.16-.15h2.08c.09 0 .16.07.16.15v.01zM24 13.285v1.94c0 .08-.07.15-.16.15h-2.08c-.09 0-.16-.07-.16-.15v-1.95c0-.08.07-.15.16-.15h2.08c.09 0 .16.07.16.15v.01zM15.6 8.785v1.95c0 .08-.07.15-.16.15h-2.08c-.09 0-.16-.07-.16-.15V8.785c0-.08.07-.15.16-.15h2.08c.09 0 .16.07.16.15zm0 4.5v1.94c0 .08-.07.15-.16.15h-2.08c-.09 0-.16-.07-.16-.15v-1.95c0-.08.07-.15.16-.15h2.08c.09 0 .16.07.16.15v.01zM13.2 12.985c-.005.084-.075.15-.16.15H10.8v2.08c0 .04-.02.08-.05.11-.031.026-.07.04-.11.04H8.56c-.044.003-.087-.012-.12-.04-.026-.027-.041-.063-.04-.1V8.775c0-.04.01-.08.04-.1.032-.032.075-.05.12-.05h2.08c.04 0 .08.02.11.05.03.02.05.06.05.1v2.1h2.24c.04 0 .08.01.11.04.03.03.05.07.05.1v1.95l-.04.02z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M10.73 10.73a3 3 0 0 0 4.24 4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

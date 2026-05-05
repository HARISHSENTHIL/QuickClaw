const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const http = require('http')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Shell PATH resolution ──────────────────────────────────────────────────
// macOS GUI apps are launched by launchd, not a shell — they inherit only
// /usr/bin:/bin:/usr/sbin:/sbin. nvm, Homebrew, volta, asdf, etc. are all
// invisible. This is the root cause of every "npm not found" / EACCES error.
//
// Fix: run the user's own login shell once at startup to get their real PATH.
// VS Code, Hyper, and all professional Electron apps use this exact pattern.
// We cache the result — shell startup (especially nvm) can take 200-800ms.
let _shellPath = null
function resolveShellPath() {
  if (_shellPath !== null) return _shellPath
  if (process.platform !== 'darwin') return (_shellPath = '')
  const shell = process.env.SHELL || '/bin/zsh'
  const isFish = shell.endsWith('/fish')
  // -l = login shell (reads ~/.zprofile, ~/.bash_profile)
  // -i = interactive (also reads ~/.zshrc, ~/.bashrc) — skip for fish to avoid prompt bleed
  const cmd = 'echo -n "|P|"; printf "%s" "$PATH"; echo -n "|P|"'
  const args = isFish ? ['-lc', cmd] : ['-ilc', cmd]
  for (const sh of [shell, '/bin/zsh', '/bin/bash']) {
    try {
      const out = require('child_process').execFileSync(sh, args, {
        encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
      })
      const m = out.match(/\|P\|(.*?)\|P\|/s)
      if (m?.[1]?.trim()) return (_shellPath = m[1].trim())
    } catch {}
  }
  return (_shellPath = '')
}

// Builds a PATH-rich env that resolves openclaw regardless of install method.
// Combines: real shell PATH (from user's login shell) + known static fallbacks.
function buildEnv(extra = {}) {
  const home = os.homedir()
  const brewPrefix = fs.existsSync('/opt/homebrew') ? '/opt/homebrew' : '/usr/local'

  const knownBins = [
    `${brewPrefix}/bin`, `${brewPrefix}/sbin`,
    '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
    `${home}/.local/bin`, `${home}/.npm-global/bin`,
  ]

  const nvmDir = path.join(home, '.nvm', 'versions', 'node')
  if (fs.existsSync(nvmDir)) {
    try {
      fs.readdirSync(nvmDir).sort().reverse()
        .forEach((v) => knownBins.push(path.join(nvmDir, v, 'bin')))
    } catch {}
  }

  const shellBins = resolveShellPath().split(':').filter(Boolean)
  const inherited = (process.env.PATH || '').split(':').filter(Boolean)
  return {
    ...process.env,
    HOME: home,
    TERM: 'xterm-256color',
    // Shell PATH first (user's real env) → static fallbacks → inherited Electron PATH
    PATH: [...new Set([...shellBins, ...knownBins, ...inherited])].join(':'),
    // Prevent brew from triggering sudo checks and slow auto-updates
    HOMEBREW_NO_AUTO_UPDATE: '1',
    HOMEBREW_NO_ENV_HINTS: '1',
    ...extra,
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800, height: 620,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ── Auto-updater ───────────────────────────────────────────────────────────
function setupAutoUpdater() {
  // Silent background check — never pop native dialogs; let the UI handle it
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    const [win] = BrowserWindow.getAllWindows()
    if (win && !win.isDestroyed()) win.webContents.send('update-available', info)
  })

  autoUpdater.on('update-downloaded', (info) => {
    const [win] = BrowserWindow.getAllWindows()
    if (win && !win.isDestroyed()) win.webContents.send('update-downloaded', info)
  })

  autoUpdater.on('error', () => {})

  // Check after a short delay so the window is fully loaded first
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000)
}

ipcMain.on('install-update', () => autoUpdater.quitAndInstall(false, true))

app.whenReady().then(() => {
  // Warm the shell PATH cache before any install or gateway spawn.
  // Runs the user's login shell once (~200-800ms) to get their real PATH
  // (nvm, Homebrew, volta, asdf, etc.) — cached for the app's lifetime.
  resolveShellPath()
  createWindow()
  // Register activate inside whenReady — prevents the race condition where
  // activate fires before the app is ready (reproducible when running from DMG)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  if (!isDev) setupAutoUpdater()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── Installer ──────────────────────────────────────────────────────────────
ipcMain.on('run-install', (event, { provider, model, apiKey }) => {
  const scriptPath = isDev
    ? path.join(__dirname, '../assets/openclaw-install.sh')
    : path.join(process.resourcesPath, 'openclaw-install.sh')

  if (!fs.existsSync(scriptPath)) {
    event.reply('install-log', `[ERR ] Script not found at: ${scriptPath}`)
    event.reply('install-done', { success: false })
    return
  }

  // Copy to writable temp dir — source may be on read-only filesystem (DMG/app bundle)
  const tmpScript = path.join(os.tmpdir(), 'octoclaw-install.sh')
  fs.copyFileSync(scriptPath, tmpScript)
  fs.chmodSync(tmpScript, '755')

  const providerModelMap = {
    openai: `openai/${model}`, anthropic: `anthropic/${model}`,
    google: `google/${model}`, mistral: `mistral/${model}`,
    groq: `groq/${model}`, cohere: `cohere/${model}`,
    together: `together/${model}`, openrouter: model, ollama: `ollama/${model}`,
  }

  const child = spawn('/bin/bash', [tmpScript], {
    env: buildEnv({
      OPENCLAW_API_KEY: apiKey,
      OPENCLAW_PROVIDER: provider,
      OPENCLAW_MODEL: providerModelMap[provider] || model,
    }),
    shell: false,
  })

  // Kill after 8 minutes — prevents infinite hang if gateway commands block
  const killTimer = setTimeout(() => { try { child.kill('SIGTERM') } catch {} }, 8 * 60 * 1000)

  child.stdout.on('data', (data) => {
    data.toString().split('\n').forEach((line) => {
      if (line.trim()) event.reply('install-log', line)
    })
  })
  child.stderr.on('data', (data) => {
    data.toString().split('\n').forEach((line) => {
      if (line.trim()) event.reply('install-log', `[stderr] ${line}`)
    })
  })
  child.on('close', (code) => {
    clearTimeout(killTimer)
    event.reply('install-done', { success: code === 0, code })
  })
  child.on('error', (err) => {
    clearTimeout(killTimer)
    event.reply('install-log', `[ERR ] ${err.message}`)
    event.reply('install-done', { success: false })
  })
})

ipcMain.on('open-url', (_, url) => shell.openExternal(url))

ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.on('resize-window', (_, { width, height }) => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    win.setResizable(true)
    win.setMinimumSize(900, 620)
    win.setSize(width, height, true)
    win.center()
  }
})

ipcMain.handle('check-installed', async () => {
  try {
    const home = os.homedir()
    const configPath = path.join(home, '.openclaw', 'openclaw.json')
    const envPath    = path.join(home, '.openclaw', '.env')
    if (!fs.existsSync(configPath) || !fs.existsSync(envPath)) return null
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const model  = config?.agents?.defaults?.model?.primary || 'openai/gpt-4o'
    const slash  = model.indexOf('/')
    return {
      provider: slash > -1 ? model.slice(0, slash) : 'openai',
      model:    slash > -1 ? model.slice(slash + 1) : model,
    }
  } catch { return null }
})

// ── Auth repair ────────────────────────────────────────────────────────────
// `openclaw gateway install` wipes auth-profiles.json.
// Correct format: object (NOT array), type "api_key" (underscore), field "key" (NOT "apiKey")
function repairAuthProfiles() {
  try {
    const home    = os.homedir()
    const envText = fs.readFileSync(path.join(home, '.openclaw', '.env'), 'utf8')
    const apiKey  = envText.match(/OPENCLAW_API_KEY=(.+)/)?.[1]?.trim()
    const config  = JSON.parse(fs.readFileSync(path.join(home, '.openclaw', 'openclaw.json'), 'utf8'))
    const provider = (config?.agents?.defaults?.model?.primary || 'openai/gpt-4o').split('/')[0]

    const authStore = provider === 'ollama'
      ? { version: 1, profiles: { 'ollama-default': { type: 'token', provider: 'ollama', token: 'ollama' } } }
      : apiKey
        ? { version: 1, profiles: { [`${provider}-default`]: { type: 'api_key', provider, key: apiKey } } }
        : null

    if (!authStore) return

    // Ensure state dir and config have correct permissions every time we repair.
    // Default umask gives 755/644 — doctor flags those and gateway auth fails silently.
    try { fs.chmodSync(path.join(home, '.openclaw'), 0o700) } catch {}
    try { fs.chmodSync(path.join(home, '.openclaw', 'openclaw.json'), 0o600) } catch {}

    for (const loc of [
      path.join(home, '.openclaw', 'auth-profiles.json'),
      path.join(home, '.openclaw', 'agents', 'main', 'auth-profiles.json'),
      path.join(home, '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json'),
    ]) {
      try {
        fs.mkdirSync(path.dirname(loc), { recursive: true })
        fs.writeFileSync(loc, JSON.stringify(authStore, null, 2))
        fs.chmodSync(loc, 0o600)
      } catch {}
    }
  } catch {}
}

// ── Gateway helpers ────────────────────────────────────────────────────────
function probeGateway() {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port: 18789, path: '/', timeout: 800 }, () => resolve(true))
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

async function pollGateway(attempts = 20, intervalMs = 600) {
  for (let i = 0; i < attempts; i++) {
    if (await probeGateway()) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

// Ensures exactly one gateway instance — always stop before start to prevent
// two instances running simultaneously (causes Telegram 409 conflict loop).
// In-flight promise shared so concurrent calls collapse into one operation.
let ensureGatewayInFlight = null
ipcMain.handle('ensure-gateway', () => {
  if (ensureGatewayInFlight) return ensureGatewayInFlight
  ensureGatewayInFlight = _ensureGateway().finally(() => { ensureGatewayInFlight = null })
  return ensureGatewayInFlight
})

// Sends a stage label to the renderer so Chat can show live progress
// instead of a frozen "Starting gateway…" for up to 40 s.
function emitGatewayStage(msg) {
  const [win] = BrowserWindow.getAllWindows()
  if (win && !win.isDestroyed()) win.webContents.send('gateway-stage', msg)
}

// Notifies Chat that the gateway is restarting (show loader) or ready (hide loader).
function emitGatewayRestart(state, msg) {
  const [win] = BrowserWindow.getAllWindows()
  if (win && !win.isDestroyed()) win.webContents.send('gateway-restart', { state, msg })
}

async function _ensureGateway() {
  emitGatewayStage('Checking gateway…')
  if (await probeGateway()) {
    repairAuthProfiles()
    return { success: true }
  }

  // Gateway didn't respond to the single probe — it may still be starting up
  // (common right after a fresh install). Poll briefly before stopping it.
  emitGatewayStage('Waiting for gateway…')
  if (await pollGateway(5, 800)) {
    repairAuthProfiles()
    return { success: true }
  }

  const env = buildEnv()
  const run = (args, detach = false) => new Promise((resolve) => {
    const opts = { env, shell: false, stdio: 'ignore' }
    if (detach) opts.detached = true
    const child = spawn('openclaw', args, opts)
    if (detach) child.unref()
    let err = null
    child.on('error', (e) => { err = e; resolve(e) })
    child.on('close', () => resolve(err))
    setTimeout(() => resolve(null), detach ? 2000 : 6000)
  })

  emitGatewayStage('Stopping previous instance…')
  await run(['gateway', 'stop'])
  await new Promise((r) => setTimeout(r, 2000))

  emitGatewayStage('Starting gateway…')
  const startErr = await run(['gateway', 'start'], true)
  if (startErr?.code === 'ENOENT') return { success: false, error: 'BINARY_NOT_FOUND' }

  // Poll up to 9 s — slow machines (e.g. M1 with many login items) need 5-8 s.
  // Old value was 5 × 600 ms = 3 s which triggered unnecessary reinstall on every open.
  emitGatewayStage('Waiting for gateway to be ready…')
  if (await pollGateway(15, 600)) return { success: true }

  // Service not installed — install LaunchAgent, repair auth, restart
  emitGatewayStage('Installing gateway service…')
  await run(['gateway', 'stop'])
  await new Promise((r) => setTimeout(r, 1500))
  await run(['gateway', 'install'])
  repairAuthProfiles()

  emitGatewayStage('Starting gateway service…')
  await run(['gateway', 'start'], true)

  emitGatewayStage('Almost ready…')
  return { success: await pollGateway(15, 800) }
}

// Single 300ms probe — used by Chat for optimistic render (non-blocking)
ipcMain.handle('probe-gateway', () => {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port: 18789, path: '/', timeout: 300 }, () => resolve(true))
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
})

ipcMain.handle('read-gateway-token', async () => {
  try {
    const content = fs.readFileSync(path.join(os.homedir(), '.openclaw', '.env'), 'utf8')
    return content.match(/OPENCLAW_GATEWAY_TOKEN=(.+)/)?.[1]?.trim() || null
  } catch { return null }
})

ipcMain.handle('read-config', async () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.openclaw', 'openclaw.json'), 'utf8'))
  } catch { return null }
})

// Telegram: channels.telegram key (not integrations.telegram).
// dmPolicy "open" + allowFrom ["*"] required — without them openclaw silently skips the poller.
ipcMain.handle('save-telegram-config', async (_, { botToken }) => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    let config = {}
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch {}
    config.channels = config.channels || {}
    config.channels.telegram = { botToken, dmPolicy: 'open', allowFrom: ['*'] }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

    emitGatewayRestart('restarting', 'Applying Telegram config…')
    const env = buildEnv()
    await new Promise((resolve) => {
      const child = spawn('openclaw', ['gateway', 'restart'], { env, shell: false, stdio: 'ignore' })
      child.on('close', resolve)
      child.on('error', resolve)
      setTimeout(resolve, 6000)
    })
    repairAuthProfiles()
    await pollGateway(10, 500)
    emitGatewayRestart('ready')
    return { success: true }
  } catch (err) { emitGatewayRestart('ready'); return { success: false, error: err.message } }
})

// Removes channels.telegram from openclaw.json and restarts gateway.
ipcMain.handle('reset-telegram-config', async () => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    let config = {}
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch {}
    if (config.channels) delete config.channels.telegram
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    emitGatewayRestart('restarting', 'Removing Telegram config…')
    const env = buildEnv()
    await new Promise((resolve) => {
      const child = spawn('openclaw', ['gateway', 'restart'], { env, shell: false, stdio: 'ignore' })
      child.on('close', resolve)
      child.on('error', resolve)
      setTimeout(resolve, 6000)
    })
    repairAuthProfiles()
    await pollGateway(10, 500)
    emitGatewayRestart('ready')
    return { success: true }
  } catch (err) { emitGatewayRestart('ready'); return { success: false, error: err.message } }
})

// Skills UI prefs stored separately — openclaw.json rejects unknown keys and
// openclaw doctor --fix removes them.
ipcMain.handle('save-skills-config', async (_, skills) => {
  try {
    const prefsPath = path.join(os.homedir(), '.openclaw', 'octoclaw-prefs.json')
    let prefs = {}
    try { prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8')) } catch {}
    prefs.skills = skills
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2))
    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
})

// Reads bundled SKILL.md files from app.asar (app.getAppPath() works in dev + prod).
// Writes each skill as a folder into <workspace>/skills/<skillFolder>/.
// Also upserts .env and writes credentials to TOOLS.md so agent reads them automatically.
// Restarts gateway via `gateway restart` so new .env credentials take effect.
// Skills themselves are hot-reloaded by the watcher; restart is for env vars only.
ipcMain.handle('install-integration-skill', async (_, { modules, envVars }) => {
  try {
    const home = os.homedir()

    let workspace = path.join(home, '.openclaw', 'workspace')
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(home, '.openclaw', 'openclaw.json'), 'utf8'))
      workspace = cfg?.agents?.defaults?.workspace || workspace
    } catch {}

    const skillsDir = path.join(workspace, 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })

    const appRoot = app.getAppPath()

    for (const mod of modules) {
      const content  = fs.readFileSync(path.join(appRoot, 'assets', 'skills', mod.assetFile), 'utf8')
      const skillDir = path.join(skillsDir, mod.skillFolder)
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8')
      fs.writeFileSync(path.join(skillDir, '_meta.json'), JSON.stringify({
        slug: mod.skillFolder, version: '1.0.0', installedAt: Date.now(), source: mod.source || 'octoclaw',
      }, null, 2))
    }

    // Write credentials to TOOLS.md — agents read this automatically on session start
    const toolsPath = path.join(workspace, 'TOOLS.md')
    let toolsContent = ''
    try { toolsContent = fs.readFileSync(toolsPath, 'utf8') } catch {}

    const upsertSection = (content, heading, section) => {
      const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return content.includes(heading)
        ? content.replace(new RegExp(`${escaped}[\\s\\S]*?(?=\\n## |\\n*$)`), section)
        : content.trimEnd() + '\n\n' + section
    }

    if (envVars.BINANCE_API_KEY && envVars.BINANCE_API_SECRET) {
      const section = `## Binance Accounts\n\n### main\n- API Key: ${envVars.BINANCE_API_KEY}\n- Secret: ${envVars.BINANCE_API_SECRET}\n- Testnet: false\n- Description: Primary trading account\n`
      toolsContent = upsertSection(toolsContent, '## Binance Accounts', section)
    }

    if ('COINGECKO_API_KEY' in envVars) {
      const key  = envVars.COINGECKO_API_KEY
      const tier = !key ? 'Keyless' : key.startsWith('CG-') ? 'Pro' : 'Demo'
      const base = tier === 'Pro' ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3'
      const section = `## CoinGecko\n\n- API Key: ${key || 'none (keyless mode)'}\n- Tier: ${tier}\n- Base URL: ${base}\n`
      toolsContent = upsertSection(toolsContent, '## CoinGecko', section)
    }

    if (envVars.OKX_API_KEY && envVars.OKX_SECRET_KEY && envVars.OKX_PASSPHRASE) {
      const section = `## OKX Account\n\n- API Key: ${envVars.OKX_API_KEY}\n- Secret Key: ${envVars.OKX_SECRET_KEY}\n- Passphrase: ${envVars.OKX_PASSPHRASE}\n`
      toolsContent = upsertSection(toolsContent, '## OKX Account', section)
    }

    if (envVars.ETH_SKILLS) {
      const section = `## ETH Skills\n\n- Access: https://ethskills.com\n- Fetch any topic: curl -s https://ethskills.com/<topic>/SKILL.md\n- Installed topics: ship, protocol, gas, wallets, l2s, standards, tools, building-blocks, security, addresses, testing, indexing, frontend-ux, frontend-playbook, orchestration, concepts, why, qa, audit\n- Requires: curl\n`
      toolsContent = upsertSection(toolsContent, '## ETH Skills', section)
    }

    if (toolsContent.trim()) {
      fs.writeFileSync(toolsPath, toolsContent, 'utf8')
      fs.chmodSync(toolsPath, 0o600)
    }

    // Write API credentials to ~/.openclaw/.env so the gateway process has them
    // as actual env vars at startup. TOOLS.md tells the LLM what keys exist;
    // .env is what the skill execution layer uses to sign API requests.
    // Without this step the agent falls back to fetching data from the internet.
    const envPath = path.join(home, '.openclaw', '.env')
    let envContent = ''
    try { envContent = fs.readFileSync(envPath, 'utf8') } catch {}
    for (const [key, value] of Object.entries(envVars)) {
      if (!value) continue
      const re = new RegExp(`^${key}=.*$`, 'm')
      if (re.test(envContent)) {
        envContent = envContent.replace(re, `${key}=${value}`)
      } else {
        envContent = envContent.trimEnd() + `\n${key}=${value}\n`
      }
    }
    fs.writeFileSync(envPath, envContent, 'utf8')
    fs.chmodSync(envPath, 0o600)

    // Restart gateway so new .env credentials take effect.
    // Skills themselves hot-reload via the watcher; restart is only needed for env vars.
    emitGatewayRestart('restarting', 'Activating skills…')
    const env = buildEnv()
    await new Promise((resolve) => {
      const child = spawn('openclaw', ['gateway', 'restart'], { env, shell: false, stdio: 'ignore' })
      child.on('close', resolve)
      child.on('error', resolve)
      setTimeout(resolve, 8000)
    })
    repairAuthProfiles()
    await pollGateway(10, 500)
    emitGatewayRestart('ready')

    return { success: true }
  } catch (err) { emitGatewayRestart('ready'); return { success: false, error: err.message } }
})

// Scans all gateway skill directories (same precedence order as openclaw gateway).
// Detects skills installed by our app (_meta.json) and by CLI/ClawHub (SKILL.md only).
ipcMain.handle('reset-integration-skill', async (_, { envVarKeys, toolsHeading, skillFolders }) => {
  try {
    const home = os.homedir()
    let workspace = path.join(home, '.openclaw', 'workspace')
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(home, '.openclaw', 'openclaw.json'), 'utf8'))
      workspace = cfg?.agents?.defaults?.workspace || workspace
    } catch {}

    // Remove skill folders
    const skillsDir = path.join(workspace, 'skills')
    for (const folder of skillFolders) {
      try { fs.rmSync(path.join(skillsDir, folder), { recursive: true, force: true }) } catch {}
    }

    // Remove section from TOOLS.md
    const toolsPath = path.join(workspace, 'TOOLS.md')
    try {
      let content = fs.readFileSync(toolsPath, 'utf8')
      const escaped = toolsHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      content = content.replace(new RegExp(`${escaped}[\\s\\S]*?(?=\\n## |\\n*$)`), '').trimEnd()
      if (content.trim()) {
        fs.writeFileSync(toolsPath, content + '\n', 'utf8')
      } else {
        try { fs.unlinkSync(toolsPath) } catch {}
      }
    } catch {}

    // Remove env vars from .env
    const envPath = path.join(home, '.openclaw', '.env')
    try {
      let envContent = fs.readFileSync(envPath, 'utf8')
      for (const key of envVarKeys) {
        envContent = envContent.replace(new RegExp(`^${key}=.*\\n?`, 'm'), '')
      }
      fs.writeFileSync(envPath, envContent.trimEnd() + '\n', 'utf8')
    } catch {}

    // Restart gateway so env changes take effect
    emitGatewayRestart('restarting', 'Removing integration…')
    const env = buildEnv()
    await new Promise((resolve) => {
      const child = spawn('openclaw', ['gateway', 'restart'], { env, shell: false, stdio: 'ignore' })
      child.on('close', resolve)
      child.on('error', resolve)
      setTimeout(resolve, 6000)
    })
    repairAuthProfiles()
    await pollGateway(10, 500)
    emitGatewayRestart('ready')
    return { success: true }
  } catch (err) { emitGatewayRestart('ready'); return { success: false, error: err.message } }
})

// Full factory reset: wipes telegram config, all integration keys (TOOLS.md + .env),
// all integration skill folders, then restarts gateway.
ipcMain.handle('factory-reset', async () => {
  try {
    const home = os.homedir()

    // Remove telegram from openclaw.json
    const configPath = path.join(home, '.openclaw', 'openclaw.json')
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      if (config.channels) delete config.channels.telegram
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    } catch {}

    // Resolve workspace
    let workspace = path.join(home, '.openclaw', 'workspace')
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      workspace = cfg?.agents?.defaults?.workspace || workspace
    } catch {}

    // Remove all integration skill folders (binance-*, coingecko-*, okx-*)
    const skillsDir = path.join(workspace, 'skills')
    const integrationPrefixes = ['binance-', 'coingecko-', 'okx-']
    try {
      for (const entry of fs.readdirSync(skillsDir)) {
        if (integrationPrefixes.some((p) => entry.startsWith(p))) {
          try { fs.rmSync(path.join(skillsDir, entry), { recursive: true, force: true }) } catch {}
        }
      }
    } catch {}

    // Wipe TOOLS.md entirely
    const toolsPath = path.join(workspace, 'TOOLS.md')
    try { fs.unlinkSync(toolsPath) } catch {}

    // Remove all integration env vars from .env
    const allIntegrationKeys = [
      'BINANCE_API_KEY', 'BINANCE_API_SECRET',
      'COINGECKO_API_KEY',
      'OKX_API_KEY', 'OKX_SECRET_KEY', 'OKX_PASSPHRASE',
    ]
    const envPath = path.join(home, '.openclaw', '.env')
    try {
      let envContent = fs.readFileSync(envPath, 'utf8')
      for (const key of allIntegrationKeys) {
        envContent = envContent.replace(new RegExp(`^${key}=.*\\n?`, 'm'), '')
      }
      fs.writeFileSync(envPath, envContent.trimEnd() + '\n', 'utf8')
    } catch {}

    // Clear chat sessions
    const sessionsDir = path.join(home, '.openclaw', 'agents', 'main', 'sessions')
    try {
      for (const entry of fs.readdirSync(sessionsDir)) {
        try { fs.rmSync(path.join(sessionsDir, entry), { recursive: true, force: true }) } catch {}
      }
    } catch {}

    // Restart gateway
    emitGatewayRestart('restarting', 'Resetting…')
    const env = buildEnv()
    await new Promise((resolve) => {
      const child = spawn('openclaw', ['gateway', 'restart'], { env, shell: false, stdio: 'ignore' })
      child.on('close', resolve)
      child.on('error', resolve)
      setTimeout(resolve, 8000)
    })
    repairAuthProfiles()
    await pollGateway(10, 500)
    emitGatewayRestart('ready')
    return { success: true }
  } catch (err) { emitGatewayRestart('ready'); return { success: false, error: err.message } }
})

ipcMain.handle('read-integration-skills', async () => {
  try {
    const home = os.homedir()
    let workspace = path.join(home, '.openclaw', 'workspace')
    try {
      const config = JSON.parse(fs.readFileSync(path.join(home, '.openclaw', 'openclaw.json'), 'utf8'))
      workspace = config?.agents?.defaults?.workspace || workspace
    } catch {}

    const scanDirs = [
      path.join(workspace, 'skills'),
      path.join(workspace, '.agents', 'skills'),
      path.join(home, '.agents', 'skills'),
      path.join(home, '.openclaw', 'skills'),
    ]

    const installed = {}
    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) continue
      let entries
      try { entries = fs.readdirSync(dir) } catch { continue }
      for (const entry of entries) {
        const entryPath = path.join(dir, entry)
        try { if (!fs.statSync(entryPath).isDirectory()) continue } catch { continue }
        if (fs.existsSync(path.join(entryPath, 'SKILL.md')) ||
            fs.existsSync(path.join(entryPath, '_meta.json'))) {
          installed[entry] = true
        }
      }
    }
    return installed
  } catch { return {} }
})

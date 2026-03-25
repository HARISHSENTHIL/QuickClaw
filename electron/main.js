const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const http = require('http')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Builds a PATH-rich env that resolves openclaw regardless of install method.
// Handles Homebrew, npm global, NVM (macOS/Linux) and common Node paths (Windows).
function buildEnv(extra = {}) {
  const home  = os.homedir()
  const isWin = process.platform === 'win32'
  const knownBins = []

  if (!isWin) {
    // macOS / Linux — Homebrew, standard Unix dirs, NVM
    const brewPrefix = fs.existsSync('/opt/homebrew') ? '/opt/homebrew' : '/usr/local'
    knownBins.push(
      `${brewPrefix}/bin`, `${brewPrefix}/sbin`,
      '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
      `${home}/.local/bin`, `${home}/.npm-global/bin`,
    )
    const nvmDir = path.join(home, '.nvm', 'versions', 'node')
    if (fs.existsSync(nvmDir)) {
      try {
        fs.readdirSync(nvmDir).sort().reverse()
          .forEach((v) => knownBins.push(path.join(nvmDir, v, 'bin')))
      } catch {}
    }
  } else {
    // Windows — npm global and common Node.js install locations
    knownBins.push(
      path.join(process.env.APPDATA  || '', 'npm'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs'),
      path.join(home, 'AppData', 'Roaming', 'npm'),
      'C:\\Program Files\\nodejs',
      'C:\\Program Files (x86)\\nodejs',
    )
  }

  const inherited = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  return {
    ...process.env,
    HOME: home,
    ...(isWin ? {} : { TERM: 'xterm-256color' }),
    PATH: [...new Set([...knownBins, ...inherited])].join(path.delimiter),
    ...extra,
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800, height: 620,
    resizable: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform !== 'darwin' && {
      titleBarOverlay: { color: '#09080F', symbolColor: '#8892B0', height: 48 },
    }),
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

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── Installer ──────────────────────────────────────────────────────────────
ipcMain.on('run-install', (event, { provider, model, apiKey }) => {
  const isWin      = process.platform === 'win32'
  const scriptFile = isWin ? 'openclaw-install.ps1' : 'openclaw-install.sh'
  const scriptPath = isDev
    ? path.join(__dirname, '..', 'assets', scriptFile)
    : path.join(process.resourcesPath, scriptFile)

  if (!fs.existsSync(scriptPath)) {
    event.reply('install-log', `[ERR ] Script not found at: ${scriptPath}`)
    event.reply('install-done', { success: false })
    return
  }

  // Copy to writable temp dir — source may be on read-only filesystem (DMG/app bundle)
  const tmpScript = path.join(os.tmpdir(), scriptFile)
  fs.copyFileSync(scriptPath, tmpScript)
  if (!isWin) fs.chmodSync(tmpScript, '755')   // chmod not applicable on Windows

  const providerModelMap = {
    openai: `openai/${model}`, anthropic: `anthropic/${model}`,
    google: `google/${model}`, mistral: `mistral/${model}`,
    groq: `groq/${model}`, cohere: `cohere/${model}`,
    together: `together/${model}`, openrouter: model, ollama: `ollama/${model}`,
  }

  // Platform-specific spawn: PowerShell on Windows, bash on macOS/Linux
  const [spawnCmd, spawnArgs] = isWin
    ? ['powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NonInteractive', '-File', tmpScript]]
    : ['/bin/bash', [tmpScript]]

  const child = spawn(spawnCmd, spawnArgs, {
    env: buildEnv({
      OPENCLAW_API_KEY: apiKey,
      OPENCLAW_PROVIDER: provider,
      OPENCLAW_MODEL: providerModelMap[provider] || model,
    }),
    shell: false,
  })

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
  child.on('close', (code) => event.reply('install-done', { success: code === 0, code }))
  child.on('error', (err) => {
    event.reply('install-log', `[ERR ] ${err.message}`)
    event.reply('install-done', { success: false })
  })
})

ipcMain.on('open-url', (_, url) => shell.openExternal(url))

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
ipcMain.handle('ensure-gateway', async () => {
  if (await probeGateway()) return { success: true }

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

  await run(['gateway', 'stop'])
  await new Promise((r) => setTimeout(r, 2000))

  const startErr = await run(['gateway', 'start'], true)
  if (startErr?.code === 'ENOENT') return { success: false, error: 'BINARY_NOT_FOUND' }
  if (await pollGateway(5, 600)) return { success: true }

  // Service not installed — install LaunchAgent, repair auth, restart
  await run(['gateway', 'stop'])
  await new Promise((r) => setTimeout(r, 1500))
  await run(['gateway', 'install'])
  repairAuthProfiles()
  await run(['gateway', 'start'], true)

  return { success: await pollGateway(15, 800) }
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

    const env = buildEnv()
    await new Promise((resolve) => {
      const child = spawn('openclaw', ['gateway', 'restart'], { env, shell: false, stdio: 'ignore' })
      child.on('close', resolve)
      child.on('error', resolve)
      setTimeout(resolve, 6000)
    })
    repairAuthProfiles()
    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
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
// No gateway restart — avoids breaking active Telegram polling session.
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

    if (toolsContent.trim()) {
      fs.writeFileSync(toolsPath, toolsContent, 'utf8')
      fs.chmodSync(toolsPath, 0o600)
    }

    // Restart gateway so it loads the newly installed skills.
    // Skills are snapshotted at startup — no restart = agent never sees them.
    // stop → 3s wait → start prevents two instances (which causes Telegram 409 loop).
    const env = buildEnv()
    const run = (args) => new Promise((resolve) => {
      const child = spawn('openclaw', args, { env, shell: false, stdio: 'ignore' })
      child.on('close', resolve)
      child.on('error', resolve)
      setTimeout(resolve, 6000)
    })
    await run(['gateway', 'stop'])
    await new Promise((r) => setTimeout(r, 3000))
    await run(['gateway', 'start'])
    repairAuthProfiles()

    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
})

// Reads workspace/skills/ — checks for _meta.json to confirm each skill is installed
ipcMain.handle('read-integration-skills', async () => {
  try {
    const home = os.homedir()
    let workspace = path.join(home, '.openclaw', 'workspace')
    try {
      const config = JSON.parse(fs.readFileSync(path.join(home, '.openclaw', 'openclaw.json'), 'utf8'))
      workspace = config?.agents?.defaults?.workspace || workspace
    } catch {}

    const skillsDir = path.join(workspace, 'skills')
    if (!fs.existsSync(skillsDir)) return {}

    const installed = {}
    for (const entry of fs.readdirSync(skillsDir)) {
      if (fs.existsSync(path.join(skillsDir, entry, '_meta.json'))) installed[entry] = true
    }
    return installed
  } catch { return {} }
})

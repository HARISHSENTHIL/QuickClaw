const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const http = require('http')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Shared: build PATH-rich env that resolves openclaw regardless of install method ──
// Handles Homebrew, npm global, NVM (all versions), and preserves existing PATH.
// NEVER just set PATH: '...' because that kills NVM shims. Always append to existing.
function buildEnv(extra = {}) {
  const home = os.homedir()
  const brewPrefix = fs.existsSync('/opt/homebrew') ? '/opt/homebrew' : '/usr/local'

  const knownBins = [
    `${brewPrefix}/bin`,
    `${brewPrefix}/sbin`,
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    `${home}/.local/bin`,
    `${home}/.npm-global/bin`,
  ]

  // Scan ~/.nvm/versions/node/*/bin — covers every installed node version
  const nvmDir = path.join(home, '.nvm', 'versions', 'node')
  if (fs.existsSync(nvmDir)) {
    try {
      fs.readdirSync(nvmDir)
        .sort().reverse()                         // newest node first
        .forEach((v) => knownBins.push(path.join(nvmDir, v, 'bin')))
    } catch {}
  }

  // Merge: our known bins first, then whatever is already in the inherited PATH
  const inherited = (process.env.PATH || '').split(':').filter(Boolean)
  const merged = [...new Set([...knownBins, ...inherited])]

  return {
    ...process.env,
    HOME: home,
    TERM: 'xterm-256color',
    PATH: merged.join(':'),
    ...extra,
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 620,
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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── IPC: Run installer script ──────────────────────────────────────────────
ipcMain.on('run-install', (event, { provider, model, apiKey }) => {
  // Resolve script path — bundled in resources when packaged
  let scriptPath
  if (isDev) {
    scriptPath = path.join(__dirname, '../assets/openclaw-install.sh')
  } else {
    scriptPath = path.join(process.resourcesPath, 'openclaw-install.sh')
  }

  if (!fs.existsSync(scriptPath)) {
    event.reply('install-log', `[ERR ] Script not found at: ${scriptPath}`)
    event.reply('install-done', { success: false })
    return
  }

  // Copy the script to a writable temp directory before chmod.
  // The source path may be on a read-only filesystem (e.g. mounted DMG,
  // or the app bundle's Resources folder), so we must never chmod in-place.
  const tmpScript = path.join(os.tmpdir(), 'octoclaw-install.sh')
  fs.copyFileSync(scriptPath, tmpScript)
  fs.chmodSync(tmpScript, '755')
  const execScript = tmpScript

  // Map provider+model to OctoClaw format
  const providerModelMap = {
    openai:     `openai/${model}`,
    anthropic:  `anthropic/${model}`,
    google:     `google/${model}`,
    mistral:    `mistral/${model}`,
    groq:       `groq/${model}`,
    cohere:     `cohere/${model}`,
    together:   `together/${model}`,
    openrouter: model,   // pass raw model string
    ollama:     `ollama/${model}`,
  }

  const fullModel = providerModelMap[provider] || model

  const env = buildEnv({
    OPENCLAW_API_KEY: apiKey,
    OPENCLAW_PROVIDER: provider,
    OPENCLAW_MODEL: fullModel,
  })

  const child = spawn('/bin/bash', [execScript], { env, shell: false })

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n')
    lines.forEach((line) => {
      if (line.trim()) event.reply('install-log', line)
    })
  })

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n')
    lines.forEach((line) => {
      if (line.trim()) event.reply('install-log', `[stderr] ${line}`)
    })
  })

  child.on('close', (code) => {
    event.reply('install-done', { success: code === 0, code })
  })

  child.on('error', (err) => {
    event.reply('install-log', `[ERR ] ${err.message}`)
    event.reply('install-done', { success: false })
  })
})

// ── IPC: Open external URL ─────────────────────────────────────────────────
ipcMain.on('open-url', (_, url) => {
  shell.openExternal(url)
})

// ── IPC: Resize window (wizard → dashboard transition) ────────────────────
ipcMain.on('resize-window', (_, { width, height }) => {
  const wins = BrowserWindow.getAllWindows()
  if (wins[0]) {
    wins[0].setResizable(true)
    wins[0].setMinimumSize(900, 620)
    wins[0].setSize(width, height, true)
    wins[0].center()
  }
})

// ── IPC: Check if already installed ───────────────────────────────────────
ipcMain.handle('check-installed', async () => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    const envPath    = path.join(os.homedir(), '.openclaw', '.env')
    if (!fs.existsSync(configPath) || !fs.existsSync(envPath)) return null
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const model  = config?.agents?.defaults?.model?.primary || 'openai/gpt-4o'
    const slashIdx = model.indexOf('/')
    const provider  = slashIdx > -1 ? model.slice(0, slashIdx) : 'openai'
    const modelName = slashIdx > -1 ? model.slice(slashIdx + 1) : model
    return { provider, model: modelName }
  } catch {
    return null
  }
})

// ── Auth repair ───────────────────────────────────────────────────────────
// `openclaw gateway install` can wipe auth-profiles.json.
// This rewrites it with the CORRECT format every time we call gateway install.
//
// Correct format confirmed from openclaw source (auth-profiles-DRjqKE3G.js):
//   - Object with { version, profiles: { id: { type, provider, key } } }  — NOT array
//   - type: "api_key"  (underscore)  — "api-key" hyphen is silently rejected by AUTH_PROFILE_TYPES
//   - key: "..."                     — NOT "apiKey"
function repairAuthProfiles() {
  try {
    const home = os.homedir()
    const envContent = fs.readFileSync(path.join(home, '.openclaw', '.env'), 'utf8')
    const apiKey   = envContent.match(/OPENCLAW_API_KEY=(.+)/)?.[1]?.trim()
    const config   = JSON.parse(fs.readFileSync(path.join(home, '.openclaw', 'openclaw.json'), 'utf8'))
    const model    = config?.agents?.defaults?.model?.primary || 'openai/gpt-4o'
    const provider = model.split('/')[0] || 'openai'

    let authStore
    if (provider === 'ollama') {
      authStore = {
        version: 1,
        profiles: {
          'ollama-default': { type: 'token', provider: 'ollama', token: 'ollama' }
        }
      }
    } else {
      if (!apiKey) return  // no key to write
      authStore = {
        version: 1,
        profiles: {
          [`${provider}-default`]: { type: 'api_key', provider, key: apiKey }
        }
      }
    }

    const locations = [
      path.join(home, '.openclaw', 'auth-profiles.json'),
      path.join(home, '.openclaw', 'agents', 'main', 'auth-profiles.json'),
      path.join(home, '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json'),
    ]
    for (const loc of locations) {
      try {
        fs.mkdirSync(path.dirname(loc), { recursive: true })
        fs.writeFileSync(loc, JSON.stringify(authStore, null, 2))
        fs.chmodSync(loc, 0o600)
      } catch {}
    }
  } catch {}
}

// ── Gateway helpers ────────────────────────────────────────────────────────

// Probe 127.0.0.1:18789 — resolves true if HTTP responds (any status), false otherwise
function probeGateway() {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port: 18789, path: '/', timeout: 800 }, () => {
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

// Poll until gateway is up or attempts exhausted
async function pollGateway(attempts = 20, intervalMs = 600) {
  for (let i = 0; i < attempts; i++) {
    if (await probeGateway()) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

// ── IPC: Ensure gateway is running (zero-click — auto-starts + polls) ─────
ipcMain.handle('ensure-gateway', async () => {
  // Fast path: already up
  if (await probeGateway()) return { success: true }

  const env = buildEnv()

  // Helper: spawn openclaw with a command, returns error or null
  const run = (args, detach = false) => new Promise((resolve) => {
    const opts = { env, shell: false, stdio: 'ignore' }
    if (detach) { opts.detached = true }
    const child = spawn('openclaw', args, opts)
    if (detach) child.unref()
    let err = null
    child.on('error', (e) => { err = e; resolve(e) })
    child.on('close', () => resolve(err))
    setTimeout(() => resolve(null), detach ? 2000 : 6000)
  })

  // Step 1: try `openclaw gateway start`
  const startErr = await run(['gateway', 'start'], true)

  // Binary not found at all — nothing we can do, tell the UI immediately
  if (startErr && startErr.code === 'ENOENT') {
    return { success: false, error: 'BINARY_NOT_FOUND' }
  }

  // Quick probe — if it came up, great
  if (await pollGateway(5, 600)) return { success: true }

  // Step 2: service probably not installed (`openclaw gateway status` said so)
  // Run `install` (registers LaunchAgent / systemd), repair auth (install can wipe it), then start
  await run(['gateway', 'install'])
  repairAuthProfiles()   // gateway install can wipe auth-profiles.json — rewrite it immediately
  await run(['gateway', 'start'], true)

  // Final poll — up to ~12 s
  const ready = await pollGateway(15, 800)
  return { success: ready }
})

// ── IPC: Read gateway token from ~/.openclaw/.env ──────────────────────────
ipcMain.handle('read-gateway-token', async () => {
  try {
    const envPath = path.join(os.homedir(), '.openclaw', '.env')
    const content = fs.readFileSync(envPath, 'utf8')
    const match = content.match(/OPENCLAW_GATEWAY_TOKEN=(.+)/)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
})

// ── IPC: Read current openclaw.json config ─────────────────────────────────
ipcMain.handle('read-config', async () => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    const content = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
})

// ── IPC: Save Telegram bot config into ~/.openclaw/openclaw.json ───────────
// Correct key is channels.telegram (not integrations.telegram)
// Matches: openclaw config set channels.telegram.botToken <token>
//          openclaw config set channels.telegram.dmPolicy open
// Gateway must restart after for the bot to activate.
ipcMain.handle('save-telegram-config', async (_, { botToken }) => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    let config = {}
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch {}

    // Write to the correct openclaw config key
    // dmPolicy "open" requires allowFrom: ["*"] — without it config is invalid
    // and openclaw silently never starts the Telegram poller
    config.channels = config.channels || {}
    config.channels.telegram = {
      botToken,
      dmPolicy: 'open',
      allowFrom: ['*'],
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

    // Restart gateway so it picks up the new Telegram config
    const env = buildEnv()
    await new Promise((resolve) => {
      const child = spawn('openclaw', ['gateway', 'restart'], { env, shell: false, stdio: 'ignore' })
      child.on('close', resolve)
      child.on('error', resolve)
      setTimeout(resolve, 6000)
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: Save skills preferences — stored separately, NOT in openclaw.json ─
// openclaw.json rejects unknown skill keys ("web_search", "shell", etc.) and
// openclaw doctor --fix removes them. Keep UI preferences in our own file.
ipcMain.handle('save-skills-config', async (_, skills) => {
  try {
    const prefsPath = path.join(os.homedir(), '.openclaw', 'octoclaw-prefs.json')
    let prefs = {}
    try { prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8')) } catch {}
    prefs.skills = skills
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2))
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

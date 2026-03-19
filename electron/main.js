const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const http = require('http')
const https = require('https')

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

  // Always stop any existing instance before starting — prevents two instances
  // running simultaneously which causes Telegram 409 conflict loop.
  await run(['gateway', 'stop'])
  await new Promise((r) => setTimeout(r, 2000)) // let the process fully die

  // Step 1: try `openclaw gateway start`
  const startErr = await run(['gateway', 'start'], true)

  // Binary not found at all — nothing we can do, tell the UI immediately
  if (startErr && startErr.code === 'ENOENT') {
    return { success: false, error: 'BINARY_NOT_FOUND' }
  }

  // Quick probe — if it came up, great
  if (await pollGateway(5, 600)) return { success: true }

  // Step 2: service probably not installed — install LaunchAgent, repair auth, then start
  await run(['gateway', 'stop'])                // kill any partial start from step 1
  await new Promise((r) => setTimeout(r, 1500))
  await run(['gateway', 'install'])
  repairAuthProfiles()   // gateway install can wipe auth-profiles.json — rewrite immediately
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
    repairAuthProfiles()

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

// ── Helper: download a URL following redirects (up to maxRedirects hops) ──
// Node's built-in http/https.get does NOT follow redirects automatically.
// GitHub raw URLs often issue a 301/302 before serving the actual content.
function downloadUrl(url, maxRedirects = 5, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'))
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      // Follow 3xx redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume() // drain so socket can be reused
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href
        return downloadUrl(next, maxRedirects - 1, timeoutMs).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`))
      }
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve(data))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timed out')) })
  })
}

// ── IPC: Install integration skills from bundled assets ───────────────────
// Skill files live in assets/skills/ inside app.asar.
// app.getAppPath() + Electron's transparent asar fs lets us read them directly
// in both dev (project root) and prod (inside .app bundle).
//
// Each skill is written as a proper folder into <workspace>/skills/<skillFolder>/
//   SKILL.md    ← official content from binance-skills-hub
//   _meta.json  ← generated, marks the skill as installed (openclaw reads this)
//
// Flow: read from asar → write folder → upsert .env → gateway restart
ipcMain.handle('install-integration-skill', async (_, { modules, envVars }) => {
  try {
    const home = os.homedir()
    const env  = buildEnv()

    // Resolve workspace path from openclaw.json
    let workspace = path.join(home, '.openclaw', 'workspace')
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(home, '.openclaw', 'openclaw.json'), 'utf8'))
      workspace = cfg?.agents?.defaults?.workspace || workspace
    } catch {}

    const skillsDir = path.join(workspace, 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })

    // Base path for bundled assets — works in dev AND inside app.asar in prod
    const appRoot = app.getAppPath()

    // 1. For each module: read SKILL.md from bundle → write skill folder
    for (const mod of modules) {
      const assetPath = path.join(appRoot, 'assets', 'skills', mod.assetFile)
      const content   = fs.readFileSync(assetPath, 'utf8')  // Electron fs reads asar transparently

      const skillDir = path.join(skillsDir, mod.skillFolder)
      fs.mkdirSync(skillDir, { recursive: true })

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8')
      fs.writeFileSync(path.join(skillDir, '_meta.json'), JSON.stringify({
        slug:        mod.skillFolder,
        version:     '1.0.2',
        installedAt: Date.now(),
        source:      'binance-skills-hub',
      }, null, 2))
    }

    // 2. Upsert env vars in ~/.openclaw/.env
    const envPath = path.join(home, '.openclaw', '.env')
    let envContent = ''
    try { envContent = fs.readFileSync(envPath, 'utf8') } catch {}
    for (const [key, value] of Object.entries(envVars)) {
      const re = new RegExp(`^${key}=.*$`, 'm')
      if (re.test(envContent)) {
        envContent = envContent.replace(re, `${key}=${value}`)
      } else {
        envContent = envContent.trimEnd() + `\n${key}=${value}\n`
      }
    }
    fs.writeFileSync(envPath, envContent, 'utf8')
    fs.chmodSync(envPath, 0o600)

    // 3. Write credentials to TOOLS.md in the workspace root
    // The Binance SKILL.md reads from this file automatically on every session start.
    // Format is defined by the SKILL.md "TOOLS.md Structure" section.
    // This means the agent knows the keys without asking the user each time.
    if (envVars.BINANCE_API_KEY && envVars.BINANCE_API_SECRET) {
      const toolsPath = path.join(workspace, 'TOOLS.md')
      let toolsContent = ''
      try { toolsContent = fs.readFileSync(toolsPath, 'utf8') } catch {}

      const binanceSection = `## Binance Accounts\n\n### main\n- API Key: ${envVars.BINANCE_API_KEY}\n- Secret: ${envVars.BINANCE_API_SECRET}\n- Testnet: false\n- Description: Primary trading account\n`

      if (toolsContent.includes('## Binance Accounts')) {
        // Replace existing section — from "## Binance Accounts" to next "##" or end of file
        toolsContent = toolsContent.replace(
          /## Binance Accounts[\s\S]*?(?=\n## |\n*$)/,
          binanceSection
        )
      } else {
        // Append new section
        toolsContent = toolsContent.trimEnd() + '\n\n' + binanceSection
      }

      fs.writeFileSync(toolsPath, toolsContent, 'utf8')
      fs.chmodSync(toolsPath, 0o600)
    }

    // Skills, env vars and TOOLS.md written — no gateway restart needed here.
    // Restarting would kill any active Telegram polling session (409 conflict).
    // The gateway picks up new skills on its next natural start (e.g. Chat tab
    // calls ensureGateway, or the user relaunches the app).

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: Read which integration skills are installed ──────────────────────
// Checks <workspace>/skills/ folders to know which slugs are present.
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
      const metaPath = path.join(skillsDir, entry, '_meta.json')
      if (fs.existsSync(metaPath)) {
        installed[entry] = true  // key = clawhub slug
      }
    }
    return installed
  } catch {
    return {}
  }
})

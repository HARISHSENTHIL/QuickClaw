App Launch

  Electron starts
    └── resolveShellPath()
          └── spawns user's login shell (zsh/bash/fish) with -ilc
          └── extracts real PATH (nvm, Homebrew, volta, asdf, etc.)
          └── cached for app lifetime — prevents ENOENT on every spawn
    └── createWindow()
          └── BrowserWindow 800×620, hiddenInset titlebar
          └── webviewTag: true (needed for Chat WebView)
          └── contextIsolation: true, nodeIntegration: false (secure)
          └── loads Vite dev server (dev) or dist/index.html (prod)

  ---
  2. First Screen — App.jsx (Wizard State Machine)

  App.jsx mounts
    └── checkInstalled() IPC
          └── reads ~/.openclaw/openclaw.json + ~/.openclaw/.env
          ├── EXISTS → skip wizard → jump to Dashboard
          │     └── resizeWindow(1100×720)
          └── NOT EXISTS → start wizard (800×620)

  ---
  3. Wizard Flow (First-time setup)

  Step 1: Welcome.jsx
    └── user clicks "Get Started"

  Step 2: ProviderModel.jsx
    └── user picks provider (OpenAI, Anthropic, Google, Mistral,
          Groq, Cohere, Together, OpenRouter, Ollama)
    └── user picks model for that provider

  Step 3: ApiKey.jsx  ← skipped for Ollama
    └── user enters API key

  Step 4: Installing.jsx
    └── IPC: run-install (provider, model, apiKey)
    └── main.js copies openclaw-install.sh → /tmp/octoclaw-install.sh
    └── spawns /bin/bash [tmpScript] with buildEnv() + credentials
    └── 9-step bash script runs:
          1. check/install openclaw CLI
          2. create ~/.openclaw/ dirs
          3. write ~/.openclaw/.env (API key, gateway token)
          4. generate gateway token
          5. write ~/.openclaw/openclaw.json (model, port 18789, loopback, token auth)
          6. openclaw gateway install  ← registers LaunchAgent
          7. write auth-profiles.json (3 locations)
               CRITICAL: must be AFTER gateway install (install wipes it)
          8. openclaw gateway start
          9. verify
    └── stdout lines streamed → install-log events → progress UI
    └── install-done event → success or fail
    └── on success → jump to Dashboard, resizeWindow(1100×720)

  ---
  4. Dashboard Shell — Dashboard.jsx

  Dashboard renders
    └── Sidebar: Chat | Connect Apps | Skills | Balance
    └── Default tab: Chat
    └── Each tab is a separate component mounted on selection

  ---
  5. Chat Tab — Chat.jsx

  Chat mounts
    └── Phase: 'init'
          └── readGatewayToken() IPC
                └── reads OPENCLAW_GATEWAY_TOKEN from ~/.openclaw/.env
                ├── null → phase='failed', error card
                └── token found →
                      setChatUrl(http://127.0.0.1:18789/?token=<tok>)
                      setPhase('ready') → WebView renders IMMEDIATELY
                      overlay "Connecting…" shown on top

    [background, non-blocking]
    └── probeGateway() — 300ms timeout to 127.0.0.1:18789
          ├── alive → wait for WebView did-finish-load → overlay clears
          └── dead → overlay "Starting gateway…"
                └── ensureGateway() IPC
                      └── _ensureGateway() in main.js:
                            1. probe (800ms)
                            2. if alive → repairAuthProfiles, return
                            3. poll 5×800ms
                            4. if alive → return
                            5. gateway stop → sleep 2s → gateway start (detached)
                            6. poll 15×600ms → if alive → return
                            7. if still dead → stop → install LaunchAgent
                               → repairAuthProfiles → start → poll 15×800ms
                      ├── success → webview.reload()
                      │     └── did-finish-load → overlay clears
                      └── fail → phase='failed', error card + Retry

    [on every did-finish-load]
    └── executeJavaScript() injects token:
          └── sets localStorage keys (4 variants)
          └── finds token input fields → fills via React setter trick
          └── dispatches input + change events
          └── clicks "Connect" button if found (300ms delay)

    [gateway-stage IPC events during ensureGateway]
    └── emitted by main.js → overlay message updates live

  ---
  6. Connect Apps Tab — ConnectApps.jsx

  ConnectApps mounts
    └── readConfig() IPC → reads openclaw.json
    └── shows Telegram connection card

  User connects Telegram:
    └── enters bot token
    └── saveTelegramConfig({ botToken }) IPC
          └── reads openclaw.json
          └── sets config.channels.telegram = {
                botToken, dmPolicy: 'open', allowFrom: ['*']
              }
          └── writes openclaw.json
          └── openclaw gateway restart (6s timeout)
          └── repairAuthProfiles()
          └── return { success }

  ---
  7. Skills Tab — Skills.jsx

  Skills mounts
    └── readIntegrationSkills() IPC
          └── reads ~/.openclaw/openclaw.json → get workspace path
          └── scans 4 directories in precedence order:
                1. <workspace>/skills/
                2. <workspace>/.agents/skills/
                3. ~/.agents/skills/
                4. ~/.openclaw/skills/
          └── for each subfolder: check SKILL.md OR _meta.json
          └── returns { [folderName]: true, ... }
    └── INTEGRATION_SKILLS array defines 3 integrations:
          Binance (12 modules) | CoinGecko (18 modules) | OKX (13 modules)
    └── each card shows: connected count, CONNECT/MANAGE button

  User connects an integration:
    └── fills API credentials
    └── selects skill modules (chips toggle on/off)
    └── clicks Connect
          └── installIntegrationSkill({ modules, envVars }) IPC
                └── reads workspace path from openclaw.json
                └── for each module:
                      reads assets/skills/<provider>/<module>.md (bundled)
                      writes <workspace>/skills/<skillFolder>/SKILL.md
                      writes <workspace>/skills/<skillFolder>/_meta.json
                └── upserts TOOLS.md (credentials for LLM context)
                └── upserts ~/.openclaw/.env (credentials for skill execution)
                └── gateway restart (8s timeout)
                └── repairAuthProfiles()
                └── return { success }

    [gateway watcher hot-reloads SKILL.md changes]
    [.env changes need restart — handled above]
    [new agent sessions immediately see updated skills]

  ---
  8. Auth Repair — repairAuthProfiles()

  Called after every gateway install or restart
    └── reads ~/.openclaw/.env → extracts OPENCLAW_API_KEY
    └── reads openclaw.json → extracts provider
    └── builds auth store:
          non-ollama: { version:1, profiles: { "<provider>-default":
                          { type:"api_key", provider, key } } }
          ollama:     { version:1, profiles: { "ollama-default":
                          { type:"token", provider:"ollama", token:"ollama" } } }
    └── writes to 3 locations (chmod 600 each):
          ~/.openclaw/auth-profiles.json
          ~/.openclaw/agents/main/auth-profiles.json
          ~/.openclaw/agents/main/agent/auth-profiles.json
    └── also sets ~/.openclaw/ → 700, openclaw.json → 600

  ---
  9. IPC Bridge — preload.js → main.js

  All React ↔ Electron communication via contextBridge (window.electronAPI):

    runInstall()              → run-install (event)
    onLog() / onDone()        → install-log / install-done (events)
    checkInstalled()          → check-installed (invoke)
    resizeWindow()            → resize-window (event)
    readGatewayToken()        → read-gateway-token (invoke)
    probeGateway()            → probe-gateway (invoke) ← 300ms probe
    ensureGateway()           → ensure-gateway (invoke)
    onGatewayStage()          → gateway-stage (push event from main)
    readConfig()              → read-config (invoke)
    saveTelegramConfig()      → save-telegram-config (invoke)
    saveSkillsConfig()        → save-skills-config (invoke)
    installIntegrationSkill() → install-integration-skill (invoke)
    readIntegrationSkills()   → read-integration-skills (invoke)
    openUrl()                 → open-url (event → shell.openExternal)
    getAppVersion()           → get-app-version (invoke)

  ---
  10. Config Files on Disk

  ~/.openclaw/
    ├── openclaw.json        ← model, gateway port/token/loopback, workspace path
    ├── .env                 ← OPENCLAW_API_KEY, OPENCLAW_GATEWAY_TOKEN, provider keys
    ├── auth-profiles.json   ← AI provider auth (written by repairAuthProfiles)
    ├── octoclaw-prefs.json  ← UI-only skill preferences (not openclaw.json — rejected)
    └── workspace/
          ├── TOOLS.md       ← credentials doc for LLM context (auto-read by agent)
          └── skills/
                └── <skillFolder>/
                      ├── SKILL.md    ← skill definition (hot-reloaded by watcher)
                      └── _meta.json  ← our install marker (slug, version, installedAt)
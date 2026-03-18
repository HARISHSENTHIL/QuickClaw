Preflight

Validates OpenAI API key is pasted — fails fast if still placeholder

Step 1 — Install

Checks if openclaw already installed
If not → curl install.sh | bash -s -- --no-onboard — installs binary only, skips interactive onboard completely

Step 2 — Directories

Creates ~/.openclaw/workspace
Creates ~/.openclaw/agents/main/agent

Step 3 — API Key

Writes OPENAI_API_KEY to ~/.openclaw/.env with chmod 600

Step 4 — Gateway Token

Auto-generates a 256-bit token via openssl rand -hex 32
Saves to .env as OPENCLAW_GATEWAY_TOKEN

Step 5 — Config

Writes ~/.openclaw/openclaw.json directly with:

gateway.mode: local ← fixes the gateway start blocked error
gateway.bind: loopback ← security
gateway.auth.token ← generated token
agents.defaults.model: openai/gpt-4o
tools: {} ← fixes the non-interactive tools bug



Step 6 — Auth Profile

Writes OpenAI API key into auth-profiles.json

Step 7 — Daemon

openclaw gateway install — registers as LaunchAgent (macOS) / systemd (Linux)

Step 8 — Start

openclaw gateway restart/start
Waits 3 seconds for it to come up

Step 9 — Verify

openclaw gateway status — confirms running + RPC ok
yes | openclaw doctor — auto-accepts all fix prompts

Done — prints:

Dashboard URL with token embedded → open in browser = web UI ready
Telegram add instructions for later
Useful commands


------------------------

 What was built:

  openclaw-desktop/
  ├── electron/
  │   ├── main.js        ← spawns the .sh script with env vars, streams logs via IPC
  │   └── preload.js     ← secure context bridge (renderer ↔ main)
  ├── src/
  │   ├── App.jsx        ← wizard state machine (5 steps)
  │   ├── index.css      ← full dark terminal theme
  │   └── steps/
  │       ├── Welcome.jsx       ← ASCII logo + feature list
  │       ├── ProviderModel.jsx ← OpenAI / Anthropic / OpenRouter cards + model picker
  │       ├── ApiKey.jsx        ← password input + link to get key + security note
  │       ├── Installing.jsx    ← live log stream with color-coded lines
  │       └── Done.jsx          ← summary + "Open Dashboard" button
  ├── assets/
  │   └── openclaw-install.sh   ← parameterized (reads OPENCLAW_API_KEY, OPENCLAW_MODEL, OPENCLAW_PROVIDER from env)
  └── package.json              ← electron-builder config for .dmg output

  To run in dev mode:
  npm run dev

  To build the .dmg:
  npm run build:mac

  Two things you'll want to do next:
  1. Add an app icon — put icon.icns in assets/ (electron-builder needs it for the .dmg)
  2. Revoke the old hardcoded API key from openclaw.sh — it was exposed in that file




Complete Flow — Start to Finish

  Phase 1 — Wizard (800×620 window)

  User opens OctoClaw.app
         ↓
  Electron main.js → createWindow() → loads dist/index.html
         ↓
  React App.jsx renders → step = 'welcome'
         ↓
  [Welcome] → [Provider & Model] → [API Key] → [Installing]
                                      ↑ skipped for Ollama

  Phase 2 — Install (bash script via IPC)

  User clicks "Install OctoClaw" in ApiKey step
         ↓
  Installing.jsx calls window.electronAPI.runInstall({ provider, model, apiKey })
         ↓
  preload.js bridges → ipcRenderer.send('run-install', config)
         ↓
  main.js ipcMain.on('run-install') receives it:
    1. Resolves script path (dev: assets/ | prod: resourcesPath/)
    2. Copies script → /tmp/octoclaw-install.sh   ← avoids read-only DMG crash
    3. chmod 755 on /tmp copy
    4. Builds env: OPENCLAW_API_KEY, OPENCLAW_PROVIDER, OPENCLAW_MODEL,
                   PATH (with dynamic Homebrew prefix), HOME, TERM
    5. spawn('/bin/bash', [tmpScript], { env })
    6. Streams stdout/stderr → 'install-log' IPC events → Installing.jsx log box
    7. On exit code 0 → 'install-done' { success: true }

  Phase 3 — bash script execution (9 steps)

  INIT: detect BREW_PREFIX (/opt/homebrew or /usr/local), read env vars
    ↓
  PREFLIGHT: validate API_KEY (skip check for ollama)
    ↓
  STEP 1: Check if openclaw binary exists
          → if not: curl openclaw.ai/install.sh | bash --no-onboard
          → PATH updated with BREW_PREFIX + .local/bin
    ↓
  PATH FIX: write 'export PATH=...' to ~/.zshrc / ~/.bash_profile (idempotent)
             export into current session
    ↓
  STEP 2: mkdir -p ~/.openclaw/workspace
          mkdir -p ~/.openclaw/agents/main/agent
    ↓
  STEP 3: write ~/.openclaw/.env
          OPENCLAW_API_KEY=<key>
          chmod 600
    ↓
  STEP 4: generate GATEWAY_TOKEN via openssl rand -hex 32
          append OPENCLAW_GATEWAY_TOKEN=<token> to .env
    ↓
  STEP 5: write ~/.openclaw/openclaw.json
          model.primary = "provider/model"
          gateway: local, port 18789, loopback, token auth
    ↓
  STEP 6: openclaw gateway install  ← may wipe agent dirs
    ↓
  STEP 7: write auth-profiles.json to 3 locations (BEFORE gateway starts)
          ~/.openclaw/auth-profiles.json
          ~/.openclaw/agents/main/auth-profiles.json
          ~/.openclaw/agents/main/agent/auth-profiles.json
          chmod 600 each
    ↓
  STEP 8: openclaw gateway stop → sleep 1 → openclaw gateway start
          (clean restart so gateway reads fresh auth on startup)
          sleep 3
    ↓
  STEP 9: openclaw gateway status (warn only)
          openclaw doctor (warn only)
    ↓
  Print summary: Provider / Model / Gateway URL / Dashboard URL with token

  Phase 4 — Dashboard (window resized to 1100×720)

  Installing.jsx receives 'install-done' { success: true }
         ↓
  App.jsx: window.electronAPI.resizeWindow(1100, 720)
           → main.js: setResizable(true), setSize(1100,720), center()
         ↓
  step = 'dashboard' → Dashboard.jsx renders
         ↓
  Sidebar: logo (base64 webp), nav items, footer with provider/model + RESET
         ↓
  ┌── CHAT ──────────────────────────────────────────────────────┐
  │  Chat.jsx:                                                   │
  │  1. readGatewayToken() IPC → reads ~/.openclaw/.env          │
  │  2. builds url: http://127.0.0.1:18789/?token=<token>        │
  │  3. renders <webview ref={webviewRef} src={url}>             │
  │  4. on did-finish-load → executeJavaScript to inject token   │
  │     into Gateway Token input field → clicks Connect button   │
  └──────────────────────────────────────────────────────────────┘
  ┌── CONNECT APPS ──────────────────────────────────────────────┐
  │  Telegram card → enter bot token → saveTelegramConfig IPC    │
  │  → writes integrations.telegram to openclaw.json             │
  └──────────────────────────────────────────────────────────────┘
  ┌── SKILLS ────────────────────────────────────────────────────┐
  │  6 skill toggles → saveSkillsConfig IPC                      │
  │  → writes skills map to openclaw.json                        │
  └──────────────────────────────────────────────────────────────┘
  ┌── BALANCE ───────────────────────────────────────────────────┐
  │  Coming soon placeholder                                     │
  └──────────────────────────────────────────────────────────────┘
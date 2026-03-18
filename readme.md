# OctoClaw Desktop

A one-click desktop installer and dashboard for [OpenClaw](https://openclaw.ai). Built with Electron + React.

---

## How to Run

**Prerequisites:** Node.js, pnpm

```bash
pnpm install
pnpm run dev        # development
pnpm run build:mac  # build .dmg
```

---

## Architecture

```
openclaw-desktop/
├── electron/
│   ├── main.js       — main process, all IPC handlers, child process spawning
│   └── preload.js    — secure context bridge (renderer ↔ main)
├── src/
│   ├── App.jsx       — root component, wizard state machine, startup check
│   ├── Dashboard.jsx — dashboard shell with sidebar nav
│   ├── steps/        — Welcome, ProviderModel, ApiKey, Installing
│   └── dashboard/    — Chat, ConnectApps, Skills, Balance
└── assets/
    └── openclaw-install.sh — parameterized bash installer
```

---

## Complete Flow

### App Startup

Every time the app opens, before rendering anything, `App.jsx` calls `checkInstalled()` via IPC. The main process checks whether `~/.openclaw/openclaw.json` and `~/.openclaw/.env` exist.

- **Not found** → wizard starts at the Welcome screen
- **Found** → skip wizard entirely, resize window to 1100×720, go straight to Dashboard

---

### First Launch — Wizard (800×620 window)

Progress bar advances through 4 steps:

**Step 1 — Welcome**
Landing screen with a brief intro. User clicks Continue.

**Step 2 — Provider & Model**
User picks an AI provider (OpenAI, Anthropic, Google, Mistral, Groq, Cohere, Together, OpenRouter, Ollama) and selects a model. Selection is stored in React state.

**Step 3 — API Key**
User pastes their API key. Skipped entirely for Ollama since no key is needed.

**Step 4 — Installing**
User clicks Install. `Installing.jsx` calls `window.electronAPI.runInstall({ provider, model, apiKey })` which sends an IPC message to the main process.

The main process:
1. Resolves the script path — `assets/openclaw-install.sh` in dev, `resourcesPath/openclaw-install.sh` in production
2. Copies the script to `/tmp/octoclaw-install.sh` (avoids read-only DMG filesystem errors)
3. Makes it executable with `chmod 755`
4. Builds a rich `PATH` environment — includes Homebrew, NVM (all installed versions scanned), npm global, and the existing `process.env.PATH` — so the `openclaw` binary is always found regardless of install method
5. Spawns `/bin/bash /tmp/octoclaw-install.sh` with `OPENCLAW_API_KEY`, `OPENCLAW_PROVIDER`, `OPENCLAW_MODEL` in env
6. Streams every stdout/stderr line back to the renderer via `install-log` IPC events
7. On exit code 0, sends `install-done { success: true }`

**What the bash script does (9 steps):**

```
Preflight     → validate API key is set (skip for Ollama)
Step 1        → check if openclaw CLI exists
                if not: curl openclaw.ai/install.sh | bash --no-onboard
                         or: npm install -g openclaw (fallback)
PATH fix      → append openclaw bin to ~/.zshrc / ~/.bash_profile (idempotent)
Step 2        → mkdir ~/.openclaw/workspace
                mkdir ~/.openclaw/agents/main/agent
Step 3        → write ~/.openclaw/.env with OPENCLAW_API_KEY, chmod 600
Step 4        → generate 256-bit gateway token via openssl rand -hex 32
                append OPENCLAW_GATEWAY_TOKEN to .env
Step 5        → write ~/.openclaw/openclaw.json
                (model, gateway port 18789, loopback bind, token auth)
Step 6        → openclaw gateway install
                registers as LaunchAgent (macOS) / systemd (Linux)
Step 7        → write auth-profiles.json to 3 locations
                MUST be after gateway install (install can wipe the file)
                MUST be before gateway start (gateway reads auth on startup)
                Locations: ~/.openclaw/auth-profiles.json
                           ~/.openclaw/agents/main/auth-profiles.json
                           ~/.openclaw/agents/main/agent/auth-profiles.json
Step 8        → openclaw gateway stop → sleep 1 → openclaw gateway start
                clean restart so gateway reads the fresh auth file
                sleep 3 to let it come up
Step 9        → openclaw gateway status (verify running)
                openclaw doctor (verify config, warn only)
```

On success, `Installing.jsx` receives `install-done { success: true }`, the window resizes to 1100×720, and the app transitions to the Dashboard.

On failure, the user is sent back to the API Key step to retry.

---

### Subsequent Launches — Direct to Dashboard

`checkInstalled()` finds the config files, reads `agents.defaults.model.primary` from `openclaw.json` (format: `"openai/gpt-4o"`), parses out provider and model, restores them into state, and jumps to the Dashboard. The wizard is never shown.

---

### Dashboard

A sidebar + content layout with four tabs.

**Chat**

When the Chat tab mounts, it goes through a startup sequence:

```
1. readGatewayToken() — reads OPENCLAW_GATEWAY_TOKEN from ~/.openclaw/.env

2. ensureGateway():
   a. Probe http://127.0.0.1:18789 — already up? return immediately
   b. Not up → spawn: openclaw gateway start (detached)
      wait 1.5s for daemon to register
   c. Poll every 600ms up to 5 attempts (3s)
      → up? done
   d. Still not up → gateway service probably not installed
      → openclaw gateway install
      → repairAuthProfiles() — rewrites auth-profiles.json immediately
        (gateway install can wipe the auth file)
      → openclaw gateway start (detached)
      → poll every 800ms up to 15 attempts (12s)
   e. Binary not found (ENOENT) → return { error: 'BINARY_NOT_FOUND' } immediately

3. Set chatUrl = http://127.0.0.1:18789/?token=<token>

4. Render <webview src={chatUrl}>

5. On did-finish-load → executeJavaScript to inject token:
   - writes token to localStorage under 4 possible key names
   - finds any input with "token" or "gateway" in placeholder/id/name
   - sets its value using the native React setter (so React state updates)
   - dispatches input + change events
   - after 300ms, clicks the Connect button
```

The Chat tab shows a spinner with status text during steps 1–2, renders the webview once ready, and shows an error + Retry button if the gateway fails to start.

**Connect Apps**

User expands the Telegram card, pastes a bot token from `@BotFather`, and clicks Save. The token is written into `integrations.telegram` in `~/.openclaw/openclaw.json` via IPC.

**Skills**

Six agent capability toggles (web search, shell, file manager, code runner, browser automation, long-term memory). Preferences are saved to `~/.openclaw/octoclaw-prefs.json` — not to `openclaw.json`, because openclaw rejects unknown skill keys.

**Balance**

Coming soon placeholder.

---

### Reset

The RESET button in the sidebar footer sends the user back to the Welcome step. Config files on disk are not deleted — re-running the wizard will overwrite them.

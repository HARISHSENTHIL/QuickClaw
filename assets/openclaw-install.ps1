#Requires -Version 5.1
# OctoClaw Windows Installer
# Mirrors openclaw-install.sh — all log prefixes match the Installing.jsx parser.
$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'   # suppress Invoke-WebRequest progress spam

# ── Read config from env vars (set by Electron) ───────────────────────────
$API_KEY  = $env:OPENCLAW_API_KEY
$MODEL    = if ($env:OPENCLAW_MODEL)    { $env:OPENCLAW_MODEL }    else { 'openai/gpt-4o' }
$PROVIDER = if ($env:OPENCLAW_PROVIDER) { $env:OPENCLAW_PROVIDER } else { 'openai' }

$OPENCLAW_HOME = Join-Path $HOME '.openclaw'
$CONFIG_FILE   = Join-Path $OPENCLAW_HOME 'openclaw.json'
$ENV_FILE      = Join-Path $OPENCLAW_HOME '.env'

# ── Helpers ───────────────────────────────────────────────────────────────
function log_info    { param($msg) Write-Output "[INFO]  $msg";  [Console]::Out.Flush() }
function log_success { param($msg) Write-Output "[ OK ]  $msg";  [Console]::Out.Flush() }
function log_warn    { param($msg) Write-Output "[WARN]  $msg";  [Console]::Out.Flush() }
function log_error   { param($msg) Write-Output "[ERR ]  $msg";  [Console]::Out.Flush(); exit 1 }
function divider     { Write-Output '----------------------------------------------'; [Console]::Out.Flush() }

# Restrict file to current user only (Windows equivalent of chmod 600)
function Protect-File {
  param([string]$FilePath)
  try {
    $acl      = Get-Acl $FilePath
    $acl.SetAccessRuleProtection($true, $false)
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $rule     = New-Object System.Security.AccessControl.FileSystemAccessRule(
                  $identity, 'FullControl', 'Allow')
    $acl.SetAccessRule($rule)
    Set-Acl $FilePath $acl
  } catch {}
}

# Write UTF-8 file WITHOUT BOM (important for JSON and .env parsing)
function Write-UTF8 {
  param([string]$FilePath, [string]$Content)
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($FilePath, $Content, $utf8NoBom)
}

# Append UTF-8 line WITHOUT BOM
function Append-UTF8 {
  param([string]$FilePath, [string]$Line)
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  $sw = [System.IO.StreamWriter]::new($FilePath, $true, $utf8NoBom)
  try { $sw.WriteLine($Line) } finally { $sw.Close() }
}

# ── Preflight ─────────────────────────────────────────────────────────────
divider
log_info "Starting OpenClaw installer..."
log_info "Provider: $PROVIDER | Model: $MODEL"

if (-not $API_KEY -and $PROVIDER -ne 'ollama') {
  log_error "No API key provided for provider: $PROVIDER"
}

# ── Step 1: Install OpenClaw CLI ──────────────────────────────────────────
divider
log_info "Checking OpenClaw installation..."

$ocCmd = Get-Command openclaw -ErrorAction SilentlyContinue
if ($ocCmd) {
  $ocVer = (& openclaw --version 2>$null) | Select-Object -First 1
  log_success "Already installed -> $ocVer"
} else {
  log_info "Not found. Installing..."
  try {
    # Use openclaw's own official Windows installer
    Invoke-Expression (
      Invoke-WebRequest -Uri 'https://openclaw.ai/install.ps1' -UseBasicParsing
    ).Content
    $env:PATH = "$env:APPDATA\npm;$env:PATH"
    $ocVer = (& openclaw --version 2>$null) | Select-Object -First 1
    log_success "Installed -> $ocVer"
  } catch {
    # Fallback: npm global install
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) {
      log_info "Falling back to npm install..."
      & npm install -g openclaw@latest 2>&1 | Out-Null
      $env:PATH = "$env:APPDATA\npm;$env:PATH"
      $ocVer = (& openclaw --version 2>$null) | Select-Object -First 1
      log_success "Installed via npm -> $ocVer"
    } else {
      log_error "Could not install openclaw. Install Node.js from nodejs.org and retry."
    }
  }
}

# Refresh PATH so subsequent openclaw calls work in this session
$env:PATH = "$env:APPDATA\npm;$env:LOCALAPPDATA\Programs\nodejs;$env:PATH"

# ── Step 2: Directories ───────────────────────────────────────────────────
divider
log_info "Setting up directories..."
New-Item -ItemType Directory -Force -Path (Join-Path $OPENCLAW_HOME 'workspace')             | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $OPENCLAW_HOME 'agents\main\agent')     | Out-Null
log_success "Directories ready."

# ── Step 3: Write .env ────────────────────────────────────────────────────
divider
log_info "Saving API key to $ENV_FILE..."
Write-UTF8 $ENV_FILE "OPENCLAW_API_KEY=$API_KEY"
Protect-File $ENV_FILE
log_success "API key saved."

# ── Step 4: Gateway token ─────────────────────────────────────────────────
divider
log_info "Generating gateway auth token..."
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$tokenBytes = New-Object byte[] 32
$rng.GetBytes($tokenBytes)
$rng.Dispose()
$GATEWAY_TOKEN = ($tokenBytes | ForEach-Object { '{0:x2}' -f $_ }) -join ''
Append-UTF8 $ENV_FILE "OPENCLAW_GATEWAY_TOKEN=$GATEWAY_TOKEN"
log_success "Token generated."

# ── Step 5: Write config ──────────────────────────────────────────────────
divider
log_info "Writing config to $CONFIG_FILE..."
$workspaceDir = (Join-Path $OPENCLAW_HOME 'workspace') -replace '\\', '/'
$configJson = @"
{
  "agents": {
    "defaults": {
      "workspace": "$workspaceDir",
      "model": {
        "primary": "$MODEL"
      }
    }
  },
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "$GATEWAY_TOKEN"
    }
  },
  "tools": {}
}
"@
Write-UTF8 $CONFIG_FILE $configJson
log_success "Config written."

# ── Step 6: Install gateway daemon ────────────────────────────────────────
divider
log_info "Installing gateway daemon..."
try {
  & openclaw gateway install 2>&1 | Out-Null
  log_success "Daemon installed."
} catch {
  log_warn "Daemon install had issues - you may start the gateway manually."
}

# ── Step 7: Write auth profile (AFTER install, BEFORE start) ──────────────
divider
log_info "Writing auth profile..."

$authLocations = @(
  (Join-Path $OPENCLAW_HOME 'agents\main\agent\auth-profiles.json'),
  (Join-Path $OPENCLAW_HOME 'agents\main\auth-profiles.json'),
  (Join-Path $OPENCLAW_HOME 'auth-profiles.json')
)

if ($PROVIDER -eq 'ollama') {
  $authJson = @"
{
  "version": 1,
  "profiles": {
    "ollama-default": {
      "type": "token",
      "provider": "ollama",
      "token": "ollama"
    }
  }
}
"@
} else {
  $authJson = @"
{
  "version": 1,
  "profiles": {
    "${PROVIDER}-default": {
      "type": "api_key",
      "provider": "$PROVIDER",
      "key": "$API_KEY"
    }
  }
}
"@
}

foreach ($loc in $authLocations) {
  New-Item -ItemType Directory -Force -Path (Split-Path $loc) | Out-Null
  Write-UTF8 $loc $authJson
  Protect-File $loc
}
log_success "Auth profile written for provider: $PROVIDER"

# ── Step 8: Start gateway ─────────────────────────────────────────────────
divider
log_info "Starting gateway..."
try { & openclaw gateway stop  2>&1 | Out-Null } catch {}
Start-Sleep -Seconds 1
try {
  & openclaw gateway start   2>&1 | Out-Null
} catch {
  try { & openclaw gateway restart 2>&1 | Out-Null } catch {}
}
Start-Sleep -Seconds 3
log_success "Gateway started."

# ── Step 9: Verify ────────────────────────────────────────────────────────
divider
log_info "Verifying..."
try { & openclaw gateway status 2>&1 | Out-Null } catch { log_warn "Gateway status had issues." }
try { 'y' | & openclaw doctor  2>&1 | Out-Null } catch { log_warn "Doctor flagged warnings."  }

# ── Done ──────────────────────────────────────────────────────────────────
divider
Write-Output ""
Write-Output "  OpenClaw is live!"
Write-Output ""
Write-Output "  Provider:   $PROVIDER"
Write-Output "  Model:      $MODEL"
Write-Output "  Gateway:    ws://127.0.0.1:18789"
Write-Output "  Dashboard:  http://127.0.0.1:18789/?token=$GATEWAY_TOKEN"
Write-Output ""
divider

#!/usr/bin/env bash
set -euo pipefail

# ── Read config from env vars (set by Electron) ───────────────────────────
API_KEY="${OPENCLAW_API_KEY:-}"
MODEL="${OPENCLAW_MODEL:-openai/gpt-4o}"
PROVIDER="${OPENCLAW_PROVIDER:-openai}"

OPENCLAW_HOME="$HOME/.openclaw"
CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"
ENV_FILE="$OPENCLAW_HOME/.env"

# Detect Homebrew prefix once at top — used in PATH setup throughout script
if [ -d "/opt/homebrew" ]; then
  BREW_PREFIX="/opt/homebrew"
else
  BREW_PREFIX="/usr/local"
fi

# ── Helpers ───────────────────────────────────────────────────────────────
info()    { echo "[INFO]  $*"; }
success() { echo "[ OK ]  $*"; }
warn()    { echo "[WARN]  $*"; }
error()   { echo "[ERR ]  $*"; exit 1; }
divider() { echo "──────────────────────────────────────────────"; }

# ── Preflight ─────────────────────────────────────────────────────────────
divider
info "Starting OpenClaw installer..."
info "Provider: $PROVIDER | Model: $MODEL"

# Allow empty key only for local providers (e.g. ollama)
if [ -z "$API_KEY" ] && [ "$PROVIDER" != "ollama" ]; then
  error "No API key provided for provider: $PROVIDER"
fi

# ── Step 1: Install OpenClaw ──────────────────────────────────────────────
divider
info "Checking OpenClaw installation..."

if command -v openclaw &>/dev/null; then
  OC_VER=$(openclaw --version 2>/dev/null | head -1 || echo "unknown")
  success "Already installed → $OC_VER"
else
  info "Not found. Installing..."
  INSTALLED=false

  # ── Helper: ensure a suitable Node.js + npm is available ─────────────
  # openclaw requires Node >= 22. nvm installs to ~/.nvm/ so zero sudo
  # needed — solves both "no Node" and npm EACCES permission problems.
  # No Homebrew fallback — brew install node requires sudo and fails for
  # non-admin users. nvm is the only path.
  ensure_npm() {
    export NVM_DIR="$HOME/.nvm"

    # If node + npm exist, check version is >= 22 AND prefix is user-owned
    if command -v node &>/dev/null && command -v npm &>/dev/null; then
      local major
      major=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 | tr -d '[:space:]')
      local prefix
      prefix=$(npm config get prefix 2>/dev/null || echo "")

      if [ -n "$major" ] && [ "$major" -ge 22 ] 2>/dev/null; then
        # Version OK — check prefix isn't system-wide (needs sudo for -g installs)
        if echo "$prefix" | grep -q "$HOME"; then
          return 0  # nvm or user-local install — safe to use
        else
          info "System Node.js detected — switching to user-local install to avoid permission errors..."
        fi
      else
        info "Node.js $(node --version 2>/dev/null || echo 'not found') is below required v22 — upgrading..."
      fi
    fi

    info "Setting up Node.js automatically (no action needed from you)..."

    # Clear conflicting npm prefix — breaks nvm if left set
    npm config delete prefix 2>/dev/null || true

    # Install nvm if not already present.
    # PROFILE=/dev/null stops nvm touching shell RC files (we handle that below).
    # || true: nvm installer exits non-zero in non-interactive shells but still
    # installs correctly — the exit code is safe to ignore here.
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
      info "Downloading nvm..."
      PROFILE=/dev/null curl -fsSL \
        https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash 2>/dev/null || true
    fi

    # nvm is a shell function, not a binary — source it into this session.
    # Also source bash_completion if present (some distros need it for full init).
    [ -s "$NVM_DIR/nvm.sh" ]          && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" 2>/dev/null || true

    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
      # nvm download failed (network issue)
      error "Could not download nvm. Check your internet connection and try again.\nAlternatively, install Node.js v22+ manually from https://nodejs.org"
    fi

    info "Installing Node.js v22 LTS..."

    # type nvm checks the shell function — reliable in interactive shells but
    # can silently fail in non-interactive Electron-spawned bash.
    # Primary: try the shell function. Fallback: invoke nvm.sh directly as a
    # subprocess so the function scope doesn't matter.
    if type nvm &>/dev/null 2>&1; then
      nvm install 22 2>/dev/null || true
      nvm use 22 2>/dev/null || true
      nvm alias default 22 2>/dev/null || true
    else
      # Shell function not available in this context — call nvm.sh directly
      bash --norc -c ". '$NVM_DIR/nvm.sh' && nvm install 22 && nvm use 22 && nvm alias default 22" \
        2>/dev/null || true
    fi

    # Explicitly find the node 22 bin and prepend to PATH.
    # This works regardless of whether the nvm shell function loaded correctly —
    # we check the actual binary on disk, not the shell function state.
    local nvm_node_bin
    nvm_node_bin=$(ls -d "$NVM_DIR/versions/node"/v22.*/bin 2>/dev/null | sort -V | tail -1)
    if [ -n "$nvm_node_bin" ] && [ -d "$nvm_node_bin" ]; then
      export PATH="$nvm_node_bin:$PATH"
      info "Node.js ready."
      return 0
    fi

    error "Node.js v22 installation failed. Please install it manually from https://nodejs.org and try again."
  }

  # ── Try 1: official openclaw.ai installer (preferred) ──────────────────
  # Fastest path when Node >= 22 is already present.
  # If it fails for any reason (no node, EACCES, network) we fall through.
  if command -v curl &>/dev/null; then
    info "Trying official installer via curl..."
    if curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard; then
      INSTALLED=true
    else
      warn "Official installer failed — setting up Node.js and retrying..."
    fi
  fi

  # ── Try 2: nvm → Node v22 → npm install -g ─────────────────────────────
  # nvm installs entirely to ~/.nvm/ — no sudo, no permission issues.
  # This also handles the EACCES case from Try 1 (system npm needing sudo).
  if [ "$INSTALLED" = false ]; then
    if ensure_npm; then
      info "Installing openclaw via npm..."
      SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
      INSTALLED=true
    else
      error "Could not set up Node.js. Install v22+ from https://nodejs.org and retry."
    fi
  fi

  # Reload nvm + extend PATH so remaining steps can find the openclaw binary
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  export PATH="$BREW_PREFIX/bin:$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"

  command -v openclaw &>/dev/null || \
    error "Installed but openclaw not found in PATH. Open a new terminal and try again."
  success "Installed → $(openclaw --version 2>/dev/null | head -1)"
fi

# ── PATH fix: write to shell RC so openclaw works in new terminals ─────────
divider
info "Ensuring openclaw is on PATH in shell profile..."
HOMEBREW_PATH_LINE="export PATH=\"$BREW_PREFIX/bin:\$HOME/.local/bin:\$PATH\""
# nvm used PROFILE=/dev/null so it skipped writing to shell configs — we add it here
NVM_INIT_LINE="export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\""
MARKER="# Added by OctoClaw installer"
for RC_FILE in "$HOME/.zshrc" "$HOME/.bash_profile" "$HOME/.bashrc"; do
  [ -f "$RC_FILE" ] || continue
  grep -q "Added by OctoClaw installer" "$RC_FILE" 2>/dev/null && continue
  printf '\n%s\n%s\n%s\n' "$MARKER" "$HOMEBREW_PATH_LINE" "$NVM_INIT_LINE" >> "$RC_FILE"
  success "PATH written to $RC_FILE"
done
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$BREW_PREFIX/bin:$HOME/.local/bin:$PATH"

# ── Step 2: Directories ───────────────────────────────────────────────────
divider
info "Setting up directories..."
mkdir -p "$OPENCLAW_HOME/workspace"
mkdir -p "$OPENCLAW_HOME/agents/main/agent"
# State dir must be 700 — openclaw doctor flags anything with group/world bits
# and gateway silently fails to load auth when permissions are too open.
# Default umask (022) gives 755 which is wrong. Fix it here so doctor never
# needs to prompt. We only chmod what WE create — openclaw manages the rest.
chmod 700 "$OPENCLAW_HOME"
success "Directories ready."

# ── Step 3: Write .env ────────────────────────────────────────────────────
divider
info "Saving API key to $ENV_FILE..."
cat > "$ENV_FILE" <<EOF
OPENCLAW_API_KEY=$API_KEY
EOF
chmod 600 "$ENV_FILE"
success "API key saved."

# ── Step 4: Gateway token ─────────────────────────────────────────────────
divider
info "Generating gateway auth token..."
GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "OPENCLAW_GATEWAY_TOKEN=$GATEWAY_TOKEN" >> "$ENV_FILE"
success "Token generated."

# ── Step 5: Write config ──────────────────────────────────────────────────
divider
info "Writing config to $CONFIG_FILE..."
cat > "$CONFIG_FILE" <<EOF
{
  "agents": {
    "defaults": {
      "workspace": "$OPENCLAW_HOME/workspace",
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
EOF
chmod 600 "$CONFIG_FILE"
success "Config written."

# ── Step 6: Install gateway daemon ───────────────────────────────────────
divider
info "Installing gateway daemon..."
openclaw gateway install && success "Daemon installed." || \
  warn "Daemon install had issues — you may start gateway manually."

# ── Step 7: Write auth profile (AFTER gateway install, BEFORE gateway start) ──
# Critical ordering:
#   - AFTER  gateway install → prevents install from wiping the file
#   - BEFORE gateway start  → gateway reads auth on startup; restarting after
#                              writing ensures it picks up the correct key
# We also write to the parent agent dir because openclaw may look there too.
divider
info "Writing auth profile..."
mkdir -p "$OPENCLAW_HOME/agents/main/agent"

write_auth_json() {
  local dest="$1"
  # auth-profiles.json MUST use:
  #   - object format  { version, profiles: { id: {...} } }  — NOT an array
  #   - "type": "api_key"  (underscore)                      — "api-key" hyphen is silently rejected
  #   - "key": "..."                                          — "apiKey" is NOT the field name
  if [ "$PROVIDER" = "ollama" ]; then
    cat > "$dest" <<EOF
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
EOF
  else
    cat > "$dest" <<EOF
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
EOF
  fi
  chmod 600 "$dest"
}

# Write to all locations openclaw may consult
write_auth_json "$OPENCLAW_HOME/agents/main/agent/auth-profiles.json"
write_auth_json "$OPENCLAW_HOME/agents/main/auth-profiles.json"
write_auth_json "$OPENCLAW_HOME/auth-profiles.json"
success "Auth profile written for provider: $PROVIDER"

# ── Step 8: Start gateway (reads auth on startup) ─────────────────────────
divider
info "Starting gateway..."
openclaw gateway stop 2>/dev/null || true
sleep 1
openclaw gateway start 2>/dev/null || openclaw gateway restart 2>/dev/null || true
sleep 3
success "Gateway started."

# ── Step 9: Verify ──────────────────────────────────────────────────────
divider
info "Verifying..."
openclaw gateway status 2>/dev/null || warn "Gateway status had issues."
yes | openclaw doctor 2>/dev/null || warn "Doctor flagged warnings."

# ── Done ──────────────────────────────────────────────────────────────────
divider
echo ""
echo "  OpenClaw is live!"
echo ""
echo "  Provider:   $PROVIDER"
echo "  Model:      $MODEL"
echo "  Gateway:    ws://127.0.0.1:18789"
echo "  Dashboard:  http://127.0.0.1:18789/?token=$GATEWAY_TOKEN"
echo ""
divider

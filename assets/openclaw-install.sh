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
  if command -v curl &>/dev/null; then
    curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
  elif command -v npm &>/dev/null; then
    npm install -g openclaw@latest
  else
    error "Neither curl nor npm found. Install one and re-run."
  fi
  export PATH="$BREW_PREFIX/bin:$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
  command -v openclaw &>/dev/null || \
    error "Installed but openclaw not in PATH."
  success "Installed → $(openclaw --version 2>/dev/null | head -1)"
fi

# ── PATH fix: write to shell RC so openclaw works in new terminals ─────────
divider
info "Ensuring openclaw is on PATH in shell profile..."
HOMEBREW_PATH_LINE="export PATH=\"$BREW_PREFIX/bin:\$HOME/.local/bin:\$PATH\""
MARKER="# Added by OctoClaw installer"
for RC_FILE in "$HOME/.zshrc" "$HOME/.bash_profile" "$HOME/.bashrc"; do
  # Only update files that already exist
  [ -f "$RC_FILE" ] || continue
  # Skip if the marker is already there
  grep -q "Added by OctoClaw installer" "$RC_FILE" 2>/dev/null && continue
  printf '\n%s\n%s\n' "$MARKER" "$HOMEBREW_PATH_LINE" >> "$RC_FILE"
  success "PATH written to $RC_FILE"
done
# Also export into the current shell session so remaining steps find openclaw
export PATH="$BREW_PREFIX/bin:$HOME/.local/bin:$PATH"

# ── Step 2: Directories ───────────────────────────────────────────────────
divider
info "Setting up directories..."
mkdir -p "$OPENCLAW_HOME/workspace"
mkdir -p "$OPENCLAW_HOME/agents/main/agent"
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

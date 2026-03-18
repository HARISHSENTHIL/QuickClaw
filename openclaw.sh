set -euo pipefail

# ── CONFIG — paste your key here ─────────────────────────────────────────────
# =============================================================================

# ── Hardcoded defaults ────────────────────────────────────────────────────────
MODEL="openai/gpt-4o"
PROVIDER_LABEL="OpenAI"
OPENCLAW_HOME="$HOME/.openclaw"
CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"
ENV_FILE="$OPENCLAW_HOME/.env"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR ]${NC}  $*"; exit 1; }
divider() { echo -e "${CYAN}──────────────────────────────────────────────${NC}"; }

banner() {
  clear
  echo -e "${CYAN}${BOLD}"
  echo "   ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗"
  echo "  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║"
  echo "  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║"
  echo "  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║"
  echo "  ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝"
  echo "   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝"
  echo -e "${NC}"
  echo -e "  ${BOLD}One-Click Setup${NC} — zero interaction, fully automated."
  divider
}

# =============================================================================
banner

# ── Preflight ─────────────────────────────────────────────────────────────────
[ "$OPENAI_API_KEY" = "sk-your-key-here" ] && \
  error "Paste your OpenAI API key into the script before running."

# ── Step 1: Check / Install OpenClaw ─────────────────────────────────────────
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
  export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
  command -v openclaw &>/dev/null || \
    error "Installed but openclaw not in PATH. Open a new terminal and re-run."
  success "Installed → $(openclaw --version 2>/dev/null | head -1)"
fi

# ── Step 2: Create openclaw home + workspace ──────────────────────────────────
divider
info "Setting up openclaw directories..."

mkdir -p "$OPENCLAW_HOME/workspace"
mkdir -p "$OPENCLAW_HOME/agents/main/agent"
success "Directories ready."

# ── Step 3: Write .env with API key ──────────────────────────────────────────
divider
info "Writing API key to $ENV_FILE..."

cat > "$ENV_FILE" <<EOF
OPENAI_API_KEY=$OPENAI_API_KEY
EOF

chmod 600 "$ENV_FILE"
success "API key saved."

# ── Step 4: Generate a gateway token ─────────────────────────────────────────
divider
info "Generating gateway auth token..."
GATEWAY_TOKEN=$(openssl rand -hex 32)
success "Token generated."

# ── Step 5: Write openclaw.json config directly ───────────────────────────────
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
info "Gateway token: $GATEWAY_TOKEN"
info "(also saved to $ENV_FILE)"

# Save token to .env too
echo "OPENCLAW_GATEWAY_TOKEN=$GATEWAY_TOKEN" >> "$ENV_FILE"

# ── Step 6: Write auth profile with OpenAI key ───────────────────────────────
divider
info "Writing auth profile..."

mkdir -p "$OPENCLAW_HOME/agents/main/agent"

cat > "$OPENCLAW_HOME/agents/main/agent/auth-profiles.json" <<EOF
[
  {
    "id": "openai-default",
    "provider": "openai",
    "type": "api-key",
    "apiKey": "$OPENAI_API_KEY"
  }
]
EOF

chmod 600 "$OPENCLAW_HOME/agents/main/agent/auth-profiles.json"
success "Auth profile written."

# ── Step 7: Install gateway as daemon ─────────────────────────────────────────
divider
info "Installing gateway as daemon..."

openclaw gateway install && success "Daemon installed." || \
  warn "Daemon install failed — you may need to start gateway manually."

# ── Step 8: Start gateway ─────────────────────────────────────────────────────
divider
info "Starting gateway..."

openclaw gateway start 2>/dev/null || openclaw gateway restart 2>/dev/null || true
sleep 3
success "Gateway started."

# ── Step 9: Verify ────────────────────────────────────────────────────────────
divider
info "Verifying..."
echo ""
openclaw gateway status || warn "Gateway status had issues — see above"
echo ""
yes | openclaw doctor || warn "Doctor flagged warnings — review above"

# ── Done ──────────────────────────────────────────────────────────────────────
divider
echo ""
echo -e "${GREEN}${BOLD}  ✅  OpenClaw is live!${NC}"
echo ""
echo -e "  ${BOLD}Provider:${NC}   $PROVIDER_LABEL"
echo -e "  ${BOLD}Model:${NC}      $MODEL"
echo -e "  ${BOLD}Gateway:${NC}    ws://127.0.0.1:18789  (loopback)"
echo -e "  ${BOLD}Dashboard:${NC}  http://127.0.0.1:18789/?token=$GATEWAY_TOKEN"
echo ""
echo -e "  ${BOLD}To add Telegram later:${NC}"
echo "    openclaw config set channels.telegram.botToken YOUR_BOT_TOKEN"
echo "    openclaw config set channels.telegram.dmPolicy open"
echo "    openclaw gateway restart"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo "    openclaw tui               → terminal chat"
echo "    openclaw dashboard         → browser UI"
echo "    openclaw logs --follow     → live logs"
echo "    openclaw doctor            → health check"
echo ""
divider
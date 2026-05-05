#!/usr/bin/env bash
# clean-local.sh — wipe OctoClaw completely from this machine for a fresh test install
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
info() { echo -e "       $*"; }

echo ""
echo "  OctoClaw — Full Local Cleanup"
echo "  ────────────────────────────────────────"
echo ""

# ── 1. Stop & unload LaunchAgent ──────────────────────────────────────────
PLIST="$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist"
if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  ok "LaunchAgent stopped and removed"
else
  warn "LaunchAgent not found — skipping"
fi

# ── 2. Kill any running gateway process ───────────────────────────────────
if pgrep -f "openclaw" > /dev/null 2>&1; then
  pkill -f "openclaw" 2>/dev/null || true
  ok "Killed running openclaw processes"
else
  info "No running openclaw processes"
fi

# ── 3. Uninstall openclaw npm package ─────────────────────────────────────
if command -v openclaw &>/dev/null; then
  npm uninstall -g openclaw 2>/dev/null || true
  ok "Uninstalled openclaw npm package"
elif npm list -g openclaw 2>/dev/null | grep -q openclaw; then
  npm uninstall -g openclaw 2>/dev/null || true
  ok "Uninstalled openclaw npm package"
else
  warn "openclaw npm package not found — skipping"
fi

# ── 4. Remove ~/.openclaw config & workspace ──────────────────────────────
if [ -d "$HOME/.openclaw" ]; then
  rm -rf "$HOME/.openclaw"
  ok "Removed ~/.openclaw"
else
  warn "~/.openclaw not found — skipping"
fi

# ── 5. Remove app bundle ──────────────────────────────────────────────────
for APP_PATH in "/Applications/OctoClaw.app" "$HOME/Applications/OctoClaw.app"; do
  if [ -d "$APP_PATH" ]; then
    rm -rf "$APP_PATH"
    ok "Removed $APP_PATH"
  fi
done

# ── 6. Remove temp install script ─────────────────────────────────────────
if [ -f "/tmp/octoclaw-install.sh" ]; then
  rm -f "/tmp/octoclaw-install.sh"
  ok "Removed /tmp/octoclaw-install.sh"
fi

# ── 7. Clean prefs / caches ───────────────────────────────────────────────
rm -f "$HOME/Library/Preferences/ai.octoclaw.desktop.plist" 2>/dev/null || true
rm -rf "$HOME/Library/Application Support/OctoClaw" 2>/dev/null || true
rm -rf "$HOME/Library/Caches/ai.octoclaw.desktop" 2>/dev/null || true
rm -rf "$HOME/Library/Logs/OctoClaw" 2>/dev/null || true
ok "Cleaned prefs, caches, and logs"

# ── 8. Remove NVM ─────────────────────────────────────────────────────────
if [ -d "$HOME/.nvm" ]; then
  rm -rf "$HOME/.nvm"
  ok "Removed ~/.nvm"
else
  warn "~/.nvm not found — skipping"
fi

# ── 9. Remove OctoClaw-added lines from shell RC files ────────────────────
# The installer appended a block marked "# Added by OctoClaw installer"
# This removes that exact block from .zshrc / .bash_profile / .bashrc
for RC_FILE in "$HOME/.zshrc" "$HOME/.bash_profile" "$HOME/.bashrc"; do
  [ -f "$RC_FILE" ] || continue
  if grep -q "Added by OctoClaw installer" "$RC_FILE" 2>/dev/null; then
    # Delete from the marker line through the next 2 lines (HOMEBREW_PATH + NVM_INIT)
    sed -i '' '/# Added by OctoClaw installer/,+2d' "$RC_FILE"
    ok "Removed OctoClaw PATH lines from $RC_FILE"
  fi
done

# ── 10. Remove Node.js installed via Homebrew ─────────────────────────────
# Only removes if brew is available. Skip if you need Node for other projects.
if command -v brew &>/dev/null && brew list node &>/dev/null 2>&1; then
  brew uninstall node 2>/dev/null || true
  ok "Removed Node.js (Homebrew)"
else
  warn "Node.js (Homebrew) not found — skipping"
fi

echo ""
echo "  ────────────────────────────────────────"
echo "  Done. Machine is clean for a fresh install."
echo "  Open a new terminal tab before testing — shell RC changes need a reload."
echo ""

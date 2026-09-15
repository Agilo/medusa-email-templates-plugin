#!/usr/bin/env bash

# Starts a Cloudflare tunnel in the background if CLOUDFLARE_TUNNEL_TOKEN is set.
# Run this manually from the repository root when you want the tunnel.

set -uo pipefail

if [ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  echo "[start-tunnel] CLOUDFLARE_TUNNEL_TOKEN is not set. Add it to .devcontainer/.env first."
  exit 0
fi

# Kill any stale cloudflared process from a previous container start.
pkill -f "cloudflared tunnel run" 2>/dev/null || true

echo "[start-tunnel] Starting cloudflared tunnel (logs → /tmp/cloudflared.log)..."
nohup cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN" > /tmp/cloudflared.log 2>&1 &
echo "[start-tunnel] cloudflared started (PID $!)."

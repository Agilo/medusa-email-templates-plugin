#!/usr/bin/env bash

set -euo pipefail

fix_dir() {
  local path="$1"

  sudo install -d -m 0755 -o vscode -g vscode "$path"

  if [ "$(stat -c '%u:%g' "$path")" != "1000:1000" ]; then
    sudo chown -R vscode:vscode "$path"
  fi
}

fix_dir /home/vscode/.yarn
fix_dir /home/vscode/.yalc
fix_dir /workspaces/medusa-email-templates-plugin/node_modules
fix_dir /workspaces/medusa-email-templates-plugin/apps/dev-app/node_modules
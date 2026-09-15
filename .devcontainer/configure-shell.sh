#!/usr/bin/env bash

set -euo pipefail

bashrc="$HOME/.bashrc"
bash_start_marker="# >>> medusa-email-templates-plugin bash setup >>>"
bash_end_marker="# <<< medusa-email-templates-plugin bash setup <<<"
zshrc="$HOME/.zshrc"
zsh_start_marker="# >>> medusa-email-templates-plugin zsh setup >>>"
zsh_end_marker="# <<< medusa-email-templates-plugin zsh setup <<<"

bash_snippet=$(cat <<'EOF'
# >>> medusa-email-templates-plugin bash setup >>>
if [ -n "${BASH_VERSION:-}" ] && [ -f /usr/share/bash-completion/bash_completion ]; then
  . /usr/share/bash-completion/bash_completion
fi

if [[ "${TERM_PROGRAM:-}" == "vscode" ]] && command -v code >/dev/null 2>&1; then
  . "$(code --locate-shell-integration-path bash)"
fi

if [ -f /workspaces/medusa-email-templates-plugin/.devcontainer/bash-completion-yarn.sh ]; then
  . /workspaces/medusa-email-templates-plugin/.devcontainer/bash-completion-yarn.sh
fi

if declare -F _completion_loader >/dev/null 2>&1; then
  _completion_loader git >/dev/null 2>&1 || true
fi
# <<< medusa-email-templates-plugin bash setup <<<
EOF
)

zsh_snippet=$(cat <<'EOF'
# >>> medusa-email-templates-plugin zsh setup >>>
if [[ "${TERM_PROGRAM:-}" == "vscode" ]] && command -v code >/dev/null 2>&1; then
  . "$(code --locate-shell-integration-path zsh)"
fi

fpath=(/workspaces/medusa-email-templates-plugin/.devcontainer/zsh-completions $fpath)
autoload -Uz compinit
compinit -d "$HOME/.zcompdump"

if [ -f /usr/local/share/zsh-plugins/zsh-autosuggestions/zsh-autosuggestions.zsh ]; then
  . /usr/local/share/zsh-plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
fi

if [ -f /usr/local/share/zsh-plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]; then
  . /usr/local/share/zsh-plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
fi

zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'
setopt AUTO_MENU COMPLETE_IN_WORD
# <<< medusa-email-templates-plugin zsh setup <<<
EOF
)

replace_block() {
  local file="$1"
  local start_marker="$2"
  local end_marker="$3"
  local replacement="$4"
  local tmp_file

  touch "$file"

  if grep -Fq "$start_marker" "$file"; then
    tmp_file="$(mktemp)"
    awk -v start="$start_marker" -v end="$end_marker" -v repl="$replacement" '
      $0 == start {
        print repl
        skip=1
        next
      }
      $0 == end {
        skip=0
        next
      }
      skip != 1 { print }
    ' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
  else
    printf '\n%s\n' "$replacement" >> "$file"
  fi
}

replace_block "$bashrc" "$bash_start_marker" "$bash_end_marker" "$bash_snippet"
replace_block "$zshrc" "$zsh_start_marker" "$zsh_end_marker" "$zsh_snippet"
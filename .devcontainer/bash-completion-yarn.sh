#!/usr/bin/env bash

_copilot_yarn_find_package_json() {
  local dir="$PWD"

  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/package.json" ]]; then
      printf '%s/package.json\n' "$dir"
      return 0
    fi

    dir="$(dirname "$dir")"
  done

  return 1
}

_copilot_yarn_list_scripts() {
  local package_json

  package_json="$(_copilot_yarn_find_package_json)" || return 0

  node -e "const fs=require('fs'); const file=process.argv[1]; const pkg=JSON.parse(fs.readFileSync(file,'utf8')); const scripts=Object.keys(pkg.scripts||{}); process.stdout.write(scripts.join(' '));" "$package_json" 2>/dev/null
}

_copilot_yarn_complete_from_words() {
  local current="$1"
  shift

  COMPREPLY=( $(compgen -W "$*" -- "$current") )
}

_copilot_yarn_completion() {
  local current previous scripts commands

  COMPREPLY=()
  current="${COMP_WORDS[COMP_CWORD]}"
  previous="${COMP_WORDS[COMP_CWORD-1]}"
  scripts="$(_copilot_yarn_list_scripts)"
  commands="add bin cache config constraints dedupe dlx exec explain info init install link node npm pack patch patch-commit plugin rebuild remove run set stage up unplug version why workspace workspaces"

  case "$previous" in
    run)
      _copilot_yarn_complete_from_words "$current" $scripts
      return 0
      ;;
    workspace)
      if [[ -f "$PWD/package.json" ]]; then
        COMPREPLY=( $(node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const names=[]; const workspaces=pkg.workspaces||[]; for (const item of workspaces) { if (typeof item === 'string' && !item.startsWith('!')) names.push(item); } process.stdout.write(names.join(' '));" "$PWD/package.json" 2>/dev/null | xargs -r printf '%s\n' | compgen -W "$(cat)" -- "$current") )
      fi
      return 0
      ;;
  esac

  if [[ "$current" == -* ]]; then
    _copilot_yarn_complete_from_words "$current" --cwd --top-level --immutable --immutable-cache --refresh-lockfile --mode --verbose --json --help --version
    return 0
  fi

  if [[ $COMP_CWORD -eq 1 ]]; then
    _copilot_yarn_complete_from_words "$current" $commands $scripts
    return 0
  fi
}

complete -o bashdefault -o default -F _copilot_yarn_completion yarn
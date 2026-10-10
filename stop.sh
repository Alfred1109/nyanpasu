#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:---desktop}"
case "$mode" in
  --service)
    sudo -n systemctl stop elaina-nyanpasu-service.service
    exit 0
    ;;
  --installed)
    for installed_pid in $(pgrep -u "$(id -u)" -x nyanpasu || true); do
      installed_exe="$(readlink "/proc/$installed_pid/exe" || true)"
      if [[ "$installed_exe" == /usr/bin/nyanpasu || "$installed_exe" == '/usr/bin/nyanpasu (deleted)' ]]; then
        kill -TERM "$installed_pid"
        for ((attempt=0; attempt<30; attempt++)); do
          kill -0 "$installed_pid" 2>/dev/null || break
          sleep 0.2
        done
        if kill -0 "$installed_pid" 2>/dev/null; then
          echo 'Installed application did not stop; refusing to continue.' >&2
          exit 1
        fi
      fi
    done
    rm -f "$project_dir/.run/installed.pid"
    echo 'Stopped installed application'
    exit 0
    ;;
  --desktop|--web|--core) ;;
  *) echo "Usage: $0 [--desktop|--web|--core|--installed|--service]" >&2; exit 2 ;;
esac
pid_file="$project_dir/.run/${mode#--}.pid"
[[ -f "$pid_file" ]] || { echo "${mode#--} is not running"; exit 0; }
project_pid="$(cat "$pid_file")"
[[ "$project_pid" =~ ^[0-9]+$ ]] || { echo 'Invalid PID file' >&2; exit 1; }
if kill -0 "$project_pid" 2>/dev/null; then
  if [[ "$(readlink -f "/proc/$project_pid/cwd")" != "$project_dir" ]]; then
    echo 'PID belongs to another workspace; refusing to stop it.' >&2
    exit 1
  fi
  kill -TERM -- "-$project_pid"
fi
rm -f "$pid_file"
echo "Stopped ${mode#--}"

#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
runtime_dir="$project_dir/.run"
mode="${1:---desktop}"
web_port="${NYANPASU_WEB_PORT:-3000}"
case "$mode" in
  --service)
    sudo -n systemctl start elaina-nyanpasu-service.service
    exit 0
    ;;
  --installed)
    [[ -x /usr/bin/nyanpasu ]] || { echo 'Installed application is missing.' >&2; exit 1; }
    task_args=()
    ;;
  --desktop) task_args=(tauri:dev) ;;
  --core)
    core_config="${NYANPASU_CORE_CONFIG:?Set NYANPASU_CORE_CONFIG to an isolated core configuration}"
    core_binary="${NYANPASU_CORE_BINARY:-$project_dir/backend/tauri/sidecar/mihomo-$(rustc -vV | sed -n 's/^host: //p')}"
    [[ -x "$core_binary" && -f "$core_config" ]] || { echo 'Core binary or configuration is missing.' >&2; exit 1; }
    mkdir -p "$runtime_dir/core"
    "$core_binary" -t -d "$runtime_dir/core" -f "$core_config"
    task_args=(-d "$runtime_dir/core" -f "$core_config")
    ;;
  --web) task_args=(--filter @nyanpasu/nyanpasu dev --host 127.0.0.1 --port "$web_port" --strictPort) ;;
  *) echo "Usage: $0 [--desktop|--web|--core|--installed|--service]" >&2; exit 2 ;;
esac
mkdir -p "$runtime_dir"
pid_file="$runtime_dir/${mode#--}.pid"
if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
  echo "${mode#--} is already running (PID $(cat "$pid_file"))"
  exit 0
fi
cd "$project_dir"
if [[ "$mode" == --web ]] && (echo > "/dev/tcp/127.0.0.1/$web_port") 2>/dev/null; then
  echo "Port $web_port is in use. Choose another NYANPASU_WEB_PORT." >&2
  exit 1
fi
if [[ "$mode" == --installed ]]; then
  package_runner=(/usr/bin/nyanpasu)
elif [[ "$mode" == --core ]]; then
  package_runner=("$core_binary")
elif command -v pnpm >/dev/null 2>&1; then
  package_runner=(pnpm)
else
  package_runner=(npx --yes pnpm@10.26.1)
fi
setsid "${package_runner[@]}" "${task_args[@]}" >"$runtime_dir/${mode#--}.log" 2>&1 < /dev/null &
project_pid=$!
echo "$project_pid" > "$pid_file"
sleep 1
if ! kill -0 "$project_pid" 2>/dev/null; then
  rm -f "$pid_file"
  cat "$runtime_dir/${mode#--}.log" >&2
  exit 1
fi
if [[ "$mode" == --web ]]; then
  for ((attempt=0; attempt<30; attempt++)); do
    if ! kill -0 "$project_pid" 2>/dev/null; then
      rm -f "$pid_file"
      cat "$runtime_dir/web.log" >&2
      exit 1
    fi
    if curl --noproxy '*' --silent --fail "http://127.0.0.1:$web_port" >/dev/null; then
      echo "Web preview: http://127.0.0.1:$web_port"
      break
    fi
    sleep 1
  done
  if ((attempt == 30)); then
    "$project_dir/stop.sh" --web
    echo "Web preview did not become ready. See $runtime_dir/web.log" >&2
    exit 1
  fi
fi
echo "Started ${mode#--} (PID $project_pid). Log: $runtime_dir/${mode#--}.log"

#!/usr/bin/env bash
set -euo pipefail

# Idempotent SessionStart helper. It keeps one loopback SCALE Responses gateway
# alive. Codex uses its built-in OpenAI provider; the gateway routes each
# opencode-go/<model> slug to the correct OpenCode Go protocol.

project_root="${1:-$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PWD")}"
if [[ ! -d "$project_root" ]]; then
  printf 'S.C.A.L.E.: native OpenCode autostart skipped; project is not a directory: %s\n' "$project_root" >&2
  exit 0
fi

codex_home="${SCALE_CODEX_HOME:-${CODEX_HOME:-/Users/lxxvii/.codex}}"
gateway_port="${SCALE_OPENCODE_GATEWAY_PORT:-${SCALE_OPENCODE_SHIM_PORT:-8787}}"
config_file="$codex_home/config.toml"
if [[ ! -f "$config_file" ]] || ! rg -q "^openai_base_url = \"http://127\\.0\\.0\\.1:${gateway_port}/v1\"$" "$config_file"; then
  printf '%s\n' 'S.C.A.L.E.: native OpenCode gateway disabled; Codex is using its safe built-in route.'
  exit 0
fi
runtime_dir="${SCALE_OPENCODE_RUNTIME_DIR:-$codex_home/run/scale-opencode}"
mkdir -p "$runtime_dir"
chmod 700 "$runtime_dir"
marker_file="$runtime_dir/project-root"
marker_tmp="$marker_file.tmp.$$"
printf '%s\n' "$project_root" > "$marker_tmp"
chmod 600 "$marker_tmp"
mv -f "$marker_tmp" "$marker_file"

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
gateway_script="$script_root/scripts/scale-opencode-native-gateway.mjs"
gateway_log="$runtime_dir/native-gateway.log"
gateway_pid_file="$runtime_dir/native-gateway.pid"

if ! curl --silent --show-error --fail --max-time 2 "http://127.0.0.1:${gateway_port}/healthz" >/dev/null 2>&1; then
  if [[ -f "$gateway_pid_file" ]] && kill -0 "$(cat "$gateway_pid_file")" 2>/dev/null; then
    printf '%s\n' 'S.C.A.L.E.: native gateway pid exists but health is unavailable; leaving it untouched.' >&2
  else
    SCALE_OPENCODE_GATEWAY_PORT="$gateway_port" \
      nohup node "$gateway_script" >"$gateway_log" 2>&1 < /dev/null &
    printf '%s\n' "$!" > "$gateway_pid_file"
    chmod 600 "$gateway_pid_file"
  fi
fi

for _ in $(seq 1 40); do
  curl --silent --show-error --fail --max-time 1 "http://127.0.0.1:${gateway_port}/healthz" >/dev/null 2>&1 && break
  sleep 0.1
done
if curl --silent --show-error --fail --max-time 2 "http://127.0.0.1:${gateway_port}/healthz" >/dev/null 2>&1; then
  printf '%s\n' "S.C.A.L.E.: native OpenCode gateway ready for $project_root."
else
  printf '%s\n' 'S.C.A.L.E.: native OpenCode gateway did not reach health; inspect ~/.codex/run/scale-opencode/native-gateway.log.' >&2
fi

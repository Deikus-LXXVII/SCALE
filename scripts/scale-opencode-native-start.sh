#!/usr/bin/env bash
set -euo pipefail

# Starts the loopback SCALE Responses gateway. Credentials are read by the
# gateway from the existing OpenCode auth store and are never printed.

gateway_port="${SCALE_OPENCODE_GATEWAY_PORT:-${SCALE_OPENCODE_SHIM_PORT:-8787}}"
gateway_script="$(cd "$(dirname "$0")" && pwd)/scale-opencode-native-gateway.mjs"
exec env SCALE_OPENCODE_GATEWAY_PORT="$gateway_port" node "$gateway_script"

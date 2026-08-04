#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 ]]; then
  printf '%s\n' 'Usage: scale-hermes-route.sh <role> <work-order>' >&2
  exit 2
fi

role="$1"
shift
work_order="$*"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
registry="$(cd "$script_dir/.." && pwd)/model-routing.json"

route_json="$(python3 - "$registry" "$role" <<'PY'
import json
import sys
from pathlib import Path

registry = json.loads(Path(sys.argv[1]).read_text())
role = sys.argv[2]
role_class = registry["roles"].get(role)
if role_class is None:
    raise SystemExit(f"unknown SCALE Hermes role: {role}")
route = dict(registry["policy"][role_class])
route["role_class"] = role_class
print(json.dumps(route, separators=(",", ":")))
PY
)"

read_route() {
  python3 - "$route_json" "$1" <<'PY'
import json
import sys
route = json.loads(sys.argv[1])
value = route
for key in sys.argv[2].split('.'):
    value = value[key]
print(value)
PY
}

run_route() {
  local provider="$1" model="$2" effort="$3"
  hermes --provider "$provider" --model "$model" --reasoning "$effort" -z "$work_order"
}

provider="$(read_route provider)"
model="$(read_route model)"
effort="$(read_route reasoning_effort)"

if run_route "$provider" "$model" "$effort"; then
  exit 0
fi

fallback_provider="$(read_route fallback.provider 2>/dev/null || true)"
fallback_model="$(read_route fallback.model 2>/dev/null || true)"
fallback_effort="$(read_route fallback.reasoning_effort 2>/dev/null || true)"
if [[ -z "$fallback_provider" || -z "$fallback_model" || -z "$fallback_effort" ]]; then
  exit 1
fi

printf 'S.C.A.L.E. Hermes: primary route failed; using named fallback %s/%s (%s).\n' \
  "$fallback_provider" "$fallback_model" "$fallback_effort" >&2
run_route "$fallback_provider" "$fallback_model" "$fallback_effort"

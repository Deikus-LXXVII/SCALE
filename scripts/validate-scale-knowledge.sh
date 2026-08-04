#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$root/scripts/validate-scale-knowledge.mjs" "$@"

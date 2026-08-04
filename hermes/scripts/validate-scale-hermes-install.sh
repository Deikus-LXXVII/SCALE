#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hermes_root="$(cd "$script_dir/.." && pwd)"
scale_root="$(cd "$hermes_root/.." && pwd)"
workspace="$(mktemp -d "${TMPDIR:-/tmp}/scale-hermes.XXXXXX")"
trap 'rm -rf "$workspace"' EXIT

HERMES_HOME="$workspace/hermes" bash "$hermes_root/scripts/install-scale-hermes.sh" --no-enable-plugin >/dev/null
[[ "$(readlink "$workspace/hermes/scale")" == "$scale_root" ]]
for skill_dir in "$hermes_root"/skills/*; do
  [[ -d "$skill_dir" ]] || continue
  skill="$(basename "$skill_dir")"
  target="$workspace/hermes/skills/software-development/$skill"
  [[ -L "$target" ]]
  [[ -f "$target/SKILL.md" ]]
  grep -q '^name: ' "$target/SKILL.md"
done
plugin="$workspace/hermes/plugins/scale-hermes"
[[ -L "$plugin" ]]
[[ -f "$plugin/plugin.yaml" ]]
[[ -f "$plugin/__init__.py" ]]
python3 -m json.tool "$hermes_root/model-routing.json" >/dev/null
bash -n "$hermes_root/scripts/scale-hermes-project-sync.sh"
bash -n "$hermes_root/scripts/scale-hermes-route.sh"

printf '%s\n' 'Validated Hermes-native SCALE links, plugin, routing registry, and skill frontmatter.'

#!/bin/sh
# library/find-by-tag.sh — cheap, programmatic tag search over the S.C.A.L.E. library.
# Usage: find-by-tag.sh <tag> [more-tags...]
# OR-matches across the given tags (any listed tag counts as a match).
# Prints:  <matched-tag><TAB><file-path>   (one line per match; a file with two matching
# tags among the ones queried prints twice — intentional, for search transparency)
#
# Zero non-POSIX dependencies: sh + grep/awk only, matching this repo's no-build-step,
# no-extra-runtime philosophy. Two different tag-storage formats are handled:
#   - library/rules/*.md, library/books/*.md: YAML frontmatter `tags: [a, b, c]`
#     (single-line flow-sequence only — this is an intentional
#     constraint, not an oversight: a full YAML block-sequence parser would need a
#     jq/python3 dependency this repo deliberately avoids).
#   - library/agents/*.md: YAML frontmatter `tags: [...]` (the same format as
#     rules/books; legacy `## Tags` body sections remain supported).

set -eu

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <tag> [more-tags...]" >&2
    exit 1
fi

# Resolve the library root as "wherever this script itself lives" — this is what makes
# the same script work identically whether invoked from the installed global copy
# (a copied project library/find-by-tag.sh) or this repository's own local copy
# (library/find-by-tag.sh) — no path configuration needed by any caller.
LIB_DIR="$(cd "$(dirname "$0")" && pwd)"

for tag in "$@"; do
    # --- 1. library/rules/*.md and library/books/*.md: YAML frontmatter `tags: [...]` ---
    for f in "$LIB_DIR"/rules/*.md "$LIB_DIR"/books/*.md; do
        [ -f "$f" ] || continue
        [ "$(basename "$f")" = "README.md" ] && continue
        awk -v tag="$tag" -v file="$f" '
            BEGIN { fmcount = 0 }
            /^---[ \t]*$/ {
                fmcount++
                if (fmcount == 2) exit
                next
            }
            fmcount == 1 && /^tags:/ {
                line = $0
                sub(/^tags:[ \t]*\[?/, "", line)
                sub(/\][ \t]*$/, "", line)
                n = split(line, parts, ",")
                for (i = 1; i <= n; i++) {
                    t = parts[i]
                    gsub(/^[ \t"]+|[ \t"]+$/, "", t)
                    if (t == tag) print tag "\t" file
                }
            }
        ' "$f"
    done

    # --- 2. library/agents/*.md: YAML frontmatter, with a legacy body fallback ---
    for f in "$LIB_DIR"/agents/*.md; do
        [ -f "$f" ] || continue
        [ "$(basename "$f")" = "README.md" ] && continue
        awk -v tag="$tag" -v file="$f" '
            /^---[ \t]*$/ {
                fmcount++
                if (fmcount == 2) exit
                next
            }
            fmcount == 1 && /^tags:/ {
                line = $0
                sub(/^tags:[ \t]*\[?/, "", line)
                sub(/\][ \t]*$/, "", line)
                n = split(line, parts, ",")
                for (i = 1; i <= n; i++) {
                    t = parts[i]
                    gsub(/^[ \t"]+|[ \t"]+$/, "", t)
                    if (t == tag) print tag "\t" file
                }
            }
            /^## Tags[ \t]*$/ { armed = 1; next }
            armed && NF == 0 { next }
            armed {
                n = split($0, parts, ",")
                for (i = 1; i <= n; i++) {
                    t = parts[i]
                    gsub(/^[ \t]+|[ \t]+$/, "", t)
                    if (t == tag) print tag "\t" file
                }
                armed = 0
            }
        ' "$f"
    done
done

#!/usr/bin/env bash
# Reject obsolete references in every file, except the two historical sources.
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
scan_root=${1:-"$script_dir/.."}
if (( $# > 1 )) || [[ ! -d "$scan_root" ]]; then
  printf 'Usage: %s [existing game or fixture directory]\n' "$0" >&2
  exit 1
fi
cd -- "$scan_root"

# Split the literals so the checker and its tests can scan their own source.
stale_references=(
  'icds''/'
  'design''/'
  'roadmap''.md'
  'METHODOLOGY''.md'
  'Metropolitan'' Chronicle'
)
grep_patterns=()
for reference in "${stale_references[@]}"; do
  grep_patterns+=(-e "$reference")
done

# Materialize traversal first: a find/read error must fail, not look like no matches.
file_list=$(mktemp)
trap 'rm -f -- "$file_list"' EXIT
find . -type f ! -path './docs/DIRECTION.md' ! -path './CHANGELOG.md' \
  -print0 > "$file_list"

failed=0
while IFS= read -r -d '' file; do
  # Fixed strings, case-insensitive; include hidden files and arbitrary extensions.
  if LC_ALL=C grep -nHiF "${grep_patterns[@]}" -- "$file"; then
    failed=1
  else
    status=$?
    if (( status != 1 )); then
      printf 'Could not check %s\n' "$file" >&2
      exit 1
    fi
  fi
done < "$file_list"

if (( failed )); then
  printf 'Stale references found; update the files listed above.\n' >&2
  exit 1
fi
printf 'Documentation references: pass.\n'

#!/usr/bin/env bash
# linkcheck.sh — verify that every relative <a href> in index.html
# resolves to a real file on disk. Exit 0 if all good, 1 otherwise.
#
# Usage: bash scripts/linkcheck.sh
#
# Designed for pre-commit hooks or CI. No dependencies beyond
# bash + grep + sed (no Perl regex, macOS-compatible).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LAUNCHER="$ROOT_DIR/index.html"

if [[ ! -f "$LAUNCHER" ]]; then
  echo "ERROR: index.html not found at $LAUNCHER" >&2
  exit 1
fi

echo "🔗 Checking links in index.html …"
echo ""

# Extract href values from <a ... href="..."> tags.
# Works with single or double quotes, handles attributes before/after href.
LINKS=$(grep -o 'href="[^"]*"' "$LAUNCHER" | sed 's/href="//;s/"//' || true)

TOTAL=0
PASS=0
FAIL=0

while IFS= read -r link; do
  # Skip empty lines
  [[ -z "$link" ]] && continue

  # Skip external URLs (http://, https://, mailto:, etc.)
  [[ "$link" =~ ^(https?:|mailto:|tel:|ftp:) ]] && continue

  # Skip anchor-only links
  [[ "$link" =~ ^# ]] && continue

  TOTAL=$((TOTAL + 1))
  TARGET="$ROOT_DIR/$link"

  # Directory-style links (e.g. forge-defense/) → check for index.html inside
  if [[ "$link" == */ ]]; then
    TARGET="${TARGET}index.html"
  fi

  if [[ -f "$TARGET" ]]; then
    echo "  ✓ $link"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $link → $TARGET (missing)" >&2
    FAIL=$((FAIL + 1))
  fi
done <<< "$LINKS"

echo ""
echo "─────────────────────────"
echo "  $PASS/$TOTAL links OK"

if [[ $FAIL -gt 0 ]]; then
  echo "  $FAIL broken link(s)!" >&2
  echo "─────────────────────────" >&2
  exit 1
else
  echo "─────────────────────────"
  exit 0
fi
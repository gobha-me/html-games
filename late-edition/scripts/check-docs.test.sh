#!/usr/bin/env bash
# Exercise rejection independently for every forbidden reference and exemption.
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
checker="$script_dir/check-docs.sh"
fixture=$(mktemp -d)
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/clean/docs" "$fixture/clean/scripts" "$fixture/dirty/nested space"

# Keep stale tokens split here too: these tests are themselves checked by CI.
stale_references=(
  'icds''/'
  'design''/'
  'roadmap''.md'
  'METHODOLOGY''.md'
  'Metropolitan'' Chronicle'
)
printf 'The Evening Star; The Daily Herald; The Observer Syndicate.\n' \
  > "$fixture/clean/README.md"
printf '%s\n' "${stale_references[@]}" > "$fixture/clean/docs/DIRECTION.md"
printf '%s\n' "${stale_references[@]}" > "$fixture/clean/CHANGELOG.md"
cp -- "$checker" "$fixture/clean/scripts/check-docs.sh"

checks=0
expect_status() {
  local expected=$1
  shift
  local actual=0 output
  output=$(bash "$checker" "$@" 2>&1) || actual=$?
  if (( actual != expected )); then
    printf 'Expected exit %s, got %s: %s\n' "$expected" "$actual" "$output" >&2
    exit 1
  fi
  checks=$((checks + 1))
}

expect_status 0 "$fixture/clean"
# Installed dependencies (also nested ones) must not pollute project checks.
for dependency_path in node_modules/vendor nested/node_modules/vendor; do
  mkdir -p "$fixture/clean/$dependency_path"
  printf '%s\n' "${stale_references[@]}" > "$fixture/clean/$dependency_path/README.md"
done
expect_status 0 "$fixture/clean"
# A similarly named project directory must still be checked.
mkdir -p "$fixture/dirty/node_modules-not-vendor"
printf '%s\n' "${stale_references[0]}" > "$fixture/dirty/node_modules-not-vendor/README.md"
expect_status 1 "$fixture/dirty"
rm -- "$fixture/dirty/node_modules-not-vendor/README.md"
mkdir "$fixture/empty"
expect_status 0 "$fixture/empty"

# No extension whitelist, no case-sensitive loophole, and no hidden-file bypass.
for reference in "${stale_references[@]}"; do
  printf 'stale: %s\n' "$reference" > "$fixture/dirty/nested space/reference.txt"
  expect_status 1 "$fixture/dirty"
  rm -- "$fixture/dirty/nested space/reference.txt"
  printf '%s\n' "${reference^^}" > "$fixture/dirty/.hidden"
  expect_status 1 "$fixture/dirty"
  rm -- "$fixture/dirty/.hidden"
done

# Exact path exemptions only: similarly named files elsewhere are still scanned.
for relative_path in nested/CHANGELOG.md nested/docs/DIRECTION.md docs/notes.md; do
  mkdir -p -- "$fixture/dirty/$(dirname -- "$relative_path")"
  printf '%s\n' "${stale_references[0]}" > "$fixture/dirty/$relative_path"
  expect_status 1 "$fixture/dirty"
  rm -- "$fixture/dirty/$relative_path"
done

# Even a binary-looking file must not conceal an obsolete reference.
printf '\0%s\0' "${stale_references[4]}" > "$fixture/dirty/reference.bin"
expect_status 1 "$fixture/dirty"
rm -- "$fixture/dirty/reference.bin"
expect_status 0 "$fixture/dirty"

# Missing roots and invalid invocations must fail closed.
expect_status 1 "$fixture/missing"
expect_status 1 "$fixture/clean/README.md"
expect_status 1 "$fixture/clean" extra-argument

# Default root is relative to the checker, independent of the caller's directory.
(cd -- "$fixture" && bash "$fixture/clean/scripts/check-docs.sh" > /dev/null)
checks=$((checks + 1))
printf 'Documentation checker self-tests: %s passed.\n' "$checks"

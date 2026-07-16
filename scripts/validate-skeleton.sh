#!/bin/sh
# Offline-only repository structure validation; never changes network state.
set -eu

required='AGENTS.md README.md .gitignore docs/requirements.md docs/architecture.md docs/network-model.md docs/security-model.md docs/milestones.md docs/testing-strategy.md builder/README.md'
for path in $required; do
  test -f "$path" || { echo "missing required file: $path" >&2; exit 1; }
done

for package in luci-app-linehub linehub-core linehubd linehub-firewall linehub-balance linehub-diagnostics; do
  test -f "packages/$package/Makefile" || { echo "missing package Makefile: $package" >&2; exit 1; }
done

for directory in tests/unit tests/integration tests/fixtures; do
  test -d "$directory" || { echo "missing test directory: $directory" >&2; exit 1; }
done

if rg -n --glob '!AGENTS.md' '(BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|AKIA[0-9A-Z]{16})' .; then
  echo 'potential secret material found' >&2
  exit 1
fi

printf '%s\n' 'LineHub OS skeleton validation passed.'

#!/bin/sh
# Offline-only repository validation; never changes network state.
set -eu

required='AGENTS.md README.md .gitignore docs/requirements.md docs/architecture.md docs/network-model.md docs/security-model.md docs/milestones.md docs/testing-strategy.md builder/README.md packages/luci-app-linehub/htdocs/luci-static/resources/view/linehub/overview.js packages/luci-app-linehub/root/usr/share/luci/menu.d/luci-app-linehub.json packages/luci-app-linehub/root/usr/share/rpcd/acl.d/luci-app-linehub.json packages/luci-app-linehub/root/usr/share/rpcd/ucode/linehub.uc packages/linehub-core/files/usr/sbin/linehub-validate tests/unit/test-linehub-validate.sh'
for path in $required; do
  test -f "$path" || { echo "missing required file: $path" >&2; exit 1; }
done

for package in luci-app-linehub linehub-core linehubd linehub-firewall linehub-balance linehub-diagnostics; do
  test -f "packages/$package/Makefile" || { echo "missing package Makefile: $package" >&2; exit 1; }
done

for directory in tests/unit tests/integration tests/fixtures; do
  test -d "$directory" || { echo "missing test directory: $directory" >&2; exit 1; }
done

sh -n scripts/validate-skeleton.sh packages/linehub-core/files/usr/sbin/linehub-validate tests/unit/test-linehub-validate.sh packages/linehubd/files/etc/init.d/linehubd packages/linehubd/files/usr/sbin/linehubd
node --check packages/luci-app-linehub/htdocs/luci-static/resources/view/linehub/overview.js
jq empty packages/luci-app-linehub/root/usr/share/luci/menu.d/luci-app-linehub.json
jq empty packages/luci-app-linehub/root/usr/share/rpcd/acl.d/luci-app-linehub.json

tests/unit/test-linehub-validate.sh

if rg -n --glob '!AGENTS.md' '(BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|AKIA[0-9A-Z]{16})' .; then
  echo 'potential secret material found' >&2
  exit 1
fi

printf '%s\n' 'LineHub OS offline validation passed.'

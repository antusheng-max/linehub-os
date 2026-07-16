#!/bin/sh
# Offline-only repository structure validation; never changes network state.
set -eu

required='.gitattributes AGENTS.md README.md .gitignore docs/requirements.md docs/architecture.md docs/network-model.md docs/security-model.md docs/milestones.md docs/testing-strategy.md builder/README.md'
for path in $required; do
  test -f "$path" || { echo "missing required file: $path" >&2; exit 1; }
done

modern_luci='packages/luci-app-linehub/htdocs/luci-static/resources/view/linehub/overview.js packages/luci-app-linehub/root/usr/share/luci/menu.d/luci-app-linehub.json packages/luci-app-linehub/root/usr/share/rpcd/acl.d/luci-app-linehub.json packages/luci-app-linehub/root/usr/share/rpcd/ucode/linehub'
for path in $modern_luci; do
  test -f "$path" || { echo "missing modern LuCI file: $path" >&2; exit 1; }
done

runtime_validator='packages/linehub-core/files/usr/sbin/linehub-validate'
test -f "$runtime_validator" || { echo 'missing runtime UCI validator' >&2; exit 1; }
test ! -e scripts/linehub_uci.py || { echo 'duplicate Python UCI validator must not exist' >&2; exit 1; }
head -n 1 "$runtime_validator" | grep -qx '#!/bin/sh' || { echo 'runtime validator must use POSIX sh' >&2; exit 1; }
if rg -ni '\bpython([0-9.]*)?\b' "$runtime_validator"; then
  echo 'runtime validator must not depend on Python' >&2
  exit 1
fi
rg -q 'linehub-validate' tests/unit/test_linehub_uci.py || {
  echo 'unit tests must invoke the installed runtime validator' >&2
  exit 1
}

if rg -n 'ipv4_address|ipv4_netmask' \
  packages/linehub-core/files/etc/config/linehub \
  tests/fixtures/linehub-example.uci \
  docs/architecture.md; then
  echo 'legacy LAN IPv4 fields found' >&2
  exit 1
fi

for old_luci in \
  packages/luci-app-linehub/luasrc/controller/linehub.lua \
  packages/luci-app-linehub/luasrc/view/linehub/overview.htm \
  packages/luci-app-linehub/root/usr/lib/lua/luci/linehub.lua \
  packages/luci-app-linehub/luasrc/model/cbi/.gitkeep \
  packages/luci-app-linehub/luasrc/view/linehub/.gitkeep; do
  test ! -e "$old_luci" || { echo "legacy LuCI file still present: $old_luci" >&2; exit 1; }
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

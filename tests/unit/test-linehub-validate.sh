#!/bin/sh
# Offline fixture tests for the POSIX shell/awk validator.
set -eu

validator=${LINEHUB_VALIDATOR:-packages/linehub-core/files/usr/sbin/linehub-validate}
outdir=${TMPDIR:-/tmp}/linehub-validate-test-$$
mkdir -p "$outdir"
trap 'rm -rf "$outdir"' EXIT HUP INT TERM

run_valid() {
	fixture=$1
	"$validator" "tests/fixtures/$fixture" >"$outdir/$fixture.out" 2>&1
	grep -F 'password=<redacted>' "$outdir/$fixture.out" >/dev/null
}
run_invalid() {
	fixture=$1 expected=$2
	if "$validator" "tests/fixtures/$fixture" >"$outdir/$fixture.out" 2>&1; then
		echo "expected invalid fixture to fail: $fixture" >&2
		exit 1
	fi
	grep -F "$expected" "$outdir/$fixture.out" >/dev/null
}

run_valid valid-multi-vlan.uci
run_valid valid-single-vlan.uci
run_invalid invalid-vlan-range.uci 'field=vid'
run_invalid invalid-missing-wan-id.uci 'field=wan_id'
run_invalid invalid-missing-device-ifname.uci 'field=ifname'
run_invalid invalid-missing-vlan-ifname.uci 'field=ifname'
run_invalid invalid-missing-pppoe-username.uci 'field=username'
run_invalid invalid-empty-pool.uci 'field=member'
run_invalid invalid-duplicate-mac.uci 'field=macaddr'
run_invalid invalid-duplicate-vlan-subinterface.uci 'field=vid'
run_invalid invalid-weight.uci 'field=weight'
run_invalid invalid-ipv4-toggle.uci 'field=ipv4'
run_invalid invalid-ipv6-toggle.uci 'field=ipv6'
run_invalid invalid-mac.uci 'field=macaddr'
run_invalid invalid-duplicate-wan-id.uci 'field=wan_id'
run_invalid invalid-missing-vlan.uci 'field=vlan'
run_invalid invalid-missing-pool.uci 'field=pool'
run_invalid invalid-ipv4-cidr.uci 'field=ipv4_cidr'
run_invalid invalid-non-ula.uci 'field=ula_prefix'
run_invalid invalid-ula-fd-short.uci 'field=ula_prefix'
run_invalid invalid-ula-extra-colons.uci 'field=ula_prefix'
run_invalid invalid-ula-non-hex.uci 'field=ula_prefix'

if grep -R -F --include='*.out' -e 'multi-vlan-secret-alpha' -e 'multi-vlan-secret-beta' "$outdir"; then
	echo 'validator output exposed a fixture password' >&2
	exit 1
fi
printf '%s\n' 'linehub validator fixture tests passed (passwords redacted).'

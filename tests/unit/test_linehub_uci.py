"""Test driver for the installed LineHub POSIX Shell/AWK validator."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]
FIXTURES = REPOSITORY / "tests" / "fixtures"
VALIDATOR = (
    REPOSITORY
    / "packages"
    / "linehub-core"
    / "files"
    / "usr"
    / "sbin"
    / "linehub-validate"
)


def find_posix_shell() -> Path:
    configured = os.environ.get("LINEHUB_TEST_SHELL")
    if configured:
        return Path(configured)

    discovered = shutil.which("sh")
    if discovered:
        return Path(discovered)

    git = shutil.which("git")
    if git:
        candidate = Path(git).resolve().parents[1] / "usr" / "bin" / "sh.exe"
        if candidate.is_file():
            return candidate

    raise RuntimeError("a POSIX sh interpreter is required to test linehub-validate")


SHELL = find_posix_shell()


class LineHubRuntimeValidatorTests(unittest.TestCase):
    def run_validator(self, fixture: str, *arguments: str) -> subprocess.CompletedProcess[str]:
        environment = os.environ.copy()
        environment["PATH"] = str(SHELL.parent) + os.pathsep + environment.get(
            "PATH", ""
        )
        return subprocess.run(
            [str(SHELL), str(VALIDATOR), *arguments, str(FIXTURES / fixture)],
            cwd=REPOSITORY,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

    def json_result(self, fixture: str) -> tuple[subprocess.CompletedProcess[str], dict]:
        result = self.run_validator(fixture, "--json")
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            self.fail(
                f"linehub-validate did not emit JSON for {fixture}: "
                f"stdout={result.stdout!r}, stderr={result.stderr!r}, error={exc}"
            )
        return result, payload

    def codes_for(self, fixture: str) -> list[str]:
        result, payload = self.json_result(fixture)
        self.assertEqual(1, result.returncode, fixture)
        self.assertFalse(payload["valid"], fixture)
        return [error["code"] for error in payload["errors"]]

    def assert_fixture_has_code(self, fixture: str, code: str) -> None:
        self.assertIn(code, self.codes_for(fixture), fixture)

    def test_runtime_validator_is_posix_shell_without_python(self) -> None:
        source = VALIDATOR.read_text(encoding="utf-8")
        self.assertTrue(source.startswith("#!/bin/sh\n"))
        self.assertIn("awk", source)
        self.assertNotRegex(
            source.lower(), r"\b(bash|python[0-9.]*|jq|node(js)?|cat|echo)\b"
        )

    def test_canonical_fixture_is_valid(self) -> None:
        result, payload = self.json_result("linehub-example.uci")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(payload["valid"])
        self.assertEqual([], payload["errors"])

    def test_vlan_range_rejects_values_below_and_above_bounds(self) -> None:
        codes = self.codes_for("invalid-vlan-id.uci")
        self.assertEqual(2, codes.count("vlan.vid.range"))

    def test_missing_wan_id(self) -> None:
        self.assert_fixture_has_code(
            "missing-wan-id.uci", "pppoe.wan_id.required"
        )

    def test_missing_device_ifname(self) -> None:
        self.assert_fixture_has_code(
            "missing-device-ifname.uci", "device.ifname.required"
        )

    def test_missing_vlan_ifname(self) -> None:
        self.assert_fixture_has_code(
            "missing-vlan-ifname.uci", "vlan.ifname.required"
        )

    def test_missing_pppoe_username(self) -> None:
        self.assert_fixture_has_code(
            "missing-pppoe-username.uci", "pppoe.username.required"
        )

    def test_empty_pool(self) -> None:
        self.assert_fixture_has_code("empty-pool.uci", "pool.members.required")

    def test_duplicate_wan_id(self) -> None:
        self.assert_fixture_has_code(
            "duplicate-wan-id.uci", "pppoe.wan_id.duplicate"
        )

    def test_duplicate_mac_is_case_insensitive(self) -> None:
        self.assert_fixture_has_code(
            "duplicate-mac.uci", "pppoe.macaddr.duplicate"
        )

    def test_duplicate_vlan_subinterface(self) -> None:
        self.assert_fixture_has_code(
            "duplicate-vlan-ifname.uci", "vlan.ifname.duplicate"
        )

    def test_invalid_mac(self) -> None:
        self.assert_fixture_has_code(
            "invalid-mac.uci", "pppoe.macaddr.invalid"
        )

    def test_invalid_weight(self) -> None:
        codes = self.codes_for("invalid-weight.uci")
        self.assertEqual(3, codes.count("pppoe.weight.invalid"))

    def test_invalid_ipv4_switch(self) -> None:
        self.assert_fixture_has_code(
            "invalid-ipv4-switch.uci", "pppoe.ipv4.invalid"
        )

    def test_invalid_ipv6_switch(self) -> None:
        self.assert_fixture_has_code(
            "invalid-ipv6-switch.uci", "pppoe.ipv6.invalid"
        )

    def test_invalid_ipv4_cidr(self) -> None:
        self.assert_fixture_has_code(
            "invalid-ipv4-cidr.uci", "lan.ipv4_cidr.invalid"
        )

    def test_legacy_ipv4_fields_are_rejected(self) -> None:
        self.assert_fixture_has_code(
            "legacy-ipv4-fields.uci", "lan.ipv4_legacy.unsupported"
        )

    def test_reference_integrity(self) -> None:
        expected = {
            "reference.vlan.device",
            "reference.pppoe.vlan",
            "reference.pppoe.healthcheck",
            "reference.pool.member",
            "reference.policy.pool",
        }
        self.assertTrue(expected.issubset(set(self.codes_for("broken-references.uci"))))

    def test_rfc4193_ula_rejects_required_invalid_examples(self) -> None:
        fixtures = (
            "invalid-ula-fd-short.uci",
            "invalid-ula-overcompressed.uci",
            "invalid-ula-hex.uci",
            "invalid-ula-global.uci",
        )
        for fixture in fixtures:
            with self.subTest(fixture=fixture):
                self.assert_fixture_has_code(fixture, "lan.ula_prefix.invalid")

    def test_password_redaction_uses_runtime_validator(self) -> None:
        redacted = self.run_validator("password-redaction.uci", "--redacted")
        redacted_output = redacted.stdout + redacted.stderr
        self.assertEqual(1, redacted.returncode)
        self.assertNotIn("fixture-password-must-not-appear", redacted_output)
        self.assertIn("********", redacted.stdout)

        json_result, payload = self.json_result("password-redaction.uci")
        json_output = json_result.stdout + json_result.stderr
        self.assertEqual(1, json_result.returncode)
        self.assertFalse(payload["valid"])
        self.assertNotIn("fixture-password-must-not-appear", json_output)


if __name__ == "__main__":
    unittest.main()

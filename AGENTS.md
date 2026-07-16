# LineHub OS Agent Guide

## Scope and safety

LineHub OS is an OpenWrt x86_64 soft-router project. This repository is currently a planning and skeleton repository: do **not** build firmware or execute host/network actions that configure PPPoE, interfaces, nftables, routing, or firewalls.

- Keep examples fictional: use documentation-only accounts, passwords, MAC addresses, hostnames, and IP prefixes reserved for examples.
- Never add secrets, private keys, certificates, build caches, downloaded SDKs, or generated firmware images.
- Keep runtime changes declarative and UCI/ubus-oriented; the daemon owns reconciliation rather than UI code invoking network commands directly.
- Preserve IPv4 and IPv6 as separate address-family states. Do not claim multiple delegated IPv6 prefixes are merged into one public prefix.
- Model flow affinity explicitly: an established TCP or UDP flow must remain on its selected WAN.
- Ordinary multi-WAN balances flows, not the bandwidth of one TCP connection.

## Repository conventions

- Documentation is written in Chinese; technical identifiers and UCI keys stay in English.
- Put an OpenWrt package's metadata in `packages/<package>/Makefile`; package payload templates belong under `files/`.
- Scripts must default to dry-run or validation-only behavior unless a future, explicitly reviewed runtime feature requires otherwise.
- Add tests with fixtures that use only RFC 5737 IPv4, RFC 3849 IPv6 documentation ranges, RFC 4193 ULA addresses, and locally administered example MAC addresses.

## Verification

Before committing documentation/skeleton changes, run the repository validation script and inspect `git diff --check`. Do not run firmware builds for this planning milestone.

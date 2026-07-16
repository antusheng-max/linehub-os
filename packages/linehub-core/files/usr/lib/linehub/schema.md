# LineHub UCI schema boundary

The canonical v1 example is `/etc/config/linehub`. Runtime implementations must validate section references and redact `pppoe.password` in every read/status response. IPv4 and IPv6 state are separate per `wan_id`.

LAN IPv4 configuration uses only `ipv4_cidr`, for example `192.0.2.1/24`. The legacy `ipv4_address` and `ipv4_netmask` keys are invalid. VLAN IDs are restricted to 1 through 4094, PPPoE weights to 1 through 100, and address-family switches to `0` or `1`. ULA prefixes must be syntactically valid IPv6 prefixes inside `fc00::/7`.

`/usr/sbin/linehub-validate` is the single runtime validation implementation. It uses POSIX Shell and AWK, does not depend on Python, never applies network state, and provides human-readable, JSON, and password-redacted output modes.

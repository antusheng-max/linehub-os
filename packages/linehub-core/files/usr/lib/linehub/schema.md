# LineHub UCI schema boundary

The canonical v1 example is `/etc/config/linehub`. LAN uses `option ipv4_cidr '192.0.2.1/24'`. `ula_prefix` must be a syntactically valid RFC 4193 `fc`/`fd` prefix. Runtime implementations must validate section references and redact `pppoe.password` in every read/status response. IPv4 and IPv6 state are separate per `wan_id`.

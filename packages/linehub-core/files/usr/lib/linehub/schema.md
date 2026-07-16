# LineHub UCI schema boundary

The canonical v1 example is `/etc/config/linehub`. Runtime implementations must validate section references and redact `pppoe.password` in every read/status response. IPv4 and IPv6 state are separate per `wan_id`.

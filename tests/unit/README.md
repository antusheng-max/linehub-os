# Unit tests

The Python file is only a test driver. Every fixture is passed directly to the installed runtime implementation at `packages/linehub-core/files/usr/sbin/linehub-validate`; Python contains no UCI validation rules. The suite covers required fields, VLAN/MAC/weight/address-family bounds, IPv4 CIDR and RFC 4193 ULA syntax, reference integrity, duplicate identifiers, empty pools, and password redaction using fictional fixtures only.

Run it with:

```sh
python3 -m unittest discover -s tests/unit -p 'test_*.py' -v
```

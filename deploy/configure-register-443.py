#!/usr/bin/env python3
import getpass
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import ssl
import subprocess
import tempfile


def main():
    if os.geteuid() != 0 or not os.isatty(0):
        raise SystemExit("Run interactively with sudo on the VPS.")
    operators = Path(__file__).resolve().parent.parent / "secrets" / "operators"
    if not operators.is_dir():
        raise SystemExit("The portal operator directory is missing.")

    expected = input("SHA-256 fingerprint verified by the HikCentral server admin: ")
    expected = expected.replace(":", "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise SystemExit("Enter the complete SHA-256 fingerprint.")
    response = subprocess.run(
        ["openssl", "s_client", "-connect", "41.169.72.97:443", "-showcerts"],
        stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=10,
    )
    leaf = re.search(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", response.stdout, re.S)
    if not leaf:
        raise SystemExit("The HikCentral listener did not return a certificate.")
    certificate = leaf.group(0) + "\n"
    observed = hashlib.sha256(ssl.PEM_cert_to_DER_cert(certificate)).hexdigest()
    if not hmac.compare_digest(expected, observed):
        raise SystemExit("The certificate from port 443 did not match the independently verified fingerprint.")

    print("Certificate fingerprint matched. Use the dedicated read-only partner.")
    key = getpass.getpass("Integration Partner Key / AppKey: ").strip()
    secret = getpass.getpass("Integration Partner Secret / AppSecret: ").strip()
    group = input("HikCentral vehicle group ID: ").strip()
    if not all(0 < len(value) <= limit for value, limit in [(key, 256), (secret, 512), (group, 64)]):
        raise SystemExit("Enter the partner key, secret and vehicle group ID.")

    config = {
        "origin": "https://41.169.72.97",
        "key": key,
        "secret": secret,
        "group": group,
        "certificate": certificate,
        "fingerprint": expected,
    }
    with tempfile.NamedTemporaryFile("w", dir=operators, delete=False, encoding="utf-8") as output:
        temporary = Path(output.name)
        try:
            json.dump(config, output)
            output.flush()
            os.fsync(output.fileno())
            os.fchown(output.fileno(), 1000, 1000)
            os.fchmod(output.fileno(), 0o600)
            temporary.replace(operators / "hikcentral-register.json")
        finally:
            temporary.unlink(missing_ok=True)
    print("Read-only register credentials saved in the portal's private configuration.")


if __name__ == "__main__":
    main()

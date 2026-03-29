"""
IP Enforcer
-----------
Abstraction layer for firewall enforcement.
Supports: ufw, iptables, noop (testing)

Set FIREWALL_BACKEND in .env to choose backend.
"""

import subprocess
import logging
import os
from typing import Literal

log = logging.getLogger("sentinal.ip_enforcer")

FirewallBackend = Literal["ufw", "iptables", "noop"]


class IPEnforcer:
    def __init__(self, backend: FirewallBackend = "noop"):
        self.backend = backend
        log.info(f"[ENFORCER] Initialized with backend: {backend}")

    def ban(self, ip: str) -> bool:
        """Block all traffic from an IP address."""
        log.warning(f"[ENFORCER] Banning IP: {ip} via {self.backend}")
        try:
            if self.backend == "ufw":
                return self._ufw_deny(ip)
            elif self.backend == "iptables":
                return self._iptables_drop(ip)
            elif self.backend == "noop":
                log.info(f"[ENFORCER] NOOP: would ban {ip}")
                return True
            else:
                log.error(f"[ENFORCER] Unknown backend: {self.backend}")
                return False
        except Exception as e:
            log.error(f"[ENFORCER] Ban failed for {ip}: {e}")
            return False

    def unban(self, ip: str) -> bool:
        """Remove IP ban."""
        log.info(f"[ENFORCER] Unbanning IP: {ip} via {self.backend}")
        try:
            if self.backend == "ufw":
                return self._ufw_allow(ip)
            elif self.backend == "iptables":
                return self._iptables_accept(ip)
            elif self.backend == "noop":
                log.info(f"[ENFORCER] NOOP: would unban {ip}")
                return True
            return False
        except Exception as e:
            log.error(f"[ENFORCER] Unban failed for {ip}: {e}")
            return False

    def _ufw_deny(self, ip: str) -> bool:
        result = subprocess.run(
            ["ufw", "deny", "from", ip, "to", "any"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            log.info(f"[UFW] Denied: {ip}")
            return True
        log.error(f"[UFW] Failed to deny {ip}: {result.stderr}")
        return False

    def _ufw_allow(self, ip: str) -> bool:
        result = subprocess.run(
            ["ufw", "delete", "deny", "from", ip, "to", "any"],
            capture_output=True, text=True
        )
        return result.returncode == 0

    def _iptables_drop(self, ip: str) -> bool:
        result = subprocess.run(
            ["iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            log.info(f"[IPTABLES] Dropped: {ip}")
            return True
        log.error(f"[IPTABLES] Failed: {result.stderr}")
        return False

    def _iptables_accept(self, ip: str) -> bool:
        result = subprocess.run(
            ["iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"],
            capture_output=True, text=True
        )
        return result.returncode == 0


def get_enforcer() -> IPEnforcer:
    """Factory — reads FIREWALL_BACKEND from environment."""
    backend = os.getenv("FIREWALL_BACKEND", "noop")
    return IPEnforcer(backend=backend)

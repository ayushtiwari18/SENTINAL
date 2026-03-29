"""
IP Enforcer — SENTINAL Firewall Action Layer

Abstracts IP ban/unban/throttle operations.
Supports multiple backends: ufw, iptables, noop (testing).

Set FIREWALL_BACKEND in .env:
  ufw       — Ubuntu ufw (recommended for most deployments)
  iptables  — Direct iptables rules
  noop      — Logs only, no real firewall changes (for testing)
"""

import os
import subprocess
import logging
from typing import Literal

logger = logging.getLogger("sentinal.ip_enforcer")

FIREWALL_BACKEND = os.getenv("FIREWALL_BACKEND", "noop")

FirewallBackend = Literal["ufw", "iptables", "noop"]


class IPEnforcer:
    """
    Executes firewall actions for approved SENTINAL responses.

    This class is the ONLY place in SENTINAL that touches the firewall.
    All calls must come through executor.py after ArmorClaw verification.
    """

    def __init__(self, backend: str = FIREWALL_BACKEND):
        self.backend = backend
        logger.info(f"[IP_ENFORCER] Initialized with backend: {self.backend}")

    def ban(self, ip: str) -> dict:
        """
        Block all traffic from the given IP address.
        Returns a result dict with success status and message.
        """
        logger.info(f"[IP_ENFORCER] BAN requested for {ip} (backend: {self.backend})")

        if self.backend == "ufw":
            return self._ufw_deny(ip)
        elif self.backend == "iptables":
            return self._iptables_drop(ip)
        elif self.backend == "noop":
            return self._noop("BAN", ip)
        else:
            return {"success": False, "message": f"Unknown backend: {self.backend}"}

    def unban(self, ip: str) -> dict:
        """
        Remove a ban on the given IP address (rollback).
        """
        logger.info(f"[IP_ENFORCER] UNBAN requested for {ip} (backend: {self.backend})")

        if self.backend == "ufw":
            return self._ufw_delete_deny(ip)
        elif self.backend == "iptables":
            return self._iptables_delete_drop(ip)
        elif self.backend == "noop":
            return self._noop("UNBAN", ip)
        else:
            return {"success": False, "message": f"Unknown backend: {self.backend}"}

    def _ufw_deny(self, ip: str) -> dict:
        try:
            result = subprocess.run(
                ["ufw", "deny", "from", ip, "to", "any"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                logger.info(f"[IP_ENFORCER] ufw: banned {ip}")
                return {"success": True, "message": f"ufw: denied all traffic from {ip}"}
            else:
                logger.error(f"[IP_ENFORCER] ufw error: {result.stderr}")
                return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            logger.error(f"[IP_ENFORCER] ufw exception: {e}")
            return {"success": False, "message": str(e)}

    def _ufw_delete_deny(self, ip: str) -> dict:
        try:
            result = subprocess.run(
                ["ufw", "delete", "deny", "from", ip, "to", "any"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                return {"success": True, "message": f"ufw: removed ban on {ip}"}
            else:
                return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def _iptables_drop(self, ip: str) -> dict:
        try:
            result = subprocess.run(
                ["iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                logger.info(f"[IP_ENFORCER] iptables: dropped {ip}")
                return {"success": True, "message": f"iptables: DROP rule added for {ip}"}
            else:
                logger.error(f"[IP_ENFORCER] iptables error: {result.stderr}")
                return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def _iptables_delete_drop(self, ip: str) -> dict:
        try:
            result = subprocess.run(
                ["iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                return {"success": True, "message": f"iptables: DROP rule removed for {ip}"}
            else:
                return {"success": False, "message": result.stderr.strip()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def _noop(self, action: str, ip: str) -> dict:
        message = f"[NOOP] Would have executed {action} for {ip} — no real firewall change (FIREWALL_BACKEND=noop)"
        logger.info(f"[IP_ENFORCER] {message}")
        return {"success": True, "message": message}


# Singleton instance
ip_enforcer = IPEnforcer()

"""
IP Enforcer — Firewall Action Execution

Responsibilities:
- Execute IP ban/unban commands against the system firewall
- Support multiple backends: ufw, iptables, noop (testing)
- Abstract firewall details so the rest of SENTINAL doesn't care

Configuration:
  FIREWALL_BACKEND=noop      # default — safe for development
  FIREWALL_BACKEND=ufw       # Ubuntu/Debian systems
  FIREWALL_BACKEND=iptables  # manual iptables management

IMPORTANT: Requires root/sudo for ufw and iptables backends.
"""

import os
import subprocess
import logging
from enum import Enum
from typing import Tuple

logger = logging.getLogger("sentinal.ip_enforcer")

FIREWALL_BACKEND = os.getenv("FIREWALL_BACKEND", "noop").lower()


class FirewallBackend(str, Enum):
    NOOP = "noop"
    UFW = "ufw"
    IPTABLES = "iptables"


class IPEnforcer:
    """
    Executes real firewall commands to ban or unban IP addresses.
    
    To add a cloud firewall backend (AWS Security Groups, Cloudflare, etc.),
    add a new method here and register it in ban_ip/unban_ip.
    """

    def __init__(self, backend: str = FIREWALL_BACKEND):
        self.backend = backend
        logger.info(f"[ENFORCER] Initialized with backend: {backend}")

    def ban_ip(self, ip: str) -> Tuple[bool, str]:
        """
        Ban an IP address. Returns (success, message).
        """
        logger.info(f"[ENFORCER] Banning IP: {ip} via {self.backend}")

        if self.backend == FirewallBackend.NOOP:
            msg = f"[NOOP] Would ban {ip} — no action taken (set FIREWALL_BACKEND=ufw to enable)"
            logger.info(msg)
            return True, msg

        elif self.backend == FirewallBackend.UFW:
            return self._run_command(["sudo", "ufw", "deny", "from", ip, "to", "any"])

        elif self.backend == FirewallBackend.IPTABLES:
            return self._run_command([
                "sudo", "iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"
            ])

        else:
            msg = f"Unknown firewall backend: {self.backend}"
            logger.error(msg)
            return False, msg

    def unban_ip(self, ip: str) -> Tuple[bool, str]:
        """
        Unban an IP address. Returns (success, message).
        """
        logger.info(f"[ENFORCER] Unbanning IP: {ip} via {self.backend}")

        if self.backend == FirewallBackend.NOOP:
            msg = f"[NOOP] Would unban {ip} — no action taken"
            logger.info(msg)
            return True, msg

        elif self.backend == FirewallBackend.UFW:
            return self._run_command(["sudo", "ufw", "delete", "deny", "from", ip, "to", "any"])

        elif self.backend == FirewallBackend.IPTABLES:
            return self._run_command([
                "sudo", "iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"
            ])

        else:
            msg = f"Unknown firewall backend: {self.backend}"
            logger.error(msg)
            return False, msg

    def _run_command(self, cmd: list) -> Tuple[bool, str]:
        """
        Execute a shell command and return (success, output).
        """
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode == 0:
                msg = result.stdout.strip() or "Command executed successfully"
                logger.info(f"[ENFORCER] Command succeeded: {' '.join(cmd)}")
                return True, msg
            else:
                msg = result.stderr.strip() or "Command failed with no error output"
                logger.error(f"[ENFORCER] Command failed: {msg}")
                return False, msg
        except subprocess.TimeoutExpired:
            msg = "Firewall command timed out after 15 seconds"
            logger.error(f"[ENFORCER] {msg}")
            return False, msg
        except Exception as e:
            msg = f"Unexpected error executing firewall command: {e}"
            logger.error(f"[ENFORCER] {msg}")
            return False, msg


# Singleton instance
ip_enforcer = IPEnforcer()

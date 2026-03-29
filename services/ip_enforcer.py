"""
ip_enforcer.py
Executes real IP enforcement actions via iptables/ufw.

Abstraction layer — SENTINAL calls this, never calls iptables directly.
Firewall backend is controlled by FIREWALL_BACKEND env var:
  - ufw      : Uses ufw (Ubuntu Uncomplicated Firewall)
  - iptables : Uses iptables directly
  - noop     : Dry-run mode — logs but does not execute (safe for testing)
"""

import os
import subprocess
import logging
from typing import Optional

logger = logging.getLogger("sentinal.ip_enforcer")

BACKEND = os.getenv("FIREWALL_BACKEND", "noop").lower()


def ban_ip(ip: str, reason: str = "") -> dict:
    """
    Block all traffic from the given IP address.
    Returns dict with success bool and message string.
    """
    logger.info(f"[ENFORCER] BAN request: {ip} | reason: {reason} | backend: {BACKEND}")

    if BACKEND == "noop":
        logger.info(f"[ENFORCER][NOOP] Would ban {ip}")
        return {"success": True, "message": f"NOOP: would ban {ip}", "backend": "noop"}

    elif BACKEND == "ufw":
        return _ufw_deny(ip)

    elif BACKEND == "iptables":
        return _iptables_drop(ip)

    else:
        logger.error(f"[ENFORCER] Unknown backend: {BACKEND}")
        return {"success": False, "message": f"Unknown firewall backend: {BACKEND}"}


def unban_ip(ip: str) -> dict:
    """
    Remove block on the given IP address.
    Returns dict with success bool and message string.
    """
    logger.info(f"[ENFORCER] UNBAN request: {ip} | backend: {BACKEND}")

    if BACKEND == "noop":
        logger.info(f"[ENFORCER][NOOP] Would unban {ip}")
        return {"success": True, "message": f"NOOP: would unban {ip}", "backend": "noop"}

    elif BACKEND == "ufw":
        return _ufw_allow(ip)

    elif BACKEND == "iptables":
        return _iptables_remove_drop(ip)

    else:
        return {"success": False, "message": f"Unknown firewall backend: {BACKEND}"}


def is_banned(ip: str) -> bool:
    """Check if an IP is currently blocked."""
    if BACKEND == "noop":
        return False
    elif BACKEND == "ufw":
        result = _run(["ufw", "status", "verbose"])
        return ip in result.get("stdout", "")
    elif BACKEND == "iptables":
        result = _run(["iptables", "-L", "INPUT", "-n"])
        return ip in result.get("stdout", "")
    return False


# ─── Private helpers ───────────────────────────────────────────────────────────

def _ufw_deny(ip: str) -> dict:
    result = _run(["ufw", "deny", "from", ip, "to", "any"])
    if result["returncode"] == 0:
        logger.info(f"[ENFORCER][UFW] Banned {ip}")
        return {"success": True, "message": f"UFW: banned {ip}"}
    else:
        logger.error(f"[ENFORCER][UFW] Failed to ban {ip}: {result['stderr']}")
        return {"success": False, "message": result["stderr"]}


def _ufw_allow(ip: str) -> dict:
    result = _run(["ufw", "delete", "deny", "from", ip, "to", "any"])
    if result["returncode"] == 0:
        logger.info(f"[ENFORCER][UFW] Unbanned {ip}")
        return {"success": True, "message": f"UFW: unbanned {ip}"}
    else:
        logger.error(f"[ENFORCER][UFW] Failed to unban {ip}: {result['stderr']}")
        return {"success": False, "message": result["stderr"]}


def _iptables_drop(ip: str) -> dict:
    result = _run(["iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"])
    if result["returncode"] == 0:
        logger.info(f"[ENFORCER][IPTABLES] Banned {ip}")
        return {"success": True, "message": f"iptables: banned {ip}"}
    else:
        logger.error(f"[ENFORCER][IPTABLES] Failed to ban {ip}: {result['stderr']}")
        return {"success": False, "message": result["stderr"]}


def _iptables_remove_drop(ip: str) -> dict:
    result = _run(["iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"])
    if result["returncode"] == 0:
        logger.info(f"[ENFORCER][IPTABLES] Unbanned {ip}")
        return {"success": True, "message": f"iptables: unbanned {ip}"}
    else:
        logger.error(f"[ENFORCER][IPTABLES] Failed to unban {ip}: {result['stderr']}")
        return {"success": False, "message": result["stderr"]}


def _run(cmd: list) -> dict:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return {
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"returncode": -1, "stdout": "", "stderr": "Command timed out"}
    except FileNotFoundError:
        return {"returncode": -1, "stdout": "", "stderr": f"Command not found: {cmd[0]}"}
    except Exception as e:
        return {"returncode": -1, "stdout": "", "stderr": str(e)}

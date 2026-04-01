"""
SENTINAL Geo-IP & Threat Intelligence Module
=============================================
Lookup pipeline for every attacker IP:
  1. ip-api.com  — free, no key needed  (primary)
  2. AbuseIPDB   — reputation score + report count (requires ABUSEIPDB_API_KEY in .env)
  3. In-memory LRU cache (TTL 1 hour) to avoid hammering external APIs

Returns a GeoIntelResult object merged into the /analyze response.
"""

from __future__ import annotations
import os
import time
import logging
import threading
from typing import Optional, Dict, Any

import httpx

logger = logging.getLogger("detection-engine.geo")

# ── Cache ────────────────────────────────────────────────────────────────────
_CACHE_TTL = 3600          # seconds  (1 hour)
_CACHE_MAX  = 5000         # entries
_cache: Dict[str, tuple]  = {}   # ip -> (timestamp, result)
_cache_lock = threading.Lock()


def _cache_get(ip: str) -> Optional[Dict]:
    with _cache_lock:
        entry = _cache.get(ip)
        if entry and (time.time() - entry[0]) < _CACHE_TTL:
            return entry[1]
        if entry:
            del _cache[ip]
    return None


def _cache_set(ip: str, data: Dict) -> None:
    with _cache_lock:
        if len(_cache) >= _CACHE_MAX:
            oldest = min(_cache.items(), key=lambda x: x[1][0])
            del _cache[oldest[0]]
        _cache[ip] = (time.time(), data)


# ── ip-api.com lookup (free, no key) ─────────────────────────────────────────
def _lookup_ipapi(ip: str) -> Dict[str, Any]:
    """Returns geo fields from ip-api.com batch-compatible JSON endpoint."""
    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,org,as,proxy,hosting"
        resp = httpx.get(url, timeout=4.0)
        data = resp.json()
        if data.get("status") == "success":
            return {
                "country":      data.get("country",      "Unknown"),
                "country_code": data.get("countryCode",  "XX"),
                "region":       data.get("regionName",   ""),
                "city":         data.get("city",          ""),
                "latitude":     data.get("lat",           0.0),
                "longitude":    data.get("lon",           0.0),
                "isp":          data.get("isp",           ""),
                "org":          data.get("org",           ""),
                "asn":          data.get("as",            ""),
                "is_proxy":     data.get("proxy",        False),
                "is_hosting":   data.get("hosting",      False),
            }
    except Exception as exc:
        logger.debug(f"[GEO] ip-api.com failed for {ip}: {exc}")
    return {}


# ── AbuseIPDB lookup (requires API key) ──────────────────────────────────────
def _lookup_abuseipdb(ip: str) -> Dict[str, Any]:
    """Returns abuse confidence score + total reports from AbuseIPDB."""
    api_key = os.getenv("ABUSEIPDB_API_KEY", "")
    if not api_key:
        return {}
    try:
        resp = httpx.get(
            "https://api.abuseipdb.com/api/v2/check",
            headers={"Key": api_key, "Accept": "application/json"},
            params={"ipAddress": ip, "maxAgeInDays": "90"},
            timeout=5.0,
        )
        d = resp.json().get("data", {})
        return {
            "abuse_confidence_score": d.get("abuseConfidenceScore", 0),
            "total_reports":          d.get("totalReports",          0),
            "last_reported_at":       d.get("lastReportedAt",        None),
            "is_tor":                 d.get("isTor",                 False),
            "is_whitelisted":         d.get("isWhitelisted",         False),
        }
    except Exception as exc:
        logger.debug(f"[GEO] AbuseIPDB failed for {ip}: {exc}")
    return {}


# ── Private / reserved IP guard ──────────────────────────────────────────────
_PRIVATE_PREFIXES = (
    "127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
    "172.19.", "172.2", "172.3",
    "::1", "fc", "fd", "fe80", "0.",
)

def _is_private(ip: str) -> bool:
    return ip == "unknown" or any(ip.startswith(p) for p in _PRIVATE_PREFIXES)


# ── Public entrypoint ─────────────────────────────────────────────────────────
def enrich_ip(ip: str) -> Dict[str, Any]:
    """
    Enrich an IP address with geo + abuse reputation data.
    Returns a dict that is safe to embed in the /analyze response and
    stored in the AttackEvent MongoDB document.
    """
    if not ip or _is_private(ip):
        return _private_placeholder(ip)

    cached = _cache_get(ip)
    if cached:
        return cached

    geo   = _lookup_ipapi(ip)
    abuse = _lookup_abuseipdb(ip)

    result: Dict[str, Any] = {
        "ip":                     ip,
        "country":                geo.get("country",              "Unknown"),
        "country_code":           geo.get("country_code",          "XX"),
        "region":                 geo.get("region",                ""),
        "city":                   geo.get("city",                  ""),
        "latitude":               geo.get("latitude",               0.0),
        "longitude":              geo.get("longitude",              0.0),
        "isp":                    geo.get("isp",                   ""),
        "org":                    geo.get("org",                   ""),
        "asn":                    geo.get("asn",                   ""),
        "is_proxy":               geo.get("is_proxy",              False),
        "is_hosting":             geo.get("is_hosting",            False),
        "abuse_confidence_score": abuse.get("abuse_confidence_score", 0),
        "total_reports":          abuse.get("total_reports",          0),
        "last_reported_at":       abuse.get("last_reported_at",       None),
        "is_tor":                 abuse.get("is_tor",                False),
        "is_whitelisted":         abuse.get("is_whitelisted",        False),
    }

    _cache_set(ip, result)
    logger.info(
        f"[GEO] {ip} → {result['country_code']} | "
        f"abuse={result['abuse_confidence_score']}% | "
        f"proxy={result['is_proxy']} tor={result['is_tor']}"
    )
    return result


def _private_placeholder(ip: str) -> Dict[str, Any]:
    return {
        "ip":                     ip,
        "country":                "Private/Local",
        "country_code":           "LO",
        "region":                 "",
        "city":                   "",
        "latitude":               0.0,
        "longitude":              0.0,
        "isp":                    "Local Network",
        "org":                    "",
        "asn":                    "",
        "is_proxy":               False,
        "is_hosting":             False,
        "abuse_confidence_score": 0,
        "total_reports":          0,
        "last_reported_at":       None,
        "is_tor":                 False,
        "is_whitelisted":         False,
    }

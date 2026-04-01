"""
SENTINAL Detection Engine — Explainer

Upgraded from a static hardcoded dictionary to a live Gemini Flash
LLM explainer.

Integration source: github.com/ayushtiwariii/sentinel-ml
  - GeminiExplainer class logic merged here
  - Model: models/gemini-flash-latest
  - Prompt: cybersecurity expert, returns JSON {explanation, impact, fix}
  - Fallback: original static EXPLANATIONS dict if GEMINI_API_KEY absent
    or if the Gemini API call fails for any reason.

Callers: app/main.py → explain(threat_type, rule_id, severity, ip, url)
Signature change: added optional `url` param (backward-compatible).
"""

import os
import json
import logging
from typing import Optional

logger = logging.getLogger("detection-engine")


# ── Static fallback ─────────────────────────────────────────────────────────────
# Preserved exactly from the original explainer.py.
# Used when GEMINI_API_KEY is not set or when the API call fails.
_STATIC_EXPLANATIONS = {
    "SQL Injection": {
        "what":   "An attacker is injecting malicious SQL code into your database query.",
        "impact": "Can expose, modify, or delete your entire database including user credentials.",
        "action": "Sanitize all inputs, use parameterized queries, and block this IP immediately.",
    },
    "XSS": {
        "what":   "An attacker is injecting malicious JavaScript into your application.",
        "impact": "Can steal user sessions, redirect users, or deface your application.",
        "action": "Encode all output, implement Content Security Policy headers, and block this request.",
    },
    "Path Traversal": {
        "what":   "An attacker is attempting to access files outside your web root directory.",
        "impact": "Can expose sensitive system files like /etc/passwd or configuration files.",
        "action": "Validate and sanitize all file path inputs. Never allow ../ in file paths.",
    },
    "Command Injection": {
        "what":   "An attacker is attempting to execute system commands through your application.",
        "impact": "Can give the attacker full control of your server.",
        "action": "Never pass user input to system commands. Use safe APIs instead of shell execution.",
    },
    "SSRF": {
        "what":   "An attacker is forcing your server to make requests to internal or external resources.",
        "impact": "Can expose internal services, cloud metadata endpoints, and internal network topology.",
        "action": "Validate and whitelist all URLs before making outbound requests. Block private IP ranges.",
    },
    "LFI/RFI": {
        "what":   "An attacker is attempting to include local or remote files through your application.",
        "impact": "Can expose source code, configuration files, or execute arbitrary remote code.",
        "action": "Never allow user input to control file inclusion paths. Disable allow_url_include in PHP.",
    },
    "Command Injection": {
        "what":   "An attacker is attempting to execute OS commands via your application.",
        "impact": "Can lead to full server compromise, data exfiltration, or ransomware deployment.",
        "action": "Avoid shell execution entirely. Whitelist allowed inputs. Use subprocess with argument lists.",
    },
    "XXE": {
        "what":   "An attacker is injecting malicious XML entities to read files or trigger SSRF.",
        "impact": "Can expose local files, internal HTTP endpoints, or cause denial of service.",
        "action": "Disable external entity processing in your XML parser. Use JSON where possible.",
    },
    "Webshell": {
        "what":   "A malicious script has been uploaded or accessed to gain persistent server control.",
        "impact": "Full server compromise — attacker can execute any command, exfiltrate data, or pivot.",
        "action": "Scan for and remove all webshell files immediately. Audit upload endpoints and file permissions.",
    },
}

_DEFAULT_STATIC = {
    "what":   "Suspicious activity detected that matches known attack patterns.",
    "impact": "Potential security risk to your application.",
    "action": "Review the request manually and consider blocking the source IP.",
}


# ── Static explain helper ──────────────────────────────────────────────────────
def _static_explain(threat_type: str, rule_id: str, severity: str, ip: str) -> dict:
    """Original static explanation — always available as fallback."""
    template = _STATIC_EXPLANATIONS.get(threat_type, _DEFAULT_STATIC)
    return {
        "summary":             f"{severity.upper()} severity {threat_type} detected from {ip}",
        "what_happened":       template["what"],
        "potential_impact":    template["impact"],
        "recommended_action":  template["action"],
        "rule_triggered":      rule_id,
        "source":              "static",
    }


# ── Gemini LLM explain ─────────────────────────────────────────────────────────
def _gemini_explain(url: str, threat_type: str, api_key: str) -> Optional[dict]:
    """
    Call Gemini Flash to produce a dynamic threat explanation.
    Returns a dict or None on any failure.

    Prompt and response format from sentinel-ml/app/gemini_explainer.py.
    """
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("models/gemini-flash-latest")

        prompt = f"""You are a cybersecurity expert.

Analyze the following URL attack:

URL: {url}
Attack Type: {threat_type}

Return ONLY valid JSON in this format:

{{
  "explanation": "short explanation of the attack",
  "impact": "what damage it can cause",
  "fix": "how to prevent it"
}}

Do not add any extra text outside JSON."""

        response = model.generate_content(prompt)
        text = response.text.strip()

        # Strip markdown code fences if present (same fix as sentinel-ml)
        if text.startswith("```"):
            text = text.replace("```json", "").replace("```", "").strip()

        return json.loads(text)

    except Exception as exc:
        logger.warning(f"[EXPLAINER] Gemini call failed: {exc} — falling back to static explanation")
        return None


# ── Public API ──────────────────────────────────────────────────────────────────
def explain(
    threat_type: str,
    rule_id: str,
    severity: str,
    ip: str,
    url: str = "",
) -> dict:
    """
    Generate a human-readable explanation for a detected threat.

    Strategy:
      1. If GEMINI_API_KEY is set and url is available → call Gemini Flash.
         On success, merge Gemini output into the standard schema.
      2. On any Gemini failure (network, quota, parse error) → fall back to
         static dict. Never raise an exception to the caller.

    Args:
        threat_type: e.g. 'SQL Injection', 'XSS'
        rule_id:     e.g. 'R001'
        severity:    e.g. 'high'
        ip:          source IP address
        url:         original request URL (used by Gemini for context)

    Returns:
        dict with keys:
            summary, what_happened, potential_impact,
            recommended_action, rule_triggered, source
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    # Attempt Gemini explanation if key present and URL available
    if api_key and url:
        gemini_result = _gemini_explain(url, threat_type, api_key)

        if gemini_result:
            logger.info(f"[EXPLAINER] Gemini explanation obtained for {threat_type}")
            # Merge Gemini output into the standard SENTINAL explanation schema
            return {
                "summary":            f"{severity.upper()} severity {threat_type} detected from {ip}",
                "what_happened":      gemini_result.get("explanation", ""),
                "potential_impact":   gemini_result.get("impact", ""),
                "recommended_action": gemini_result.get("fix", ""),
                "rule_triggered":     rule_id,
                "source":             "gemini",
            }

    # Static fallback
    logger.debug(f"[EXPLAINER] Using static explanation for {threat_type}")
    return _static_explain(threat_type, rule_id, severity, ip)

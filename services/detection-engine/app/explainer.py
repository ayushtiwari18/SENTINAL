EXPLANATIONS = {
    "SQL Injection": {
        "what": "An attacker is injecting malicious SQL code into your database query.",
        "impact": "Can expose, modify, or delete your entire database including user credentials.",
        "action": "Sanitize all inputs, use parameterized queries, and block this IP immediately."
    },
    "XSS": {
        "what": "An attacker is injecting malicious JavaScript into your application.",
        "impact": "Can steal user sessions, redirect users, or deface your application.",
        "action": "Encode all output, implement Content Security Policy headers, and block this request."
    },
    "Path Traversal": {
        "what": "An attacker is attempting to access files outside your web root directory.",
        "impact": "Can expose sensitive system files like /etc/passwd or configuration files.",
        "action": "Validate and sanitize all file path inputs. Never allow ../ in file paths."
    },
    "Command Injection": {
        "what": "An attacker is attempting to execute system commands through your application.",
        "impact": "Can give the attacker full control of your server.",
        "action": "Never pass user input to system commands. Use safe APIs instead of shell execution."
    }
}

DEFAULT_EXPLANATION = {
    "what": "Suspicious activity detected that matches known attack patterns.",
    "impact": "Potential security risk to your application.",
    "action": "Review the request manually and consider blocking the source IP."
}

def explain(threat_type: str, rule_id: str, severity: str, ip: str) -> dict:
    """Generate a human-readable explanation for a detected threat."""
    template = EXPLANATIONS.get(threat_type, DEFAULT_EXPLANATION)

    return {
        "summary": f"{severity.upper()} severity {threat_type} detected from {ip}",
        "what_happened": template["what"],
        "potential_impact": template["impact"],
        "recommended_action": template["action"],
        "rule_triggered": rule_id
    }

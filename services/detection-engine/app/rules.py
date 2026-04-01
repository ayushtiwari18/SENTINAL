import re

RULES = [
    {
        "id": "R001",
        "name": "SQL Injection",
        "pattern": re.compile(
            r"(union\s+select|drop\s+table|insert\s+into|select\s+\*|or\s+1=1|--\s|;--|sleep\s*\(|benchmark\s*\(|waitfor\s+delay)",
            re.IGNORECASE
        )
    },
    {
        "id": "R002",
        "name": "XSS",
        "pattern": re.compile(
            r"(<script|javascript:|onerror=|onload=|onclick=|onmouseover=|alert\s*\(|document\.cookie|iframe\s*src)",
            re.IGNORECASE
        )
    },
    {
        "id": "R003",
        "name": "Path Traversal",
        "pattern": re.compile(
            r"(\.\./|\.\.\\|%2e%2e%2f|%2e%2e/|etc/passwd|etc/shadow|win\.ini|boot\.ini)",
            re.IGNORECASE
        )
    },
    {
        "id": "R004",
        "name": "Command Injection",
        "pattern": re.compile(
            r"(;\s*ls|;\s*cat|;\s*rm|;\s*wget|;\s*curl|;\s*whoami|;\s*id|;\s*uname|\|{1,2}\s*(ls|cat|rm|wget|curl)|`.*`)",
            re.IGNORECASE
        )
    },
    {
        "id": "R005",
        "name": "SSRF",
        "pattern": re.compile(
            r"(https?://(127\.|localhost|169\.254|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1]))|file://|dict://|gopher://|ftp://internal)",
            re.IGNORECASE
        )
    },
    {
        "id": "R006",
        "name": "LFI/RFI",
        "pattern": re.compile(
            r"(include\s*\(|require\s*once\s*\(|\.\..*\.(php|asp|jsp|py)|php://input|php://filter|expect://)",
            re.IGNORECASE
        )
    },
    {
        "id": "R007",
        "name": "Brute Force",
        "pattern": re.compile(
            r"(password=.{0,3}$|pass=.{0,3}$|pwd=.{0,3}$|login.*failed|invalid\s+credentials|too\s+many\s+attempts)",
            re.IGNORECASE
        )
    },
    {
        "id": "R008",
        "name": "HTTP Parameter Pollution",
        "pattern": re.compile(
            r"([?&](\w+)=[^&]*&.*[?&]\2=)",
            re.IGNORECASE
        )
    },
    {
        "id": "R009",
        "name": "XXE",
        "pattern": re.compile(
            r"(<!ENTITY|SYSTEM\s+[\"']|PUBLIC\s+[\"']|<!DOCTYPE.*\[)",
            re.IGNORECASE
        )
    },
    {
        "id": "R010",
        "name": "Webshell",
        "pattern": re.compile(
            r"(cmd\.jsp|backdoor\.asp|phpshell\.php|c99\.php|shell\.php|\.php\?cmd=|\.asp\?exec=|passthru\s*\(|shell_exec\s*\()",
            re.IGNORECASE
        )
    },
    {
        "id": "R011",
        "name": "Typosquatting",
        "pattern": re.compile(
            r"(g00gle|paypa1|arnazon|micros0ft|faceb00k|twltter|linkedln|instagran)",
            re.IGNORECASE
        )
    }
]

def run_rules(text: str):
    """Check a string against all rules. Returns first match or None."""
    for rule in RULES:
        if rule["pattern"].search(text):
            return {
                "rule_id": rule["id"],
                "threat_type": rule["name"]
            }
    return None

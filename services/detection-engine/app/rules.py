import re

RULES = [
    {
        "id": "R001",
        "name": "SQL Injection",
        "pattern": re.compile(
            r"(union\s+select|drop\s+table|insert\s+into|select\s+\*|or\s+1=1|--\s|;--)",
            re.IGNORECASE
        )
    },
    {
        "id": "R002",
        "name": "XSS",
        "pattern": re.compile(
            r"(<script|javascript:|onerror=|onload=|alert\s*\()",
            re.IGNORECASE
        )
    },
    {
        "id": "R003",
        "name": "Path Traversal",
        "pattern": re.compile(
            r"(\.\./|\.\.\\|%2e%2e%2f|%2e%2e/)",
            re.IGNORECASE
        )
    },
    {
        "id": "R004",
        "name": "Command Injection",
        "pattern": re.compile(
            r"(;\s*ls|;\s*cat|;\s*rm|;\s*wget|;\s*curl|\|{1,2}\s*(ls|cat|rm|wget))",
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

def score_request(request_data: dict, rule_match: dict | None) -> dict:
    """
    Score a request based on rule match and request features.
    Returns confidence score between 0.0 and 1.0
    """
    if rule_match is None:
        return {
            "confidence": 0.0,
            "severity": "none",
            "scored_by": "rule_engine"
        }

    base_score = 0.7

    # Boost score based on HTTP method
    method = request_data.get("method", "").upper()
    if method in ["POST", "PUT", "DELETE", "PATCH"]:
        base_score += 0.1

    # Boost score if body is present
    body = request_data.get("body", {})
    if body and len(str(body)) > 50:
        base_score += 0.05

    # Boost score based on attack type
    threat_type = rule_match.get("threat_type", "")
    if threat_type == "SQL Injection":
        base_score += 0.1
    elif threat_type == "Command Injection":
        base_score += 0.1
    elif threat_type == "XSS":
        base_score += 0.05
    elif threat_type == "Path Traversal":
        base_score += 0.05

    # Cap at 1.0
    confidence = min(round(base_score, 2), 1.0)

    # Assign severity
    if confidence >= 0.9:
        severity = "critical"
    elif confidence >= 0.8:
        severity = "high"
    elif confidence >= 0.7:
        severity = "medium"
    else:
        severity = "low"

    return {
        "confidence": confidence,
        "severity": severity,
        "scored_by": "rule_engine"
    }

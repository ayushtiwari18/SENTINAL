import re
import math
import urllib.parse


def shannon_entropy(text: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not text:
        return 0.0
    freq = {}
    for c in text:
        freq[c] = freq.get(c, 0) + 1
    length = len(text)
    return -sum(
        (v / length) * math.log2(v / length)
        for v in freq.values()
    )


def extract_features(url: str) -> dict:
    """
    Extract 9 numerical features from a URL.
    These feed into the ML classifier.
    """
    decoded = urllib.parse.unquote(url)
    special_chars = re.findall(r"[<>\"'();{}\[\]\\|&]", decoded)
    digits = re.findall(r"\d", url)
    uppercase = re.findall(r"[A-Z]", url)
    params = re.findall(r"[?&]\w+=", url)

    url_length       = len(url)
    decoded_length   = len(decoded)
    special_ratio    = len(special_chars) / max(decoded_length, 1)
    entropy          = shannon_entropy(decoded)
    path_depth       = url.count("/")
    param_count      = len(params)
    has_encoding     = int("%" in url)
    digit_ratio      = len(digits) / max(url_length, 1)
    uppercase_ratio  = len(uppercase) / max(url_length, 1)

    return {
        "url_length":      url_length,
        "decoded_length":  decoded_length,
        "special_ratio":   round(special_ratio, 4),
        "entropy":         round(entropy, 4),
        "path_depth":      path_depth,
        "param_count":     param_count,
        "has_encoding":    has_encoding,
        "digit_ratio":     round(digit_ratio, 4),
        "uppercase_ratio": round(uppercase_ratio, 4)
    }

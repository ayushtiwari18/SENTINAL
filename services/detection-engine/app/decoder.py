import urllib.parse
import html
import unicodedata

def decode_variants(text: str) -> list[str]:
    """
    Generate decoded variants of input text.
    Returns list of all decoded versions to scan.
    """
    variants = [text]

    # Layer 1 — URL decode
    try:
        url_decoded = urllib.parse.unquote(text)
        if url_decoded != text:
            variants.append(url_decoded)
    except Exception:
        pass

    # Layer 2 — Double URL decode
    try:
        double_decoded = urllib.parse.unquote(urllib.parse.unquote(text))
        if double_decoded not in variants:
            variants.append(double_decoded)
    except Exception:
        pass

    # Layer 3 — HTML entity decode
    try:
        html_decoded = html.unescape(text)
        if html_decoded not in variants:
            variants.append(html_decoded)
    except Exception:
        pass

    # Layer 4 — Unicode normalization
    try:
        unicode_decoded = unicodedata.normalize("NFKC", text)
        if unicode_decoded not in variants:
            variants.append(unicode_decoded)
    except Exception:
        pass

    return variants


def decode_and_scan(text: str, rule_fn) -> dict:
    """
    Run rule_fn against all decoded variants of text.
    Returns match result and whether decoding was needed.
    """
    variants = decode_variants(text)

    for i, variant in enumerate(variants):
        match = rule_fn(variant)
        if match:
            return {
                "match": match,
                "adversarial_decoded": i > 0,
                "decoded_variant": variant if i > 0 else None
            }

    return {
        "match": None,
        "adversarial_decoded": False,
        "decoded_variant": None
    }

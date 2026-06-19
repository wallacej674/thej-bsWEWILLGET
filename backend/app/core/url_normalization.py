from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

TRACKING_PARAMETER_NAMES = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "msclkid",
}


def normalize_job_posting_url(value: str) -> str:
    """Create a stable comparison key without dropping unknown URL parameters."""
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Job posting URLs must use http or https.")
    if parsed.hostname is None:
        raise ValueError("Job posting URLs must include a hostname.")

    host = parsed.hostname.lower()
    if ":" in host:
        host = f"[{host}]"
    try:
        if parsed.port is not None:
            host = f"{host}:{parsed.port}"
    except ValueError as error:
        raise ValueError("Job posting URL has an invalid port.") from error

    parameters = [
        (key, parameter_value)
        for key, parameter_value in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.lower().startswith("utm_")
        and key.lower() not in TRACKING_PARAMETER_NAMES
    ]
    return urlunsplit(
        (
            parsed.scheme,
            host,
            parsed.path.rstrip("/"),
            urlencode(parameters, doseq=True),
            "",
        )
    )

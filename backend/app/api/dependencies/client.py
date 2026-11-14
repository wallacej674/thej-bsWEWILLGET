from fastapi import Request


def client_ip(request: Request) -> str:
    """The caller's IP address, for throttling and rate limits.

    Behind a proxy, run uvicorn with --proxy-headers and a trusted
    --forwarded-allow-ips so this is the visitor's address, not the proxy's.
    """
    return request.client.host if request.client else "unknown"

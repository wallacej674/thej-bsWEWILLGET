from app.core.url_normalization import normalize_job_posting_url


def test_normalize_job_posting_url_removes_fragments_and_tracking_parameters() -> None:
    normalized = normalize_job_posting_url(
        " https://EXAMPLE.com/jobs/123/?utm_source=newsletter&ref=abc#overview "
    )

    assert normalized == "https://example.com/jobs/123?ref=abc"

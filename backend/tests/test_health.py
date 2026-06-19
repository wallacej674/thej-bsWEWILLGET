def test_health_endpoints_report_process_and_database_readiness(api_client) -> None:
    process_response = api_client.get("/health")
    database_response = api_client.get("/health/db")

    assert process_response.status_code == 200
    assert process_response.json() == {"status": "ok"}
    assert database_response.status_code == 200
    assert database_response.json() == {"status": "ok"}

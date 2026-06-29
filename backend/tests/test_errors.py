"""SC-4: an induced error returns the camelCase envelope + a correlationId echoed in the header."""

from fastapi.testclient import TestClient


def test_error_envelope_is_camelcase_with_correlation_id(client: TestClient) -> None:
    response = client.get("/api/v1/_debug/boom")

    assert response.status_code == 500
    body = response.json()
    assert set(body) == {"error"}

    error = body["error"]
    assert error["code"] == "INTERNAL"
    assert error["message"]
    assert error["correlationId"]  # camelCase, present (A9)
    assert "correlation_id" not in error  # snake_case must NOT leak
    assert response.headers.get("X-Correlation-Id")  # header pinned to X-Correlation-Id (A9)

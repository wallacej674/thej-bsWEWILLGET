"""SEC-06: résumé uploads and PDF parsing are bounded."""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from app.core.body_limit import BodySizeLimitMiddleware
from app.services import resume_service
from app.services.resume_service import ResumeService
from tests.test_resume_profile import resume_pdf_bytes


def pdf_with_pages(count: int) -> bytes:
    page = PdfReader(BytesIO(resume_pdf_bytes())).pages[0]
    writer = PdfWriter()
    for _ in range(count):
        writer.add_page(page)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def upload(
    api_client, member, content: bytes, name="resume.pdf", kind="application/pdf"
):
    return api_client.post(
        "/api/v1/profile/resume",
        headers={"X-User-Id": str(member.id)},
        files={"file": (name, content, kind)},
    )


def test_bodies_over_the_api_limit_are_refused_before_reading(
    api_client, active_member
) -> None:
    response = upload(api_client, active_member, b"%PDF-" + b"0" * (8 * 1024 * 1024))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "request_too_large"


def test_streamed_bodies_are_cut_off_at_the_limit() -> None:
    async def echo(request: Request) -> PlainTextResponse:
        return PlainTextResponse(str(len(await request.body())))

    app = BodySizeLimitMiddleware(
        Starlette(routes=[Route("/", echo, methods=["POST"])]), 10
    )
    client = TestClient(app)

    # No Content-Length: the body arrives in chunks and is counted.
    response = client.post("/", content=iter([b"x" * 6, b"x" * 6]))
    assert response.status_code == 413
    assert client.post("/", content=b"x" * 8).text == "8"


def test_uploads_over_three_megabytes_are_refused(api_client, active_member) -> None:
    response = upload(
        api_client, active_member, b"%PDF-" + b"0" * (3 * 1024 * 1024 + 10)
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "resume_file_too_large"


def test_a_renamed_non_pdf_is_refused(api_client, active_member) -> None:
    response = upload(api_client, active_member, b"MZ\x90\x00 definitely not a pdf")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "resume_file_type_invalid"


def test_only_the_first_pages_are_read(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(resume_service, "MAX_RESUME_PAGES", 2)
    result = ResumeService().extract_pdf_text(pdf_with_pages(3))

    assert result.text.count("Kareem Wallace Resume") == 2
    assert "Only the first 2 pages were read." in result.parser_warnings


def test_extracted_text_is_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(resume_service, "MAX_RESUME_TEXT_CHARS", 50)
    result = ResumeService().extract_pdf_text(resume_pdf_bytes())

    assert len(result.text) == 50
    assert "Only the first 50 characters were kept." in result.parser_warnings


def test_parsing_stops_when_the_time_budget_runs_out(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(resume_service, "PARSE_BUDGET_SECONDS", -1.0)
    result = ResumeService().extract_pdf_text(pdf_with_pages(2))

    assert result.text.count("Kareem Wallace Resume") == 1
    assert any("Stopped reading after" in warning for warning in result.parser_warnings)


def test_any_parser_crash_is_a_422_not_a_500(
    api_client, active_member, monkeypatch: pytest.MonkeyPatch
) -> None:
    def explode(_stream: object) -> None:
        raise KeyError("/Root")

    monkeypatch.setattr(resume_service, "PdfReader", explode)
    response = upload(api_client, active_member, resume_pdf_bytes())

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "resume_parse_failed"

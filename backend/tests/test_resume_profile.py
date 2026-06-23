from sqlalchemy import select

from app.models.resume import UserResume


def resume_pdf_bytes() -> bytes:
    return b"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 220 >> stream
BT /F1 12 Tf 72 720 Td (Kareem Wallace Resume) Tj 0 -20 Td (Experience Python FastAPI React SQL) Tj 0 -20 Td (Education Computer Science) Tj 0 -20 Td (Skills Python TypeScript PostgreSQL APIs) Tj 0 -20 Td (Projects ApplyTogether AI Resume Tailor) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
583
%%EOF"""


def test_user_can_upload_pdf_resume_and_store_extracted_text_only(
    api_client, database_session, active_member
) -> None:
    response = api_client.post(
        "/api/v1/profile/resume",
        headers={"X-User-Id": str(active_member.id)},
        files={
            "file": (
                "resume.pdf",
                resume_pdf_bytes(),
                "application/pdf",
            )
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["original_filename"] == "resume.pdf"
    assert body["parser_status"] == "ready"
    assert body["parser_warnings"] == []
    assert "FastAPI React SQL" in body["extracted_text_preview"]
    assert body["extracted_text_length"] > 120

    resume = database_session.scalar(
        select(UserResume).where(UserResume.user_id == active_member.id)
    )
    assert resume is not None
    assert "Kareem Wallace Resume" in resume.extracted_text
    assert b"%PDF" not in resume.extracted_text.encode()


def test_user_can_replace_and_delete_their_resume(api_client, active_member) -> None:
    headers = {"X-User-Id": str(active_member.id)}
    first = api_client.post(
        "/api/v1/profile/resume",
        headers=headers,
        files={"file": ("first.pdf", resume_pdf_bytes(), "application/pdf")},
    )
    second = api_client.post(
        "/api/v1/profile/resume",
        headers=headers,
        files={"file": ("second.pdf", resume_pdf_bytes(), "application/pdf")},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["original_filename"] == "second.pdf"

    delete_response = api_client.delete("/api/v1/profile/resume", headers=headers)
    assert delete_response.status_code == 204
    assert api_client.get("/api/v1/profile/resume", headers=headers).json() is None


def test_resume_upload_rejects_non_pdf_files(api_client, active_member) -> None:
    response = api_client.post(
        "/api/v1/profile/resume",
        headers={"X-User-Id": str(active_member.id)},
        files={"file": ("resume.txt", b"Experience with Python", "text/plain")},
    )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "resume_file_type_invalid"


def test_resume_upload_rejects_unreadable_pdf(api_client, active_member) -> None:
    response = api_client.post(
        "/api/v1/profile/resume",
        headers={"X-User-Id": str(active_member.id)},
        files={"file": ("resume.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] in {
        "resume_parse_failed",
        "resume_unreadable",
    }

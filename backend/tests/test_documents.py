import io

import fitz
from docx import Document

from app.services.documents import extract_text, safe_filename, validate_upload


def test_docx_and_pdf_extraction():
    doc = Document(); doc.add_paragraph("Verified Python project")
    output = io.BytesIO(); doc.save(output)
    assert "Python project" in extract_text(output.getvalue(), ".docx")[0]
    pdf = fitz.open(); page = pdf.new_page(); page.insert_text((72, 72), "Certificate evidence text")
    text, scanned = extract_text(pdf.tobytes(), ".pdf")
    assert "Certificate" in text
    assert scanned  # short text is deliberately flagged for review/OCR routing


def test_filename_and_type_validation():
    assert safe_filename("../../unsafe certificate.pdf") == "unsafe-certificate.pdf"
    assert validate_upload("record.pdf", "application/pdf", 100, 1000) == ".pdf"


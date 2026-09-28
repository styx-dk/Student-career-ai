# Document Processing

Upload validation checks the allowlisted extension, MIME compatibility, byte size and safe filename. The object is written under `<student-id>/<document-id>/vN/<safe-name>` in a private bucket; metadata and version rows are then committed.

Extraction uses PyMuPDF, python-docx, python-pptx or direct UTF-8 decoding. Short/empty PDF text is treated as likely scanned content. Image and scanned content require a multimodal provider. Legacy DOC/PPT requires an explicitly deployed LibreOffice conversion process.

AI output is saved separately from `confirmed_result`. Status moves through uploaded → processing → needs review → completed, or failed. On failure the stored object remains downloadable. Only acceptance creates a `user_confirmed` career record and evidence skill.


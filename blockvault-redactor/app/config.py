"""Configuration constants for the redactor service."""

import os

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx"}
REDACT_LABEL = "[REDACTED]"
REDACT_COLOR = (0, 0, 0)  # Black rectangles for PDF
REDACTION_CHUNK_SIZE = int(os.environ.get("REDACTION_CHUNK_SIZE", "4096"))

# Entity types detected by the pipeline
ENTITY_TYPES = [
    "PERSON",
    "ORG",
    "EMAIL",
    "PHONE",
    "ADDRESS",
    "SSN",
    "ID_NUMBER",
    "BANK_ACCOUNT",
]

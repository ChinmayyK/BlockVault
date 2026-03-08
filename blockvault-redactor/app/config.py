"""Configuration constants for the redactor service."""

import os

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx"}
REDACT_LABEL = "[REDACTED]"
REDACT_COLOR = (0, 0, 0)  # Black rectangles for PDF
REDACTION_CHUNK_SIZE = int(os.environ.get("REDACTION_CHUNK_SIZE", "4096"))

# OCR Limits
MAX_OCR_PAGES = int(os.environ.get("MAX_OCR_PAGES", "50"))
OCR_TIMEOUT_SECONDS = int(os.environ.get("OCR_TIMEOUT_SECONDS", "120"))

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
    # Indian IDs
    "AADHAAR",
    "PAN",
    "VOTER_ID",
    "GSTIN",
    "IFSC",
    # International
    "PASSPORT",
    "DRIVER_LICENSE",
    "CREDIT_CARD",
    "IBAN",
    "DATE_OF_BIRTH",
    "DATE",
    "IP_ADDRESS",
    "NATIONALITY",
    "URL",
    "FINANCIAL",
    # Sensitive categories
    "GENDER",
    "SENSITIVE_CATEGORY",
    # User-supplied
    "CUSTOM",
]

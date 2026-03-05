# BlockVault Redactor Integration Guide

The `blockvault-redactor` is a standalone Fastapi microservice designed to provide ~90% accurate text redaction for PDF and DOCX files. It isolates the heavy dependencies (spaCy, Tesseract, PyMuPDF) and provides a secure memory sandbox away from the main BlockVault backend.

## 1. Running the Microservice

The microservice runs in a Docker container without outbound internet access to ensure data privacy.

### Build the Image
```bash
cd blockvault-redactor
docker build -t blockvault-redactor .
```

### Run the Container
```bash
docker run -d \
  --name redactor \
  --network none \
  -p 8000:8000 \
  -m 2g \
  --cpus 2 \
  blockvault-redactor
```
*Note: We use `--network none` (or a dedicated internal Docker network without a gateway) because the Redactor should NEVER have outbound access.*

## 2. API Endpoints

### `POST /analyze`
Upload a document. Returns structured JSON containing detected entities and bounding boxes.
- `file`: `multipart/form-data`

### `POST /redact`
Upload a document and the approved JSON list of entities. Returns the fully redacted file.
- `file`: `multipart/form-data`
- `entities`: JSON string array of approved entities (from the `/analyze` step)
- `response_mode`: optional (`file` or `json`, default `file`)

**Response Headers (Document Fingerprinting)**:
- `X-Original-Hash`: SHA-256 hash of the uploaded document.
- `X-Redacted-Hash`: SHA-256 hash of the modified, redacted document.
- `X-Redaction-Mask` (optional): JSON redaction mask if small enough.

**JSON Response Mode (`response_mode=json`)**:
```json
{
  "filename": "doc_redacted.pdf",
  "media_type": "application/pdf",
  "original_hash": "<sha256>",
  "redacted_hash": "<sha256>",
  "redaction_mask": {
    "chunk_size": 1024,
    "num_chunks": 64,
    "mask_bits": [0,1,1,0],
    "ranges": [{"start": 1024, "end": 3072}],
    "original_length": 12345,
    "redacted_length": 12001
  },
  "redacted_b64": "<base64>"
}
```

## 3. Integrating with BlockVault Backend (`api/files.py`)

Add the following to your main Flask application when you want to use the redactor.

### Configuration
In `blockvault/config.py` (or `.env`):
```ini
REDACTOR_SERVICE_URL=http://localhost:8000
```

### Endpoint Implementation Example
```python
import httpx
from flask import Blueprint, request, current_app, Response

@bp.post("/<file_id>/analyze-redaction")
@require_auth
def analyze_redaction(file_id: str):
    # 1. Fetch encrypted blob from S3 and decrypt
    decrypted_bytes = ... # See download_file() logic
    
    # 2. Proxy to Redactor microservice
    redactor_url = current_app.config.get("REDACTOR_SERVICE_URL")
    try:
        resp = httpx.post(
            f"{redactor_url}/analyze",
            files={"file": ("doc.pdf", decrypted_bytes, "application/pdf")},
            timeout=30.0
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPError as e:
        abort(502, f"Redactor service error: {str(e)}")


@bp.post("/<file_id>/apply-redaction")
@require_auth
def apply_redaction(file_id: str):
    # 1. Fetch encrypted blob from S3 and decrypt
    decrypted_bytes = ...
    entities_json = request.form.get("entities")
    
    # 2. Proxy to Redactor microservice
    redactor_url = current_app.config.get("REDACTOR_SERVICE_URL")
    try:
        resp = httpx.post(
            f"{redactor_url}/redact",
            files={"file": ("doc.pdf", decrypted_bytes, "application/pdf")},
            data={"entities": entities_json},
            timeout=60.0 # Redaction can take longer
        )
        resp.raise_for_status()
        
        # 3. Retrieve Fingerprints
        orig_hash = resp.headers.get("X-Original-Hash")
        redacted_hash = resp.headers.get("X-Redacted-Hash")
        
        # 4. Re-encrypt the redacted bytes and upload to a new file record OR update current
        redacted_bytes = resp.content
        ...

        return {
            "status": "success", 
            "message": "Redactions applied",
            "fingerprints": {
                "original": orig_hash,
                "redacted": redacted_hash
            }
        }
    except httpx.HTTPError as e:
        abort(502, f"Redactor service error: {str(e)}")
```

## 4. Enterprise Upgrades Available in this Release

This service has been upgraded for enterprise-grade performance and recall:
- **Microsoft Presidio NLP Engine**: Uses spaCy `en_core_web_lg` inside Presidio `AnalyzerEngine` for context-aware detection, supporting standard PII, Credit Cards, IBANs, and localized data formats. Returns probabilistic confidence scores.
- **Image Redaction (PDF):** Automatically searches the PDF for the visual representation of tokens (handling cross-token text splits) and explicitly draws blackout rectangles over images using `fitz.PDF_REDACT_IMAGE_PIXELS`.
- **Multiprocessing**: Uses Python's `ProcessPoolExecutor` to OCR and extract PDF text across multiple pages concurrently, reducing processing time by up to 4x.
- **Document Fingerprinting:** Both original and redacted payloads are SHA-256 hashed and returned via headers to maintain chain-of-custody.

## 5. Security Considerations

1. **Sandboxing:** Run this service in an isolated Docker container, drop privileges using the `redactoruser` inside the Dockerfile, and enforce file size limits (`MAX_FILE_SIZE = 100MB`).
2. **Data Residency:** Do not log the detected entities—they contain PII (SSNs, Phone Numbers, Addresses).
3. **No Network Access:** Ensure the container has no outbound routing so that no extracted text can leave the environment maliciously.
4. **Metadata:** Keep `clean_pdf_metadata()` and DOCX core property stripping intact. Redaction is useless if the original text remains embedded in the metadata layers.

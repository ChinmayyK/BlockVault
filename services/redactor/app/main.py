"""Redactor FastAPI application."""
from __future__ import annotations

import io
import json
import logging
import hashlib
import base64
from typing import List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from .config import MAX_FILE_SIZE, ALLOWED_EXTENSIONS, REDACTION_CHUNK_SIZE
from .detector import Entity
from .pdf_engine import analyze_pdf, redact_pdf, clean_pdf_metadata
from .docx_engine import analyze_docx, redact_docx
from .redaction_mask import compute_redaction_mask

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BlockVault Redactor",
    description="Document redaction engine for PDF and DOCX files.",
    version="1.0.0",
)


def _validate_file(file: UploadFile) -> bytes:
    """Validate file extension and size."""
    # Check extension
    filename = file.filename or ""
    ext = filename.lower()[filename.rfind("."):] if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {ALLOWED_EXTENSIONS}")

    # Read bytes and check size
    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)} MB")
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")
    
    return file_bytes


@app.post("/analyze")
async def analyze_document(file: UploadFile = File(...)):
    """Analyze a document and return detected entities."""
    logger.info("Analyzing file: %s", file.filename)
    file_bytes = _validate_file(file)
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".pdf"):
            entities = analyze_pdf(file_bytes)
        elif filename.endswith(".docx"):
            entities = analyze_docx(file_bytes)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as e:
        logger.error("Analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Convert to dicts for JSON response
    return {"entities": [e.to_dict() for e in entities]}


@app.post("/redact")
async def redact_document(
    file: UploadFile = File(...),
    entities: str = Form(...),  # JSON string list of entity dicts
    response_mode: str = Form("file"),  # "file" or "json"
):
    """Redact a document based on provided entities and return the redacted file."""
    logger.info("Redacting file: %s", file.filename)
    file_bytes = _validate_file(file)
    filename = (file.filename or "").lower()

    # Parse entities
    try:
        entities_data = json.loads(entities)
        
        # Support both backward-compatible array OR {entities: [], manual_boxes: []}
        auto_entities = []
        manual_boxes = []
        if isinstance(entities_data, dict):
            auto_entities = entities_data.get("entities", [])
            manual_boxes = entities_data.get("manual_boxes", [])
        elif isinstance(entities_data, list):
            auto_entities = entities_data
        else:
            raise ValueError("entities must be a JSON array or dict with entities/manual_boxes")
            
        parsed_entities = []
        for e in auto_entities:
            parsed_entities.append(Entity(
                text=e["text"],
                entity_type=e["entity_type"],
                start=e.get("start", 0),
                end=e.get("end", 0),
                page=e.get("page"),
                bbox=e.get("bbox"),
                score=e.get("score", 1.0),
            ))
            
        # Map manual boxes to Entity abstraction (text="", type="manual")
        # expecting {"page": 1, "x": 10, "y": 20, "width": 50, "height": 20, ...}
        for b in manual_boxes:
            # Convert {x, y, w, h} into [x0, y0, x1, y1] for PyMuPDF bbox format
            x, y, w, h = b.get("x", 0), b.get("y", 0), b.get("width", 0), b.get("height", 0)
            bbox = [x, y, x + w, y + h]
            parsed_entities.append(Entity(
                text="",
                entity_type="manual",
                start=0,
                end=0,
                page=b.get("page"),
                bbox=bbox,
                score=1.0,
            ))
            
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid entities JSON: {str(e)}")

    # Fingerprint original
    original_hash = hashlib.sha256(file_bytes).hexdigest()

    try:
        if filename.endswith(".pdf"):
            # Redact PDF
            redacted_bytes = redact_pdf(file_bytes, parsed_entities)
            # Clean metadata
            redacted_bytes = clean_pdf_metadata(redacted_bytes)
            media_type = "application/pdf"
            out_filename = filename.replace(".pdf", "_redacted.pdf")
            
        elif filename.endswith(".docx"):
            # Redact DOCX (includes metadata cleaning internally)
            redacted_bytes = redact_docx(file_bytes, parsed_entities)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            out_filename = filename.replace(".docx", "_redacted.docx")
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
            
    except Exception as e:
        logger.error("Redaction failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Redaction failed: {str(e)}")

    # Fingerprint redacted
    redacted_hash = hashlib.sha256(redacted_bytes).hexdigest()

    mask_bits, mask_ranges, num_chunks = compute_redaction_mask(
        file_bytes,
        redacted_bytes,
        REDACTION_CHUNK_SIZE,
    )
    mask_payload = {
        "chunk_size": REDACTION_CHUNK_SIZE,
        "num_chunks": num_chunks,
        "mask_bits": mask_bits,
        "ranges": mask_ranges,
        "original_length": len(file_bytes),
        "redacted_length": len(redacted_bytes),
    }

    if response_mode.lower() == "json":
        return {
            "filename": out_filename,
            "media_type": media_type,
            "original_hash": original_hash,
            "redacted_hash": redacted_hash,
            "redaction_mask": mask_payload,
            "redacted_b64": base64.b64encode(redacted_bytes).decode("utf-8"),
        }

    headers = {
        "Content-Disposition": f'attachment; filename="{out_filename}"',
        "X-Original-Hash": original_hash,
        "X-Redacted-Hash": redacted_hash,
    }

    try:
        mask_json = json.dumps(mask_payload, separators=(",", ":"))
        if len(mask_json) <= 4096:
            headers["X-Redaction-Mask"] = mask_json
        else:
            headers["X-Redaction-Mask-Too-Large"] = "1"
    except Exception:
        headers["X-Redaction-Mask-Error"] = "1"

    return Response(
        content=redacted_bytes,
        media_type=media_type,
        headers=headers
    )


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

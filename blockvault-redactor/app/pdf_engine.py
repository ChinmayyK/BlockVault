"""PDF text extraction, entity detection with bounding boxes, and redaction.

Uses PyMuPDF (fitz) for text extraction and redaction.
Falls back to Tesseract OCR for scanned/image-only pages.
"""
from __future__ import annotations

import io
import logging
import concurrent.futures
from typing import List, Optional, Tuple, Dict, Any

import fitz  # PyMuPDF
from PIL import Image

from .detector import Entity, detect_entities
from .ocr_engine import PaddleOCREngine
from .config import MAX_OCR_PAGES

logger = logging.getLogger(__name__)

# Global OCR engine instance (lazy loaded internally)
ocr_engine = PaddleOCREngine()

def _page_requires_ocr(page: fitz.Page) -> bool:
    """Determine if a page requires OCR fallback based on extracted text length."""
    text = page.get_text("text")
    if not text or len(text.strip()) < 20:
        return True
    return False

def _ocr_page(page: fitz.Page) -> List[Tuple[str, fitz.Rect]]:
    """OCR a page using PaddleOCR and return (word, rect) pairs."""
    try:
        # Render the PDF page to an image
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        
        # Extract text using PaddleOCR
        ocr_results = ocr_engine.extract_text(img)
        
        words = []
        for res in ocr_results:
            text = res["text"]
            x0, y0, x1, y1 = res["bbox"]
            
            # Convert from pixel coords to PDF points
            scale_x = page.rect.width / pix.width
            scale_y = page.rect.height / pix.height
            
            rect = fitz.Rect(
                x0 * scale_x, y0 * scale_y,
                x1 * scale_x, y1 * scale_y,
            )
            words.append((text, rect))
            
        return words
    except Exception as e:
        logger.warning("PaddleOCR failed on page %s: %s", page.number + 1, e)
        return []


def _process_page(pdf_bytes: bytes, page_num: int) -> Dict[str, Any]:
    """Process a single page: extract text, words, and fall back to OCR."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[page_num - 1]
    
    text = page.get_text("text")
    words_raw = page.get_text("words")
    
    if _page_requires_ocr(page):
        # Scanned page — try OCR
        logger.info("Page %d -> OCR required", page_num)
        ocr_words = _ocr_page(page)
        text = "\n".join(w for w, _ in ocr_words)
        words = [{"text": w, "bbox": [r.x0, r.y0, r.x1, r.y1]} for w, r in ocr_words]
    else:
        logger.info("Page %d -> text layer detected", page_num)
        words = [
            {"text": w[4], "bbox": [w[0], w[1], w[2], w[3]]}
            for w in words_raw
        ]
        
    doc.close()
    return {
        "page": page_num,
        "text": text,
        "words": words,
    }


def extract_text_with_positions(pdf_bytes: bytes) -> List[dict]:
    """Extract text and word bounding boxes from each page concurrently."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    num_pages = len(doc)
    doc.close()
    
    # Enforce OCR page limit to prevent runaway resources on massive documents
    pages_to_process = min(num_pages, MAX_OCR_PAGES)
    if num_pages > MAX_OCR_PAGES:
        logger.warning("Document has %d pages, limiting OCR processing to first %d pages", num_pages, MAX_OCR_PAGES)
    
    pages = []
    # Use ThreadPoolExecutor instead of ProcessPoolExecutor to avoid 
    # loading multiple ML models into separate memory spaces (RAM spike).
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = {executor.submit(_process_page, pdf_bytes, p): p for p in range(1, pages_to_process + 1)}
        for future in concurrent.futures.as_completed(futures):
            try:
                pages.append(future.result())
            except Exception as e:
                logger.error("Page processing failed: %s", e)
                
    # Re-sort pages by page_num since as_completed can be out of order
    pages.sort(key=lambda x: x["page"])
    return pages


def analyze_pdf(pdf_bytes: bytes) -> List[Entity]:
    """Detect entities in a PDF with bounding box information."""
    # We use PyMuPDF's search_for underneath to handle token fragmentation
    # but first we need to find what strings to look for using the pipeline.
    pages = extract_text_with_positions(pdf_bytes)
    all_entities: List[Entity] = []

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for page_info in pages:
        page_num = page_info["page"]
        text = page_info["text"]
        words = page_info["words"]

        # Detect entities in the extracted logical text
        entities = detect_entities(text)

        # Map entities to precise bounding boxes using PyMuPDF's search_for
        # which natively handles cross-token layout merges
        page = doc[page_num - 1]
        
        for ent in entities:
            ent.page = page_num
            # 1. Try PyMuPDF native search (works for standard PDFs with text layers)
            instances = page.search_for(ent.text)
            
            if instances:
                rect = instances[0]
                ent.bbox = [round(rect.x0, 2), round(rect.y0, 2), round(rect.x1, 2), round(rect.y1, 2)]
            else:
                # 2. Fallback for OCR: Find matching words in our extracted 'words' list
                # This handles scanned documents where search_for() returns empty
                ent_words = ent.text.split()
                matched_rects = []
                
                # Simple greedy match: find the individual words and union their bounding boxes
                for w in ent_words:
                    for extracted_word in words:
                        if w in extracted_word["text"] or extracted_word["text"] in w:
                            matched_rects.append(extracted_word["bbox"])
                            break  # Move to next word in entity
                            
                if matched_rects:
                    x0 = min(r[0] for r in matched_rects)
                    y0 = min(r[1] for r in matched_rects)
                    x1 = max(r[2] for r in matched_rects)
                    y1 = max(r[3] for r in matched_rects)
                    ent.bbox = [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)]

            all_entities.append(ent)
            
    doc.close()
    return all_entities


def redact_pdf(pdf_bytes: bytes, entities: List[Entity]) -> bytes:
    """Apply black-rectangle redactions to a PDF.

    Entities must have page and bbox set.
    Also strips all PDF metadata.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for ent in entities:
        if ent.page is None or ent.bbox is None:
            continue
        page_idx = ent.page - 1  # 0-indexed
        if page_idx < 0 or page_idx >= len(doc):
            continue
        page = doc[page_idx]
        
        # We search for the exact matching string again to catch all visual fragments
        # and ensure proper redaction across the entire page layout.
        instances = page.search_for(ent.text)
        
        # If search_for doesn't find it (perhaps it's OCR generated), use the provided bbox
        if not instances:
            rect = fitz.Rect(ent.bbox)
            rect.x0 -= 1
            rect.y0 -= 1
            rect.x1 += 1
            rect.y1 += 1
            page.add_redact_annot(rect, fill=(0, 0, 0))
            # Fallback for images: explicitly draw a black shape over the coordinates
            page.draw_rect(rect, color=(0,0,0), fill=(0,0,0))
            
        for rect in instances:
            # Expand rect slightly for clean coverage
            rect.x0 -= 1
            rect.y0 -= 1
            rect.x1 += 1
            rect.y1 += 1
            page.add_redact_annot(rect, fill=(0, 0, 0))
            # Explicitly cover underneath image layout as well
            page.draw_rect(rect, color=(0,0,0), fill=(0,0,0))
            
    # Apply all redactions
    for page in doc:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)

    # Strip metadata
    doc.set_metadata({})

    out_buf = io.BytesIO()
    doc.save(out_buf, garbage=4, deflate=True)
    doc.close()
    return out_buf.getvalue()


def clean_pdf_metadata(pdf_bytes: bytes) -> bytes:
    """Remove all metadata from a PDF using pikepdf."""
    try:
        import pikepdf
        pdf = pikepdf.open(io.BytesIO(pdf_bytes))
        with pdf.open_metadata() as meta:
            for key in list(meta.keys()):
                del meta[key]
        out = io.BytesIO()
        pdf.save(out)
        pdf.close()
        return out.getvalue()
    except Exception:
        return pdf_bytes  # Return original if pikepdf fails

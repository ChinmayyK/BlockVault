"""Tests for the hybrid OCR pipeline."""
import io
import pytest
from unittest.mock import patch

from PIL import Image
import fitz

from app.pdf_engine import _page_requires_ocr, _ocr_page, analyze_pdf
from app.ocr_engine import PaddleOCREngine

# A helper to create a pure image PDF (scanned simulation)
def _create_scanned_pdf(text: str = "Confidential Report") -> bytes:
    # 1. Create a PDF with text
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text, fontsize=12)
    
    # 2. Render it to an image
    pix = page.get_pixmap(dpi=150)
    
    # 3. Create a NEW pdf placing that image, resulting in no text layer
    img_doc = fitz.open()
    img_page = img_doc.new_page(width=page.rect.width, height=page.rect.height)
    img_page.insert_image(img_page.rect, pixmap=pix)
    
    out = io.BytesIO()
    img_doc.save(out)
    img_doc.close()
    doc.close()
    return out.getvalue()


def _create_normal_pdf(text: str = "Confidential Report") -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text, fontsize=12)
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    return out.getvalue()


def test_page_requires_ocr():
    """Verify that image-only pages trigger the OCR fallback, while text pages do not."""
    # Test text PDF
    normal_bytes = _create_normal_pdf("Confidential John Smith")
    doc_normal = fitz.open(stream=normal_bytes, filetype="pdf")
    page_normal = doc_normal[0]
    
    # Should not require OCR
    assert not _page_requires_ocr(page_normal)
    doc_normal.close()

    # Test scanned PDF
    scanned_bytes = _create_scanned_pdf("Confidential John Smith")
    doc_scanned = fitz.open(stream=scanned_bytes, filetype="pdf")
    page_scanned = doc_scanned[0]
    
    # Should require OCR since get_text() will return empty
    assert _page_requires_ocr(page_scanned)
    doc_scanned.close()


@patch.object(PaddleOCREngine, 'extract_text')
def test_ocr_processing_format(mock_extract):
    """Verify OCR returns the correct PyMuPDF-compatible bounding box format."""
    # Mock the paddle OCR output for a fake image
    mock_extract.return_value = [
        {"text": "Confidential", "bbox": [50.0, 50.0, 150.0, 70.0], "confidence": 0.99}
    ]
    
    scanned_bytes = _create_scanned_pdf()
    doc_scanned = fitz.open(stream=scanned_bytes, filetype="pdf")
    page_scanned = doc_scanned[0]
    
    # Run our wrapper
    words = _ocr_page(page_scanned)
    doc_scanned.close()
    
    # Check that PaddleOCR wrapper maps back to (text, fitz.Rect) correctly
    assert len(words) == 1
    assert words[0][0] == "Confidential"
    assert isinstance(words[0][1], fitz.Rect)
    # the exact coords might scale depending on image size, just ensure it's a Rect


def test_hybrid_extraction_pipeline():
    """
    Test the full analyze_pdf pipeline works on a scanned document.
    Requires PaddleOCR to run successfully (will be skipped or run based on environment).
    """
    try:
        import paddleocr
    except ImportError:
        pytest.skip("PaddleOCR not installed")

    import sys
    import numpy as np
    
    # PaddleOCR's native C++ engine may segfault on some macOS ARM64 configs
    # We mock the internal ocr execution to prevent the crash while validating the pipeline integration
    with patch('app.ocr_engine._get_paddle_ocr') as mock_get_ocr:
        mock_ocr_instance = mock_get_ocr.return_value
        # Mock PaddleOCR v2.9 dictionary structure - word level
        mock_ocr_instance.ocr.return_value = [{
            "rec_texts": ["Name:", "Rajesh", "Sharma", "PAN:", "ABCDE1234F"],
            "rec_scores": [0.99, 0.99, 0.99, 0.99, 0.99],
            "rec_polys": [
                np.array([[50, 50], [90, 50], [90, 70], [50, 70]], dtype=np.int16),
                np.array([[100, 50], [150, 50], [150, 70], [100, 70]], dtype=np.int16),
                np.array([[160, 50], [210, 50], [210, 70], [160, 70]], dtype=np.int16),
                np.array([[50, 80], [80, 80], [80, 100], [50, 100]], dtype=np.int16),
                np.array([[90, 80], [200, 80], [200, 100], [90, 100]], dtype=np.int16)
            ]
        }]
        
        # This tests the actual PaddleOCR wrapper and downstream routing
        scanned_bytes = _create_scanned_pdf("Name: Rajesh Sharma\nPAN: ABCDE1234F")
        entities = analyze_pdf(scanned_bytes)
        
        # We should detect PAN from the OCR text
        types = {e.entity_type for e in entities}
        assert "PAN" in types
        
        pan_entity = next(e for e in entities if e.entity_type == "PAN")
        assert pan_entity.text == "ABCDE1234F"
        assert pan_entity.bbox is not None
        assert len(pan_entity.bbox) == 4
        assert pan_entity.page == 1

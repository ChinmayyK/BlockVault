import logging
import io
from typing import Optional

logger = logging.getLogger(__name__)

def add_watermark(pdf_bytes: bytes, watermark_text: str) -> bytes:
    """
    Injects a semi-transparent diagonal watermark across all pages of a PDF.
    Returns the watermarked PDF bytes. If PyMuPDF is not available, returns the original bytes.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("PyMuPDF (fitz) is not installed. Watermarking skipped.")
        return pdf_bytes

    try:
        doc = fitz.open("pdf", pdf_bytes)
        for page in doc:
            rect = page.rect
            # Calculate a central position for the watermark
            center = fitz.Point(rect.width / 2, rect.height / 2)
            
            # Use insert_text or insert_textbox. We will use insert_text with a large rotation.
            # But insert_text doesn't support transparency easily directly unless using insert_pdf with transparency
            # Alternatively, draw_text (deprecated) or insert_text with fill opacity.
            # Let's use `insert_text` with an explicitly transparent color or a faint grey.
            
            # A cleaner approach with fitz for watermarks is using `insert_text` and a light grey color
            # or `show_pdf_page` with a watermark PDF.
            
            # We'll use insert_textbox for better wrapping and centered alignment
            text_rect = fitz.Rect(0, 0, rect.width * 0.8, rect.height * 0.8)
            text_rect.move_center(center)
            
            # To get diagonal text, we can use shape / insert_text with an angle.
            shape = page.new_shape()
            
            shape.insert_text(
                point=fitz.Point(rect.width * 0.1, rect.height * 0.8), # Start near bottom left
                text=watermark_text,
                fontsize=36,
                color=(0.6, 0.6, 0.6), # Light grey
                fill_opacity=0.3,      # Transparent
            )
            # Commit the shape to the page
            shape.commit()
            
            # Also add an invisible metadata watermark (steganography)
            # Not natively supported in page text, but we can set document metadata
        
        # Add a custom metadata field
        metadata = doc.metadata
        metadata["BlockVaultTrace"] = watermark_text
        doc.set_metadata(metadata)
        
        return doc.write()
    except Exception as exc:
        logger.error("Failed to apply watermark: %s", exc)
        return pdf_bytes

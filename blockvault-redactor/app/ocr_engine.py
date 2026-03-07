"""OCR Engine using PaddleOCR for BlockVault Redactor.

Provides a robust OCR text extraction pipeline with image preprocessing
to maximize accuracy on scanned document pages.
"""
import logging
from typing import List, Dict, Any

from PIL import Image, ImageFilter, ImageEnhance
import numpy as np

logger = logging.getLogger(__name__)

# Lazy load PaddleOCR to avoid slowing down startup if OCR isn't immediately needed
_paddle_ocr = None

def _get_paddle_ocr():
    global _paddle_ocr
    if _paddle_ocr is None:
        try:
            from paddleocr import PaddleOCR
            import logging
            logging.getLogger("ppocr").setLevel(logging.WARNING) # Suppress verbose logs
            
            _paddle_ocr = PaddleOCR(
                use_textline_orientation=True, 
                lang="en"
            )
            logger.info("PaddleOCR engine initialized successfully.")
        except ImportError as e:
            logger.error("Failed to import PaddleOCR: %s", e)
            raise
    return _paddle_ocr


class PaddleOCREngine:
    """Wrapper for PaddleOCR with image preprocessing."""

    def __init__(self):
        # We don't initialize PaddleOCR in __init__ to keep instantiation fast
        pass

    def _preprocess_image(self, image: Image.Image) -> np.ndarray:
        """Preprocess PIL Image to improve OCR accuracy."""
        # 1. Convert to grayscale
        img = image.convert("L")
        
        # 2. Increase contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.5)
        
        # 3. Apply sharpening
        img = img.filter(ImageFilter.SHARPEN)
        
        # Convert to numpy array as PaddleOCR expects numpy array (or path/url)
        img_rgb = img.convert("RGB")
        img_np = np.array(img_rgb)
        
        return img_np

    def extract_text(self, image: Image.Image) -> List[Dict[str, Any]]:
        """
        Extract text from a PIL Image.
        
        Returns:
            List of dictionaries, each containing:
            - 'text': The extracted string
            - 'bbox': [x0, y0, x1, y1] coordinates
            - 'confidence': The OCR confidence score
        """
        try:
            ocr = _get_paddle_ocr()
            img_np = self._preprocess_image(image)
            
            # Run OCR
            result = ocr.ocr(img_np)
            
            words = []
            if not result:
                return words
                
            # Handle PaddleOCR newer version dict output vs older list output
            for res_item in result:
                # v2.9 dict format handling
                if isinstance(res_item, dict):
                    texts = res_item.get("rec_texts", [])
                    scores = res_item.get("rec_scores", [])
                    polys = res_item.get("rec_polys", [])
                    
                    for text, conf, poly in zip(texts, scores, polys):
                        text = text.strip()
                        if not text:
                            continue
                        
                        x0 = float(np.min(poly[:, 0]))
                        y0 = float(np.min(poly[:, 1]))
                        x1 = float(np.max(poly[:, 0]))
                        y1 = float(np.max(poly[:, 1]))
                        
                        words.append({
                            "text": text,
                            "bbox": [x0, y0, x1, y1],
                            "confidence": float(conf)
                        })
                        
                # Older format handling (list of lines)
                elif isinstance(res_item, list):
                    for line in res_item:
                        if not line or len(line) != 2:
                            continue
                        box, (text, confidence) = line
                        
                        x0 = float(min([point[0] for point in box]))
                        y0 = float(min([point[1] for point in box]))
                        x1 = float(max([point[0] for point in box]))
                        y1 = float(max([point[1] for point in box]))
                        
                        text = text.strip()
                        if not text:
                            continue
                            
                        words.append({
                            "text": text,
                            "bbox": [x0, y0, x1, y1],
                            "confidence": float(confidence)
                        })
            
            return words
            
        except Exception as e:
            logger.error("PaddleOCR extraction failed: %s", e)
            return []

"""Hybrid PII detection and PDF redaction engine.

Provides entity detection and redaction without depending on the separate
blockvault-redactor FastAPI microservice.  Uses a layered pipeline:
  1. Regex patterns for structured PII (SSN, email, phone, credit card, etc.)
  2. Microsoft Presidio with transformer NLP (en_core_web_trf preferred)
  3. Standalone spaCy NER as fallback when Presidio is unavailable
  4. Custom dictionary detection for user-supplied terms
  5. Context-aware scoring to boost confidence near sensitive keywords
  6. OCR fallback via Tesseract for scanned/image-based PDF pages
  7. PyMuPDF (fitz) for PDF text extraction, bounding-box mapping, and redaction

All heavy dependencies are imported lazily so the module loads even when
they are absent — callers get a graceful fallback.
"""
from __future__ import annotations

import io
import re
import math
import hashlib
import logging
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Default minimum confidence threshold for returned entities
DEFAULT_MIN_CONFIDENCE = 0.65

# ---------------------------------------------------------------------------
# Entity dataclass (mirrors blockvault-redactor's Entity)
# ---------------------------------------------------------------------------

@dataclass
class Entity:
    text: str
    entity_type: str
    start: int
    end: int
    page: Optional[int] = None
    bbox: Optional[List[float]] = None
    score: float = 1.0
    source: str = "unknown"

    def to_dict(self) -> dict:
        d = asdict(self)
        if d["bbox"] is None:
            del d["bbox"]
        if d["page"] is None:
            del d["page"]
        # Rename score → confidence for API consumers
        d["confidence"] = d.pop("score")
        return d


# ---------------------------------------------------------------------------
# Checksum helpers
# ---------------------------------------------------------------------------

# Verhoeff checksum tables for Aadhaar validation
_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]
_VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]


def _verhoeff_checksum(number: str) -> bool:
    """Validate Aadhaar number using the Verhoeff algorithm."""
    digits = [int(d) for d in number if d.isdigit()]
    if len(digits) != 12:
        return False
    c = 0
    for i, digit in enumerate(reversed(digits)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][digit]]
    return c == 0


def _luhn_checksum(number: str) -> bool:
    """Validate credit card number using the Luhn algorithm."""
    digits = [int(d) for d in number if d.isdigit()]
    if len(digits) < 13:
        return False
    checksum = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


# ---------------------------------------------------------------------------
# Regex-based PII detectors
# ---------------------------------------------------------------------------

# US Social Security Number (with or without dashes)
_SSN_RE = re.compile(
    r"\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b"
)

# Email
_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
)

# US/International phone numbers
_PHONE_RE = re.compile(
    r"(?<!\d)"                          # no digit before
    r"(?:\+?1[-.\s]?)?"                 # optional country code
    r"(?:\(?\d{3}\)?[-.\s]?)"           # area code
    r"\d{3}[-.\s]?\d{4}"               # subscriber number
    r"(?!\d)"                           # no digit after
)

# Indian Phone (+91 prefix, 10-digit mobile)
_INDIAN_PHONE_RE = re.compile(
    r"(?<!\d)"
    r"(?:\+91[\s\-]?|91[\s\-]?|0)?"
    r"[6-9]\d{9}"
    r"(?!\d)"
)

# Credit card (Visa, MC, Amex, Discover)
_CREDIT_CARD_RE = re.compile(
    r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))"
    r"[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,4}\b"
)

# IBAN (simplified — 2-letter country, 2-digit check, 11-30 alphanumeric)
_IBAN_RE = re.compile(
    r"\b[A-Z]{2}\d{2}\s?(?:\d{4}\s?){2,7}\d{1,4}\b"
)

# Date of Birth patterns (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-Mon-YYYY etc.)
_DOB_RE = re.compile(
    r"\b(?:"
    r"\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}"
    r"|"
    r"\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}"
    r"|"
    r"\d{1,2}[\s\-](?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s\-,]*\d{2,4}"
    r"|"
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s\-]+\d{1,2}[\s,]+\d{2,4}"
    r")\b",
    re.IGNORECASE,
)

# IPv4 addresses
_IPV4_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
)

# Indian Passport (1 uppercase letter + exactly 7 digits)
_INDIAN_PASSPORT_RE = re.compile(r"\b[A-Z]\d{7}\b")

# US Driver's license (state-dependent, simplified)
_DL_RE = re.compile(r"\b[A-Z]\d{7,14}\b")

# Aadhaar number (India, 12 digits with optional spaces/dashes)
_AADHAAR_RE = re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b")

# PAN (India, ABCDE1234F format)
_PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")

# Indian Voter ID / EPIC (3 uppercase letters + 7 digits)
_VOTER_ID_RE = re.compile(r"\b[A-Z]{3}\d{7}\b")

# GSTIN (India, 15-char: 2 digits + PAN + 1 alphanum + Z + 1 alphanum)
_GSTIN_RE = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")

# IFSC Code (India, 4 uppercase letters + 0 + 6 alphanumeric)
_IFSC_RE = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")

_PATTERN_MAP: List[Tuple[re.Pattern, str, bool]] = [
    # (pattern, entity_type, requires_validation)
    (_AADHAAR_RE, "AADHAAR", True),
    (_PAN_RE, "PAN", False),
    (_VOTER_ID_RE, "VOTER_ID", False),
    (_GSTIN_RE, "GSTIN", False),
    (_IFSC_RE, "IFSC", False),
    (_INDIAN_PASSPORT_RE, "PASSPORT", False),
    (_INDIAN_PHONE_RE, "PHONE", False),
    (_SSN_RE, "SSN", True),
    (_EMAIL_RE, "EMAIL", False),
    (_PHONE_RE, "PHONE", False),
    (_CREDIT_CARD_RE, "CREDIT_CARD", True),
    (_IBAN_RE, "IBAN", False),
    (_DOB_RE, "DATE_OF_BIRTH", False),
    (_IPV4_RE, "IP_ADDRESS", False),
]

# ---------------------------------------------------------------------------
# Context words that signal surrounding text is sensitive
# ---------------------------------------------------------------------------

_CONTEXT_WORDS = {
    # Identity
    "patient", "witness", "applicant", "attorney", "client",
    "employee", "customer", "beneficiary", "insured", "claimant",
    "defendant", "plaintiff", "respondent",
    # Documents / IDs
    "account", "ssn", "social security", "credit card", "passport",
    "license", "driver", "dob", "date of birth", "aadhaar", "pan",
    "tax id", "ein", "tin", "epic", "voter id", "gstin", "ifsc",
    # Contact
    "phone", "email", "address", "mobile", "fax", "cell",
    # Legal / Medical
    "signed", "agreement", "contract", "diagnosis", "medical",
    "prescription", "treatment", "confidential", "privileged",
    "hipaa", "phi", "pii",
    # Financial
    "bank", "routing", "swift", "iban", "salary", "compensation",
    "payment", "invoice", "billing",
    # Indian context
    "aadhar", "uid", "uidai", "pan card", "ration card",
    "domicile", "caste", "religion", "nationality",
}


def _validate_match(entity_type: str, matched_text: str) -> bool:
    """Apply domain-specific validation to reduce false positives."""
    if entity_type == "AADHAAR":
        digits = re.sub(r"\D", "", matched_text)
        if len(digits) != 12:
            return False
        if digits[0] in ("0", "1"):
            return False
        return _verhoeff_checksum(digits)
    if entity_type == "SSN":
        digits = re.sub(r"\D", "", matched_text)
        if len(digits) != 9:
            return False
        if digits.startswith("000") or digits.startswith("666"):
            return False
        return True
    if entity_type == "CREDIT_CARD":
        digits = re.sub(r"\D", "", matched_text)
        if len(digits) < 13 or len(digits) > 19:
            return False
        return _luhn_checksum(digits)
    return True


def _regex_detect(text: str) -> List[Entity]:
    """Run all regex patterns on the text and return detected entities."""
    entities: List[Entity] = []
    for pattern, entity_type, needs_validation in _PATTERN_MAP:
        for m in pattern.finditer(text):
            matched_text = m.group().strip()
            if len(matched_text) < 3:
                continue

            # Run checksum/validation if required
            if needs_validation and not _validate_match(entity_type, matched_text):
                continue

            # Confidence score per type
            score_map = {
                "AADHAAR": 0.92, "PAN": 0.90, "VOTER_ID": 0.88,
                "GSTIN": 0.90, "IFSC": 0.85, "PASSPORT": 0.75,
                "SSN": 0.90, "EMAIL": 0.95, "PHONE": 0.80,
                "CREDIT_CARD": 0.92, "IBAN": 0.88,
                "DATE_OF_BIRTH": 0.70, "IP_ADDRESS": 0.72,
            }
            score = score_map.get(entity_type, 0.75)

            entities.append(Entity(
                text=matched_text,
                entity_type=entity_type,
                start=m.start(),
                end=m.end(),
                score=round(score, 2),
                source="regex",
            ))
    return entities


# ---------------------------------------------------------------------------
# Label-based field extraction
# ---------------------------------------------------------------------------

_LABEL_PATTERNS = [
    (re.compile(
        r"(?:(?:Full\s+)?Name|Applicant|Candidate|Student|Employee|Patient"
        r"|Father(?:'s)?\s*(?:Name)?|Mother(?:'s)?\s*(?:Name)?"
        r"|Husband(?:'s)?\s*(?:Name)?|Guardian(?:'s)?\s*(?:Name)?|Spouse(?:'s)?\s*(?:Name)?)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "PERSON"),
    (re.compile(
        r"(?:Address|Residential\s+Address|Permanent\s+Address|Correspondence\s+Address"
        r"|Present\s+Address|Communication\s+Address)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n\n|\n(?=[A-Z][a-z]+\s*:)|$)",
        re.IGNORECASE | re.DOTALL,
    ), "ADDRESS"),
    (re.compile(
        r"(?:Date\s+of\s+Birth|DOB|D\.O\.B|Birth\s+Date|Birthday)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "DATE_OF_BIRTH"),
    (re.compile(
        r"(?:Aadhaar(?:\s+(?:No|Number|#))?|UID(?:\s+(?:No|Number))?)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "AADHAAR"),
    (re.compile(
        r"(?:PAN(?:\s+(?:No|Number|Card))?)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "PAN"),
    (re.compile(
        r"(?:Voter\s+ID|EPIC(?:\s+No)?|Election\s+(?:Card|ID))"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "VOTER_ID"),
    (re.compile(
        r"(?:Passport(?:\s+(?:No|Number))?)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "PASSPORT"),
    (re.compile(
        r"(?:(?:Mobile|Phone|Cell|Contact|Tel)(?:\s+(?:No|Number|#))?)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "PHONE"),
    (re.compile(
        r"(?:E[\-\s]?mail(?:\s+(?:ID|Address))?)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "EMAIL"),
    (re.compile(
        r"(?:Gender|Sex)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "GENDER"),
    (re.compile(
        r"(?:Religion|Caste|Category|Nationality)"
        r"\s*[:;\-\u2013\u2014]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "SENSITIVE_CATEGORY"),
]


def _label_detect(text: str) -> List[Entity]:
    """Extract field values from label:value patterns."""
    entities: List[Entity] = []
    for pattern, entity_type in _LABEL_PATTERNS:
        for m in pattern.finditer(text):
            value = m.group(1).strip()
            if not value or len(value) < 2:
                continue
            if re.match(r"^[A-Z][a-z]+\s*:", value):
                continue
            if len(value) > 200:
                value = value[:200].strip()
            value_start = m.start(1)
            value_end = value_start + len(value)
            entities.append(Entity(
                text=value,
                entity_type=entity_type,
                start=value_start,
                end=value_end,
                score=0.88,
                source="label",
            ))
    return entities


# ---------------------------------------------------------------------------
# Optional spaCy NER
# ---------------------------------------------------------------------------

_spacy_nlp = None
_spacy_loaded = False


def _get_spacy():
    global _spacy_nlp, _spacy_loaded
    if _spacy_loaded:
        return _spacy_nlp
    _spacy_loaded = True
    try:
        import spacy
        # Prefer transformer model for higher accuracy
        for model_name in ("en_core_web_trf", "en_core_web_lg", "en_core_web_md", "en_core_web_sm"):
            try:
                _spacy_nlp = spacy.load(model_name, disable=["parser", "lemmatizer"])
                logger.info("spaCy model loaded: %s", model_name)
                return _spacy_nlp
            except (OSError, ValueError):
                continue
        logger.info("No spaCy model available — skipping NER")
    except ImportError:
        logger.info("spaCy not installed — skipping NER")
    return None


def _spacy_detect(text: str) -> List[Entity]:
    """Run spaCy NER on the text."""
    nlp = _get_spacy()
    if nlp is None:
        return []
    entities: List[Entity] = []
    # Process in chunks to avoid spaCy max_length issue
    max_len = nlp.max_length
    for chunk_start in range(0, len(text), max_len):
        chunk = text[chunk_start: chunk_start + max_len]
        doc = nlp(chunk)
        for ent in doc.ents:
            etype = ent.label_
            if etype not in {"PERSON", "ORG", "GPE", "LOC", "FAC", "NORP", "DATE", "MONEY"}:
                continue
            # Map to our types
            mapped = etype
            if etype in ("GPE", "LOC", "FAC"):
                mapped = "LOCATION"
            elif etype == "NORP":
                mapped = "ORGANIZATION"
            elif etype == "MONEY":
                mapped = "FINANCIAL"
            entities.append(Entity(
                text=ent.text,
                entity_type=mapped,
                start=chunk_start + ent.start_char,
                end=chunk_start + ent.end_char,
                score=0.70,
                source="spacy",
            ))
    return entities


# ---------------------------------------------------------------------------
# Presidio integration (transformer-backed)
# ---------------------------------------------------------------------------

_presidio_analyzer = None
_presidio_loaded = False


def _get_presidio():
    global _presidio_analyzer, _presidio_loaded
    if _presidio_loaded:
        return _presidio_analyzer
    _presidio_loaded = True
    try:
        from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
        from presidio_analyzer.nlp_engine import NlpEngineProvider

        # Prefer transformer model for highest accuracy
        model_cascade = ("en_core_web_trf", "en_core_web_lg", "en_core_web_sm")
        nlp_engine = None
        for model in model_cascade:
            try:
                provider = NlpEngineProvider(nlp_configuration={
                    "nlp_engine_name": "spacy",
                    "models": [{"lang_code": "en", "model_name": model}],
                })
                nlp_engine = provider.create_engine()
                logger.info("Presidio NLP engine initialized with model: %s", model)
                break
            except Exception:
                nlp_engine = None
        if nlp_engine is None:
            logger.info("Presidio NLP engine unavailable — skipping Presidio")
            return None

        registry = RecognizerRegistry()
        registry.load_predefined_recognizers()
        _presidio_analyzer = AnalyzerEngine(
            registry=registry,
            nlp_engine=nlp_engine,
            supported_languages=["en"],
        )
        logger.info("Presidio Analyzer initialized for inline redaction")
    except ImportError:
        logger.info("Presidio not installed — regex-only PII detection")
    except Exception as exc:
        logger.warning("Presidio init failed: %s — falling back to regex", exc)
    return _presidio_analyzer


_PRESIDIO_ENTITIES = [
    "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "US_SSN",
    "CREDIT_CARD", "IBAN_CODE", "US_BANK_NUMBER",
    "LOCATION", "ORGANIZATION",
    "US_PASSPORT", "US_DRIVER_LICENSE", "DATE_TIME", "NRP",
]

_PRESIDIO_TYPE_MAP = {
    "EMAIL_ADDRESS": "EMAIL",
    "PHONE_NUMBER": "PHONE",
    "US_SSN": "SSN",
    "LOCATION": "LOCATION",
    "ORGANIZATION": "ORGANIZATION",
    "CREDIT_CARD": "CREDIT_CARD",
    "IBAN_CODE": "IBAN",
    "US_BANK_NUMBER": "BANK_ACCOUNT",
    "US_PASSPORT": "PASSPORT",
    "US_DRIVER_LICENSE": "DRIVER_LICENSE",
    "DATE_TIME": "DATE",
    "NRP": "NATIONALITY",
}


def _presidio_detect(text: str) -> List[Entity]:
    """Run Presidio if available."""
    analyzer = _get_presidio()
    if not analyzer:
        return []
    entities: List[Entity] = []
    try:
        results = analyzer.analyze(
            text=text,
            language="en",
            entities=_PRESIDIO_ENTITIES,
            return_decision_process=True,
        )
        for r in results:
            etype = _PRESIDIO_TYPE_MAP.get(r.entity_type, r.entity_type)
            entities.append(Entity(
                text=text[r.start:r.end],
                entity_type=etype,
                start=r.start,
                end=r.end,
                score=round(r.score, 2),
                source="presidio",
            ))
    except Exception as exc:
        logger.warning("Presidio detection failed: %s", exc)
    return entities


# ---------------------------------------------------------------------------
# Custom dictionary detection
# ---------------------------------------------------------------------------

def _dictionary_detect(text: str, custom_terms: Optional[List[str]] = None) -> List[Entity]:
    """Detect user-supplied terms via case-insensitive word-boundary matching."""
    if not custom_terms:
        return []
    entities: List[Entity] = []
    for term in custom_terms:
        if not term or len(term.strip()) < 2:
            continue
        escaped = re.escape(term.strip())
        pattern = re.compile(r"\b" + escaped + r"\b", re.IGNORECASE)
        for m in pattern.finditer(text):
            entities.append(Entity(
                text=m.group(),
                entity_type="CUSTOM",
                start=m.start(),
                end=m.end(),
                score=0.95,
                source="dictionary",
            ))
    return entities


# ---------------------------------------------------------------------------
# Context scoring boost
# ---------------------------------------------------------------------------

def _apply_context_boost(entities: List[Entity], text: str) -> List[Entity]:
    """Boost entity scores based on proximity to contextual keywords."""
    text_lower = text.lower()
    for ent in entities:
        window_start = max(0, ent.start - 120)
        window_end = min(len(text_lower), ent.end + 120)
        context_window = text_lower[window_start:window_end]
        boost_count = 0
        for cw in _CONTEXT_WORDS:
            if cw in context_window:
                boost_count += 1
                if boost_count >= 3:
                    break
        if boost_count > 0:
            ent.score = min(ent.score + (0.08 * boost_count), 0.99)
            ent.score = round(ent.score, 2)
    return entities


# ---------------------------------------------------------------------------
# Deduplication (text-span based + bbox overlap)
# ---------------------------------------------------------------------------

def _deduplicate(entities: List[Entity]) -> List[Entity]:
    """Remove overlapping entities, preferring longer + higher-score matches."""
    if not entities:
        return []
    # Prefer more specific (shorter) spans when entities overlap at the same
    # location. This avoids a broad label-based match (e.g. "Contact: ...")
    # from swallowing more precise regex-based entities like individual emails
    # or credit cards which appear inside that span.
    entities.sort(key=lambda e: (e.start, (e.end - e.start), -e.score))
    result: List[Entity] = []
    for ent in entities:
        if not result:
            result.append(ent)
            continue
        last = result[-1]
        if ent.start >= last.end:
            result.append(ent)
        else:
            len_last = last.end - last.start
            len_ent = ent.end - ent.start
            # For overlapping entities, keep the more specific (shorter) span.
            # If lengths are equal, keep the higher-confidence one.
            if len_ent < len_last or (len_ent == len_last and ent.score > last.score):
                result[-1] = ent
    return result


def _bbox_overlap_ratio(a: List[float], b: List[float]) -> float:
    """Compute overlap ratio between two bounding boxes [x0,y0,x1,y1]."""
    x_overlap = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    y_overlap = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    overlap_area = x_overlap * y_overlap
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    if area_a == 0 and area_b == 0:
        return 0.0
    min_area = min(area_a, area_b) if min(area_a, area_b) > 0 else max(area_a, area_b)
    return overlap_area / min_area if min_area > 0 else 0.0


def _deduplicate_by_bbox(entities: List[Entity], overlap_threshold: float = 0.50) -> List[Entity]:
    """Secondary dedup pass: merge entities with >50% bbox overlap on the same page."""
    if not entities:
        return []
    # Separate entities with and without bboxes
    with_bbox = [e for e in entities if e.bbox and e.page is not None]
    without_bbox = [e for e in entities if not e.bbox or e.page is None]

    if not with_bbox:
        return entities

    # Sort by page, then by score descending
    with_bbox.sort(key=lambda e: (e.page, -e.score))
    result: List[Entity] = []
    for ent in with_bbox:
        merged = False
        for existing in result:
            if existing.page == ent.page and existing.bbox and ent.bbox:
                ratio = _bbox_overlap_ratio(existing.bbox, ent.bbox)
                if ratio >= overlap_threshold:
                    # Keep the higher-confidence one
                    if ent.score > existing.score:
                        result[result.index(existing)] = ent
                    merged = True
                    break
        if not merged:
            result.append(ent)

    return result + without_bbox


def _apply_compliance_filtering(
    entities: List[Entity],
    allowed_rules: Optional[set[str]],
    risk_threshold: Optional[str],
) -> List[Entity]:
    """Filter entities based on compliance profile rules and risk threshold.

    Args:
        entities: List of detected entities
        allowed_rules: Set of allowed detection rule types (e.g., {"PERSON", "EMAIL"})
        risk_threshold: Risk threshold level ("low", "medium", "high")

    Returns:
        Filtered list of entities
    """
    if not entities:
        return []

    filtered = entities

    # Filter by allowed rules
    if allowed_rules:
        filtered = [e for e in filtered if e.entity_type.upper() in allowed_rules]

    # Filter by risk threshold
    if risk_threshold:
        threshold_map = {
            "low": 0.3,
            "medium": 0.55,
            "high": 0.75,
        }
        min_score = threshold_map.get(risk_threshold, 0.55)
        filtered = [e for e in filtered if e.score >= min_score]

    return filtered



# ---------------------------------------------------------------------------
# OCR fallback for scanned pages
# ---------------------------------------------------------------------------

def _ocr_page_text(page) -> Optional[str]:
    """Extract text from a scanned page using Tesseract OCR.

    Returns the OCR text or None if Tesseract is not available.
    """
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        logger.debug("pytesseract/Pillow not installed — skipping OCR")
        return None

    try:
        # Render page to a high-DPI image using PyMuPDF
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        ocr_text = pytesseract.image_to_string(img)
        if ocr_text and ocr_text.strip():
            logger.info("OCR extracted %d chars from page", len(ocr_text.strip()))
            return ocr_text
    except Exception as exc:
        logger.warning("OCR failed: %s", exc)

    return None


def _ocr_page_with_boxes(page) -> List[Dict[str, Any]]:
    """Run Tesseract OCR and return word-level bounding boxes.

    Returns list of dicts: {"text": str, "bbox": [x0, y0, x1, y1]}
    """
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return []

    try:
        dpi = 300
        pix = page.get_pixmap(dpi=dpi)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

        page_rect = page.rect
        scale_x = page_rect.width / pix.width
        scale_y = page_rect.height / pix.height

        words: List[Dict[str, Any]] = []
        for i, text in enumerate(data["text"]):
            if not text or not text.strip():
                continue
            conf = int(data["conf"][i])
            if conf < 30:
                continue
            x = data["left"][i] * scale_x
            y = data["top"][i] * scale_y
            w = data["width"][i] * scale_x
            h = data["height"][i] * scale_y
            words.append({
                "text": text,
                "bbox": [round(x, 2), round(y, 2), round(x + w, 2), round(y + h, 2)],
            })
        return words
    except Exception as exc:
        logger.warning("OCR box extraction failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Main detection pipeline
# ---------------------------------------------------------------------------

def detect_entities_in_text(
    text: str,
    min_confidence: float = DEFAULT_MIN_CONFIDENCE,
    custom_terms: Optional[List[str]] = None,
) -> List[Entity]:
    """Run the full hybrid detection pipeline on plain text.

    Pipeline order:
      1. Regex detectors
      2. Presidio analyzer (transformer NLP)
      3. Standalone spaCy NER (fallback if Presidio unavailable)
      4. Custom dictionary detection
      5. Context score boost
      6. Deduplication
      7. Confidence filtering
    """
    if not text or not text.strip():
        return []

    all_entities: List[Entity] = []

    # 1. Always run regex (zero dependencies)
    all_entities.extend(_regex_detect(text))

    # 2. Label-based field extraction
    all_entities.extend(_label_detect(text))

    # 3. Try Presidio (includes spaCy internally)
    presidio_results = _presidio_detect(text)
    if presidio_results:
        all_entities.extend(presidio_results)
    else:
        # 4. Presidio unavailable — try standalone spaCy
        all_entities.extend(_spacy_detect(text))

    # 4. Custom dictionary detection
    if custom_terms:
        all_entities.extend(_dictionary_detect(text, custom_terms))

    # 5. Context-aware score boost
    all_entities = _apply_context_boost(all_entities, text)

    # 6. Deduplication
    all_entities = _deduplicate(all_entities)

    # 7. Filter by confidence threshold
    all_entities = [e for e in all_entities if e.score >= min_confidence]

    return all_entities


# ---------------------------------------------------------------------------
# PDF text extraction + entity mapping (via PyMuPDF)
# ---------------------------------------------------------------------------

def _ensure_fitz():
    """Import and return fitz (PyMuPDF), or raise ImportError."""
    try:
        import fitz
        return fitz
    except ImportError:
        raise ImportError(
            "PyMuPDF (fitz) is required for inline PDF analysis. "
            "Install with: pip install PyMuPDF"
        )


def analyze_pdf_bytes(
    pdf_bytes: bytes,
    min_confidence: float = DEFAULT_MIN_CONFIDENCE,
    custom_terms: Optional[List[str]] = None,
    org_id: Optional[str] = None,
    compliance_profile: Optional[dict] = None,
) -> List[dict]:
    """Analyze a PDF and return entities with bounding boxes.

    Args:
        pdf_bytes: PDF document bytes
        min_confidence: Minimum confidence threshold for detection
        custom_terms: Additional custom terms to detect
        org_id: Organization ID for profile lookup
        compliance_profile: Pre-loaded profile (optimization)

    Returns a list of entity dicts matching the redactor API response format.
    """
    fitz = _ensure_fitz()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    all_entities: List[Entity] = []

    # Load compliance profile if org_id provided
    profile = compliance_profile
    if org_id and not profile:
        from blockvault.core.organizations import OrganizationStore
        from blockvault.core.compliance_profiles import ComplianceProfileStore

        org_store = OrganizationStore()
        profile_name = org_store.get_compliance_profile(org_id)

        if profile_name:
            profile_store = ComplianceProfileStore()
            profile = profile_store.get_profile_by_name(profile_name)

    # Extract profile settings
    allowed_rules = None
    risk_threshold = None
    if profile:
        allowed_rules = set(profile.get("rules", []))
        risk_threshold = profile.get("risk_threshold", "medium")

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        is_scanned = not text or len(text.strip()) < 20

        # OCR fallback for scanned pages
        if is_scanned:
            ocr_text = _ocr_page_text(page)
            if ocr_text:
                text = ocr_text
            else:
                # Try PyMuPDF's whitespace-preservation mode
                try:
                    text = page.get_text("text", flags=fitz.TEXT_PRESERVE_WHITESPACE)
                except Exception:
                    pass

        if not text or not text.strip():
            continue

        entities = detect_entities_in_text(
            text, min_confidence=min_confidence, custom_terms=custom_terms
        )

        for ent in entities:
            ent.page = page_num + 1  # 1-indexed
            # Mark OCR-sourced entities
            if is_scanned and ent.source != "dictionary":
                ent.source = "ocr+" + ent.source

            # Map to visual bounding box using PyMuPDF search
            try:
                instances = page.search_for(ent.text)
                if instances:
                    rect = instances[0]
                    ent.bbox = [
                        round(rect.x0, 2),
                        round(rect.y0, 2),
                        round(rect.x1, 2),
                        round(rect.y1, 2),
                    ]
            except Exception:
                pass
            all_entities.append(ent)

    doc.close()

    # Secondary bbox-based deduplication
    all_entities = _deduplicate_by_bbox(all_entities)

    # Apply compliance profile filtering
    if profile:
        all_entities = _apply_compliance_filtering(all_entities, allowed_rules, risk_threshold)

    return [e.to_dict() for e in all_entities]



# ---------------------------------------------------------------------------
# PDF Text & Regex Search (via PyMuPDF)
# ---------------------------------------------------------------------------

def search_pdf_text(pdf_bytes: bytes, query: str, is_regex: bool = False) -> List[dict]:
    """Search for literal text or regex pattern inside a PDF and return bounding boxes.
    
    Returns a list of match dicts: {"id": str, "text": str, "page": int, "bbox": [x0,y0,x1,y1]}
    """
    if not query:
        return []

    fitz = _ensure_fitz()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    matches: List[dict] = []

    if is_regex:
        try:
            pattern = re.compile(query)
        except re.error as e:
            raise ValueError(f"Invalid regular expression: {e}")

    for page_num in range(len(doc)):
        page = doc[page_num]
        
        if is_regex:
            text = page.get_text("text")
            # Find all unique string matches on the page using regex
            found_strings = set(m.group() for m in pattern.finditer(text) if m.group().strip())
            for f_str in found_strings:
                instances = page.search_for(f_str)
                for inst in instances:
                    matches.append({
                        "id": f"search-{page_num+1}-{inst.x0}-{inst.y0}",
                        "text": f_str,
                        "page": page_num + 1,
                        "bbox": [round(inst.x0, 2), round(inst.y0, 2), round(inst.x1, 2), round(inst.y1, 2)]
                    })
        else:
            instances = page.search_for(query)
            for inst in instances:
                matches.append({
                    "id": f"search-{page_num+1}-{inst.x0}-{inst.y0}",
                    "text": query,
                    "page": page_num + 1,
                    "bbox": [round(inst.x0, 2), round(inst.y0, 2), round(inst.x1, 2), round(inst.y1, 2)]
                })

    doc.close()

    # Deduplicate exact identical matches on the same page/coordinates
    unique = []
    seen = set()
    for m in matches:
        key = (m["page"], round(m["bbox"][0], 1), round(m["bbox"][1], 1), round(m["bbox"][2], 1), round(m["bbox"][3], 1))
        if key not in seen:
            seen.add(key)
            unique.append(m)

    return unique


# ---------------------------------------------------------------------------
# PDF redaction (via PyMuPDF)
# ---------------------------------------------------------------------------

def redact_pdf_bytes(
    pdf_bytes: bytes,
    entities: List[Dict[str, Any]],
    manual_boxes: Optional[List[Dict[str, Any]]] = None,
) -> bytes:
    """Apply redactions to a PDF and return the redacted bytes.

    Parameters
    ----------
    pdf_bytes : raw PDF bytes (decrypted)
    entities : list of entity dicts with text, entity_type, page, bbox
    manual_boxes : optional list of manual redaction rectangles
    """
    fitz = _ensure_fitz()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    # Process auto-detected entities
    for ent in entities:
        page_num = ent.get("page")
        if page_num is None:
            continue
        page_idx = page_num - 1
        if page_idx < 0 or page_idx >= len(doc):
            continue
        page = doc[page_idx]
        ent_text = ent.get("text", "")
        ent_bbox = ent.get("bbox")

        # Search for the exact text on the page to find all visual instances
        if ent_text:
            instances = page.search_for(ent_text)
            if instances:
                for rect in instances:
                    rect.x0 -= 1
                    rect.y0 -= 1
                    rect.x1 += 1
                    rect.y1 += 1
                    page.add_redact_annot(rect, fill=(0, 0, 0))
                    page.draw_rect(rect, color=(0, 0, 0), fill=(0, 0, 0))
            elif ent_bbox:
                # Text not found visually — use provided bbox
                rect = fitz.Rect(ent_bbox)
                rect.x0 -= 1
                rect.y0 -= 1
                rect.x1 += 1
                rect.y1 += 1
                page.add_redact_annot(rect, fill=(0, 0, 0))
                page.draw_rect(rect, color=(0, 0, 0), fill=(0, 0, 0))
        elif ent_bbox:
            rect = fitz.Rect(ent_bbox)
            rect.x0 -= 1
            rect.y0 -= 1
            rect.x1 += 1
            rect.y1 += 1
            page.add_redact_annot(rect, fill=(0, 0, 0))
            page.draw_rect(rect, color=(0, 0, 0), fill=(0, 0, 0))

    # Process manual boxes
    for box in (manual_boxes or []):
        page_num = box.get("page")
        if page_num is None:
            continue
        page_idx = page_num - 1
        if page_idx < 0 or page_idx >= len(doc):
            continue
        page = doc[page_idx]
        x = box.get("x", 0)
        y = box.get("y", 0)
        w = box.get("width", 0)
        h = box.get("height", 0)
        rect = fitz.Rect(x, y, x + w, y + h)
        rect.x0 -= 1
        rect.y0 -= 1
        rect.x1 += 1
        rect.y1 += 1
        page.add_redact_annot(rect, fill=(0, 0, 0))
        page.draw_rect(rect, color=(0, 0, 0), fill=(0, 0, 0))

    # Apply all redactions
    for page in doc:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)

    # Strip metadata
    doc.set_metadata({})

    out_buf = io.BytesIO()
    doc.save(out_buf, garbage=4, deflate=True)
    doc.close()
    return out_buf.getvalue()


def compute_inline_redaction_mask(
    original: bytes,
    redacted: bytes,
    chunk_size: int = 4096,
) -> Dict[str, Any]:
    """Compute a redaction mask comparing original and redacted bytes."""
    max_len = max(len(original), len(redacted))
    if max_len == 0:
        return {"chunk_size": chunk_size, "num_chunks": 0, "mask_bits": [], "ranges": [],
                "original_length": 0, "redacted_length": 0}

    num_chunks = math.ceil(max_len / chunk_size)
    mask_bits: List[int] = []
    for idx in range(num_chunks):
        s = idx * chunk_size
        e = s + chunk_size
        o_chunk = original[s:e]
        r_chunk = redacted[s:e]
        # Pad shorter chunk
        if len(o_chunk) < chunk_size:
            o_chunk += b"\x00" * (chunk_size - len(o_chunk))
        if len(r_chunk) < chunk_size:
            r_chunk += b"\x00" * (chunk_size - len(r_chunk))
        mask_bits.append(1 if o_chunk != r_chunk else 0)

    # Merge into ranges
    ranges: List[Dict[str, int]] = []
    current_start = None
    for idx, bit in enumerate(mask_bits):
        if bit and current_start is None:
            current_start = idx * chunk_size
        if not bit and current_start is not None:
            end = min(idx * chunk_size, max_len)
            if current_start < end:
                ranges.append({"start": current_start, "end": end})
            current_start = None
    if current_start is not None:
        end = min(num_chunks * chunk_size, max_len)
        if current_start < end:
            ranges.append({"start": current_start, "end": end})

    return {
        "chunk_size": chunk_size,
        "num_chunks": num_chunks,
        "mask_bits": mask_bits,
        "ranges": ranges,
        "original_length": len(original),
        "redacted_length": len(redacted),
    }

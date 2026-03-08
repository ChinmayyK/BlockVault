"""Hybrid entity detection pipeline for maximum redaction accuracy.

Multi-layer pipeline:
  1. Regex patterns (Indian IDs, international IDs, financial, contact, dates)
     — with checksum validation where applicable (Aadhaar Verhoeff, Credit Card Luhn)
  2. Label-based field extraction ("Name:", "Father's Name:", "Address:" → value)
  3. Microsoft Presidio Analyzer (SSN, Email, Phone, Credit Cards, IBAN, etc.)
  4. Standalone spaCy NER fallback (PERSON, ORG, LOCATION, DATE)
  5. Custom dictionary detection for user-supplied sensitive terms
  6. Context-aware score boosting near sensitive keywords
  7. Multi-pass deduplication (text-span + score-based)
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# Default minimum confidence to include an entity
DEFAULT_MIN_CONFIDENCE = 0.55

# ---------------------------------------------------------------------------
# Entity data class
# ---------------------------------------------------------------------------

@dataclass
class Entity:
    text: str
    entity_type: str
    start: int  # character offset in source text
    end: int
    page: Optional[int] = None
    bbox: Optional[List[float]] = None  # [x0, y0, x1, y1]
    score: float = 1.0
    source: str = "unknown"

    def to_dict(self) -> dict:
        d = asdict(self)
        if d["bbox"] is None:
            del d["bbox"]
        if d["page"] is None:
            del d["page"]
        return d


# ===================================================================
# LAYER 1: Regex-based PII Detectors (with validation)
# ===================================================================

# --- Checksum helpers ---

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


# --- Indian ID patterns ---

# Aadhaar number (India, 12 digits with optional spaces/dashes)
_AADHAAR_RE = re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b")

# PAN (India, ABCDE1234F format — 5 letters, 4 digits, 1 letter)
_PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")

# Indian Voter ID / EPIC (3 uppercase letters + 7 digits)
_VOTER_ID_RE = re.compile(r"\b[A-Z]{3}\d{7}\b")

# GSTIN (India, 15-char: 2 digits + PAN + 1 alphanum + Z + 1 alphanum)
_GSTIN_RE = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")

# IFSC Code (India, 4 uppercase letters + 0 + 6 alphanumeric)
_IFSC_RE = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")

# Indian Passport (1 uppercase letter + 7 digits)
_INDIAN_PASSPORT_RE = re.compile(r"\b[A-Z]\d{7}\b")

# Indian Phone (+91 prefix, 10-digit mobile)
_INDIAN_PHONE_RE = re.compile(
    r"(?<!\d)"
    r"(?:\+91[\s\-]?|91[\s\-]?|0)?"
    r"[6-9]\d{9}"
    r"(?!\d)"
)

# Indian PIN Code (6 digits, first digit 1-9)
_INDIAN_PIN_RE = re.compile(r"\b[1-9]\d{5}\b")

# --- International patterns ---

# US Social Security Number
_SSN_RE = re.compile(
    r"\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b"
)

# Email
_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
)

# US/International phone numbers
_PHONE_RE = re.compile(
    r"(?<!\d)"
    r"(?:\+?1[-.\s]?)?"
    r"(?:\(?\d{3}\)?[-.\s]?)"
    r"\d{3}[-.\s]?\d{4}"
    r"(?!\d)"
)

# Credit card (Visa, MC, Amex, Discover)
_CREDIT_CARD_RE = re.compile(
    r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))"
    r"[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,4}\b"
)

# IBAN (simplified — 2-letter country, 2-digit check, 11-30 alphanumeric)
_IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}\s?(?:\d{4}\s?){2,7}\d{1,4}\b")

# Date of Birth patterns (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-Mon-YYYY, etc.)
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

# US Passport (9 digits, optionally with letter prefix)
_US_PASSPORT_RE = re.compile(r"\b[A-Z]?\d{9}\b")

# US Driver's license (letter + 7-14 digits, state-dependent simplified)
_DL_RE = re.compile(r"\b[A-Z]\d{7,14}\b")

# Bank account number (generic — 8-18 digits)
_BANK_ACCOUNT_RE = re.compile(r"\b\d{8,18}\b")


# Pattern list with type mappings
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


def _validate_match(entity_type: str, matched_text: str) -> bool:
    """Apply domain-specific validation to reduce false positives."""
    if entity_type == "AADHAAR":
        digits = re.sub(r"\D", "", matched_text)
        if len(digits) != 12:
            return False
        # First digit of Aadhaar cannot be 0 or 1
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

            # Run validation if required
            if needs_validation and not _validate_match(entity_type, matched_text):
                continue

            # Base confidence score per type
            score_map = {
                "AADHAAR": 0.92,
                "PAN": 0.90,
                "VOTER_ID": 0.88,
                "GSTIN": 0.90,
                "IFSC": 0.85,
                "PASSPORT": 0.75,
                "SSN": 0.90,
                "EMAIL": 0.95,
                "PHONE": 0.80,
                "CREDIT_CARD": 0.92,
                "IBAN": 0.88,
                "DATE_OF_BIRTH": 0.70,
                "IP_ADDRESS": 0.72,
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


# ===================================================================
# LAYER 2: Label-based Field Extraction
# ===================================================================

# Common label patterns in Indian government documents and certificates
_LABEL_PATTERNS = [
    # Name fields
    (re.compile(
        r"(?:(?:Full\s+)?Name|Applicant|Candidate|Student|Employee|Patient"
        r"|Father(?:'s)?\s*(?:Name)?|Mother(?:'s)?\s*(?:Name)?"
        r"|Husband(?:'s)?\s*(?:Name)?|Guardian(?:'s)?\s*(?:Name)?|Spouse(?:'s)?\s*(?:Name)?)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "PERSON"),

    # Address fields
    (re.compile(
        r"(?:Address|Residential\s+Address|Permanent\s+Address|Correspondence\s+Address"
        r"|Present\s+Address|Communication\s+Address)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n\n|\n(?=[A-Z][a-z]+\s*:)|$)",
        re.IGNORECASE | re.DOTALL,
    ), "ADDRESS"),

    # Date fields
    (re.compile(
        r"(?:Date\s+of\s+Birth|DOB|D\.O\.B|Birth\s+Date|Birthday)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "DATE_OF_BIRTH"),

    # ID number fields
    (re.compile(
        r"(?:Aadhaar(?:\s+(?:No|Number|#))?|UID(?:\s+(?:No|Number))?)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "AADHAAR"),

    (re.compile(
        r"(?:PAN(?:\s+(?:No|Number|Card))?)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "PAN"),

    (re.compile(
        r"(?:Voter\s+ID|EPIC(?:\s+No)?|Election\s+(?:Card|ID))"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "VOTER_ID"),

    (re.compile(
        r"(?:Passport(?:\s+(?:No|Number))?)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "PASSPORT"),

    # Contact fields
    (re.compile(
        r"(?:(?:Mobile|Phone|Cell|Contact|Tel)(?:\s+(?:No|Number|#))?)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "PHONE"),

    (re.compile(
        r"(?:E[\-\s]?mail(?:\s+(?:ID|Address))?)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "EMAIL"),

    # Gender (sensitive in privacy context)
    (re.compile(
        r"(?:Gender|Sex)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "GENDER"),

    # Nationality / Religion / Caste (Indian docs)
    (re.compile(
        r"(?:Religion|Caste|Category|Nationality)"
        r"\s*[:;\-–—]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ), "SENSITIVE_CATEGORY"),
]


def _label_detect(text: str) -> List[Entity]:
    """Extract field values from label:value patterns."""
    entities: List[Entity] = []
    for pattern, entity_type in _LABEL_PATTERNS:
        for m in pattern.finditer(text):
            value = m.group(1).strip()
            # Skip empty or too-short values
            if not value or len(value) < 2:
                continue
            # Skip if value looks like another label
            if re.match(r"^[A-Z][a-z]+\s*:", value):
                continue
            # Cap length to avoid grabbing entire paragraphs
            if len(value) > 200:
                value = value[:200].strip()

            # Find the actual position of the value in the match
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


# ===================================================================
# LAYER 3: Presidio Integration
# ===================================================================

_presidio_analyzer = None

def _get_presidio_analyzer():
    global _presidio_analyzer
    if _presidio_analyzer is None:
        try:
            from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
            from presidio_analyzer.nlp_engine import NlpEngineProvider

            # Try models in order of accuracy
            model_cascade = ("en_core_web_trf", "en_core_web_lg", "en_core_web_md", "en_core_web_sm")
            nlp_engine = None
            for model_name in model_cascade:
                try:
                    provider = NlpEngineProvider(nlp_configuration={
                        "nlp_engine_name": "spacy",
                        "models": [{"lang_code": "en", "model_name": model_name}]
                    })
                    nlp_engine = provider.create_engine()
                    logger.info("Presidio NLP engine: %s", model_name)
                    break
                except BaseException:
                    continue

            if nlp_engine is None:
                logger.warning("No spaCy model found for Presidio")
                _presidio_analyzer = False
                return _presidio_analyzer

            registry = RecognizerRegistry()
            registry.load_predefined_recognizers()

            _presidio_analyzer = AnalyzerEngine(
                registry=registry,
                nlp_engine=nlp_engine,
                supported_languages=["en"]
            )
            logger.info("Presidio Analyzer initialized.")
        except ImportError as e:
            logger.error("Failed to load Presidio: %s", e)
            _presidio_analyzer = False
    return _presidio_analyzer


_PRESIDIO_ENTITIES = [
    "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "US_SSN",
    "CREDIT_CARD", "IBAN_CODE", "US_BANK_NUMBER",
    "LOCATION", "ORGANIZATION",
    "US_PASSPORT", "US_DRIVER_LICENSE", "DATE_TIME", "NRP",
    "IP_ADDRESS", "MEDICAL_LICENSE", "URL",
]

_PRESIDIO_TYPE_MAP = {
    "EMAIL_ADDRESS": "EMAIL",
    "PHONE_NUMBER": "PHONE",
    "US_SSN": "SSN",
    "LOCATION": "ADDRESS",
    "ORGANIZATION": "ORG",
    "CREDIT_CARD": "CREDIT_CARD",
    "IBAN_CODE": "IBAN",
    "US_BANK_NUMBER": "BANK_ACCOUNT",
    "US_PASSPORT": "PASSPORT",
    "US_DRIVER_LICENSE": "DRIVER_LICENSE",
    "DATE_TIME": "DATE_OF_BIRTH",
    "NRP": "NATIONALITY",
    "IP_ADDRESS": "IP_ADDRESS",
    "MEDICAL_LICENSE": "ID_NUMBER",
    "URL": "URL",
}


def _presidio_detect(text: str) -> List[Entity]:
    """Run Presidio Analyzer on the text."""
    analyzer = _get_presidio_analyzer()
    if not analyzer:
        return []

    entities = []
    # Context words that boost Presidio confidence
    context_words = [
        "patient", "witness", "applicant", "attorney", "client",
        "employee", "customer", "account", "beneficiary", "insured",
        "claimant", "defendant", "plaintiff", "respondent",
        "aadhaar", "pan", "passport", "voter", "epic",
    ]

    try:
        results = analyzer.analyze(
            text=text,
            language="en",
            entities=_PRESIDIO_ENTITIES,
            context=context_words,
            return_decision_process=False,
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
    except Exception as e:
        logger.warning("Presidio analysis failed: %s", e)

    return entities


# ===================================================================
# LAYER 4: Standalone spaCy NER (fallback when Presidio unavailable)
# ===================================================================

_spacy_nlp = None
_spacy_loaded = False


def _get_spacy():
    global _spacy_nlp, _spacy_loaded
    if _spacy_loaded:
        return _spacy_nlp
    _spacy_loaded = True
    try:
        import spacy
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
    max_len = nlp.max_length
    for chunk_start in range(0, len(text), max_len):
        chunk = text[chunk_start: chunk_start + max_len]
        doc = nlp(chunk)
        for ent in doc.ents:
            etype = ent.label_
            if etype not in {"PERSON", "ORG", "GPE", "LOC", "FAC", "NORP", "DATE", "MONEY"}:
                continue
            mapped = etype
            if etype in ("GPE", "LOC", "FAC"):
                mapped = "ADDRESS"
            elif etype == "NORP":
                mapped = "ORG"
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


# ===================================================================
# LAYER 5: Custom Dictionary Detection
# ===================================================================

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


# ===================================================================
# LAYER 6: Context-aware Score Boosting
# ===================================================================

_CONTEXT_WORDS = {
    # Identity
    "patient", "witness", "applicant", "attorney", "client",
    "employee", "customer", "beneficiary", "insured", "claimant",
    "defendant", "plaintiff", "respondent",
    # Documents / IDs
    "account", "ssn", "social security", "credit card", "passport",
    "license", "driver", "dob", "date of birth", "aadhaar", "pan",
    "tax id", "ein", "tin", "voter", "epic", "gstin", "ifsc",
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
    "aadhaar", "aadhar", "uid", "uidai", "pan card", "voter id",
    "ration card", "domicile", "caste", "religion", "nationality",
}


def _apply_context_boost(entities: List[Entity], text: str) -> List[Entity]:
    """Boost entity scores based on proximity to contextual keywords."""
    text_lower = text.lower()
    for ent in entities:
        window_start = max(0, ent.start - 150)
        window_end = min(len(text_lower), ent.end + 150)
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


# ===================================================================
# Deduplication
# ===================================================================

def _deduplicate(entities: List[Entity]) -> List[Entity]:
    """Remove overlapping entities, preferring longer matches and higher scores."""
    if not entities:
        return []

    # Sort by start position, then by length (desc), then score (desc)
    entities.sort(key=lambda e: (e.start, -(e.end - e.start), -e.score))

    result: List[Entity] = []
    for ent in entities:
        if not result:
            result.append(ent)
            continue

        last = result[-1]

        # If no overlap
        if ent.start >= last.end:
            result.append(ent)
        else:
            # Overlap — keep the longer or higher-score match
            len_last = last.end - last.start
            len_ent = ent.end - ent.start
            if (len_ent > len_last) or (len_ent == len_last and ent.score > last.score):
                result[-1] = ent
    return result


# ===================================================================
# Public API
# ===================================================================

def detect_entities(
    text: str,
    min_confidence: float = DEFAULT_MIN_CONFIDENCE,
    custom_terms: Optional[List[str]] = None,
) -> List[Entity]:
    """Run the full multi-layer detection pipeline on text.

    Pipeline:
      1. Regex patterns (with checksum validation)
      2. Label-based field extraction
      3. Presidio analyzer
      4. Standalone spaCy NER (fallback if Presidio unavailable)
      5. Custom dictionary detection
      6. Context score boost
      7. Deduplication
      8. Confidence filtering

    Returns deduplicated entities sorted by position.
    """
    if not text.strip():
        return []

    all_entities: List[Entity] = []

    # 1. Regex detection (always runs, zero dependencies)
    all_entities.extend(_regex_detect(text))

    # 2. Label-based field extraction
    all_entities.extend(_label_detect(text))

    # 3. Presidio (transformer-backed NLP)
    presidio_results = _presidio_detect(text)
    if presidio_results:
        all_entities.extend(presidio_results)
    else:
        # 4. Fallback to standalone spaCy
        all_entities.extend(_spacy_detect(text))

    # 5. Custom dictionary
    if custom_terms:
        all_entities.extend(_dictionary_detect(text, custom_terms))

    # 6. Context boost
    all_entities = _apply_context_boost(all_entities, text)

    # 7. Deduplication
    all_entities = _deduplicate(all_entities)

    # 8. Confidence filter
    all_entities = [e for e in all_entities if e.score >= min_confidence]

    return all_entities

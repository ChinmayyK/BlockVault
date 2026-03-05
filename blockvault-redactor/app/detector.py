"""Hybrid entity detection pipeline with Presidio Integration.

Combines:
  1. Microsoft Presidio Analyzer (handles SSN, Email, Phone, Credit Cards, IBAN, etc. with context)
  2. spaCy NER (large model) for unstructured entities (PERSON, ORG, ADDRESS)
  3. Context-based score boosting (e.g., patient, applicant, witness)

Deduplicates overlapping detections, preferring longer matches and higher confidence.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field, asdict
from typing import List, Optional

logger = logging.getLogger(__name__)

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

    def to_dict(self) -> dict:
        d = asdict(self)
        if d["bbox"] is None:
            del d["bbox"]
        if d["page"] is None:
            del d["page"]
        return d


# ---------------------------------------------------------------------------
# Presidio & spaCy initialization
# ---------------------------------------------------------------------------

_presidio_analyzer = None

def _get_presidio_analyzer():
    global _presidio_analyzer
    if _presidio_analyzer is None:
        try:
            from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
            from presidio_analyzer.nlp_engine import NlpEngineProvider

            # Use larger spaCy model for better accuracy if available
            provider = NlpEngineProvider(nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "en", "model_name": "en_core_web_lg"}]
            })
            try:
                nlp_engine = provider.create_engine()
            except BaseException:
                # Fallback to sm
                provider = NlpEngineProvider(nlp_configuration={
                    "nlp_engine_name": "spacy",
                    "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}]
                })
                nlp_engine = provider.create_engine()

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
            _presidio_analyzer = False  # mark as failed
    return _presidio_analyzer


def _presidio_detect(text: str) -> List[Entity]:
    """Run Presidio Analyzer on the text."""
    analyzer = _get_presidio_analyzer()
    if not analyzer:
        return []

    entities = []
    # Relevant PI entities
    entities_to_find = [
        "PERSON", 
        "EMAIL_ADDRESS", 
        "PHONE_NUMBER", 
        "US_SSN", 
        "CREDIT_CARD", 
        "IBAN_CODE",
        "US_BANK_NUMBER",
        "LOCATION",
        "ORGANIZATION"
    ]

    # Context words that signal sensitive personal data and boost confidence
    context_words = ["patient", "witness", "applicant", "attorney", "client", "employee", "customer", "account"]

    try:
        results = analyzer.analyze(
            text=text,
            language="en",
            entities=entities_to_find,
            context=context_words,
            return_decision_process=False,
        )
        for r in results:
            # Type mapping
            etype = r.entity_type
            if etype == "EMAIL_ADDRESS":
                etype = "EMAIL"
            elif etype == "PHONE_NUMBER":
                etype = "PHONE"
            elif etype == "US_SSN":
                etype = "SSN"
            elif etype in ("LOCATION", "GPE"):
                etype = "ADDRESS"
            elif etype == "ORGANIZATION":
                etype = "ORG"
            elif etype in ("CREDIT_CARD", "IBAN_CODE", "US_BANK_NUMBER"):
                etype = "BANK_ACCOUNT"

            entities.append(Entity(
                text=text[r.start:r.end],
                entity_type=etype,
                start=r.start,
                end=r.end,
                score=round(r.score, 2),
            ))
    except Exception as e:
        logger.warning("Presidio analysis failed: %s", e)
        
    return entities


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def _deduplicate(entities: List[Entity]) -> List[Entity]:
    """Remove overlapping entities, preferring longer matches and higher scores."""
    if not entities:
        return []
    
    # Sort primarily by start position, then by length (desc), then score (desc)
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
            # Overlap exists. Keep the one that is longer or has higher score if lengths are similar.
            len_last = last.end - last.start
            len_ent = ent.end - ent.start
            
            # If current covers more text without being completely spurious, replace last
            if (len_ent > len_last) or (len_ent == len_last and ent.score > last.score):
                result[-1] = ent
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_entities(text: str) -> List[Entity]:
    """Run the detection pipeline on text.

    Returns deduplicated entities sorted by position.
    """
    if not text.strip():
        return []
        
    all_entities: List[Entity] = []
    
    # Run Presidio
    all_entities.extend(_presidio_detect(text))
    
    return _deduplicate(all_entities)

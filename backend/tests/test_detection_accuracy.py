"""Benchmark tests for PII detection accuracy.

Tests the hybrid detection pipeline (regex + Presidio + spaCy + dictionary)
against annotated sample texts to measure precision, recall, and F1 score.

Run with:
    python -m pytest tests/test_detection_accuracy.py -v
"""
import sys
import os
import pytest
from typing import List, Dict, Set, Tuple
from dataclasses import dataclass

# Ensure the project root is on the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from blockvault.core.inline_redactor import detect_entities_in_text, Entity


# ---------------------------------------------------------------------------
# Test data — sample texts with ground-truth annotations
# ---------------------------------------------------------------------------

@dataclass
class GroundTruth:
    text: str
    entity_type: str
    start: int
    end: int


SAMPLE_TEXTS: List[Dict] = [
    {
        "name": "basic_pii",
        "text": (
            "Patient Name: John Smith\n"
            "Email: john.smith@example.com\n"
            "SSN: 123-45-6789\n"
            "Phone: (555) 987-6543\n"
            "Credit Card: 4111-1111-1111-1111\n"
        ),
        "expected": [
            GroundTruth("john.smith@example.com", "EMAIL", 32, 52),
            GroundTruth("123-45-6789", "SSN", 58, 69),
            GroundTruth("(555) 987-6543", "PHONE", 77, 91),
            GroundTruth("4111-1111-1111-1111", "CREDIT_CARD", 105, 124),
        ],
    },
    {
        "name": "legal_document",
        "text": (
            "Agreement between Acme Corporation and Jane Doe.\n"
            "Attorney: Robert Johnson\n"
            "Date signed: 2024-03-15\n"
            "Witness email: jane.doe@law.firm\n"
        ),
        "expected": [
            GroundTruth("jane.doe@law.firm", "EMAIL", 113, 130),
            GroundTruth("2024-03-15", "DATE_OF_BIRTH", 87, 97),
        ],
    },
    {
        "name": "medical_record",
        "text": (
            "Patient: Alice Williams, DOB: 03/15/1985\n"
            "Diagnosis: Type 2 Diabetes\n"
            "Physician Email: dr.brown@hospital.org\n"
            "Phone: 555-234-5678\n"
            "SSN: 987-65-4321\n"
        ),
        "expected": [
            GroundTruth("03/15/1985", "DATE_OF_BIRTH", 29, 39),
            GroundTruth("dr.brown@hospital.org", "EMAIL", 85, 106),
            GroundTruth("555-234-5678", "PHONE", 114, 126),
            GroundTruth("987-65-4321", "SSN", 132, 143),
        ],
    },
    {
        "name": "financial_data",
        "text": (
            "Account holder: Michael Chen\n"
            "Card: 5500 0000 0000 0004\n"
            "IBAN: GB29 NWBK 6016 1331 9268 19\n"
            "IP: 192.168.1.100\n"
        ),
        "expected": [
            GroundTruth("5500 0000 0000 0004", "CREDIT_CARD", 35, 54),
            GroundTruth("192.168.1.100", "IP_ADDRESS", 91, 104),
        ],
    },
    {
        "name": "mixed_entities",
        "text": (
            "Contact: sarah.jones@company.co for account 4012-8888-8888-1881. "
            "SSN is 456-78-9012 and DOB is 1990-05-22. "
            "Call (212) 555-0123 or fax 312.555.9876."
        ),
        "expected": [
            GroundTruth("sarah.jones@company.co", "EMAIL", 9, 31),
            GroundTruth("4012-8888-8888-1881", "CREDIT_CARD", 44, 63),
            GroundTruth("456-78-9012", "SSN", 72, 83),
            GroundTruth("1990-05-22", "DATE_OF_BIRTH", 95, 105),
            GroundTruth("(212) 555-0123", "PHONE", 112, 126),
        ],
    },
]


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _entities_match(detected: Entity, ground_truth: GroundTruth, fuzzy: bool = True) -> bool:
    """Check if a detected entity matches a ground truth annotation.

    Uses fuzzy matching: text overlap ≥60% counts as a match.
    """
    # Type compatibility check (allow broader type matches)
    type_aliases = {
        "DATE": {"DATE_OF_BIRTH", "DATE"},
        "DATE_OF_BIRTH": {"DATE_OF_BIRTH", "DATE"},
        "ADDRESS": {"LOCATION", "ADDRESS"},
        "LOCATION": {"LOCATION", "ADDRESS"},
        "ORG": {"ORGANIZATION", "ORG"},
        "ORGANIZATION": {"ORGANIZATION", "ORG"},
    }
    det_types = type_aliases.get(detected.entity_type, {detected.entity_type})
    gt_types = type_aliases.get(ground_truth.entity_type, {ground_truth.entity_type})
    if not det_types.intersection(gt_types):
        return False

    if fuzzy:
        # Check text overlap
        overlap_start = max(detected.start, ground_truth.start)
        overlap_end = min(detected.end, ground_truth.end)
        overlap = max(0, overlap_end - overlap_start)
        gt_len = ground_truth.end - ground_truth.start
        det_len = detected.end - detected.start
        if gt_len == 0:
            return False
        overlap_ratio = overlap / gt_len
        return overlap_ratio >= 0.6
    else:
        return detected.text == ground_truth.text


def compute_metrics(
    detected: List[Entity],
    expected: List[GroundTruth],
) -> Dict[str, float]:
    """Compute precision, recall, and F1 score."""
    if not expected:
        return {"precision": 1.0 if not detected else 0.0, "recall": 1.0, "f1": 1.0 if not detected else 0.0}

    matched_gt: Set[int] = set()
    matched_det: Set[int] = set()

    for i, det in enumerate(detected):
        for j, gt in enumerate(expected):
            if j in matched_gt:
                continue
            if _entities_match(det, gt):
                matched_gt.add(j)
                matched_det.add(i)
                break

    tp = len(matched_gt)
    fp = len(detected) - len(matched_det)
    fn = len(expected) - tp

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "tp": tp,
        "fp": fp,
        "fn": fn,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDetectionAccuracy:
    """Test suite for PII detection accuracy."""

    @pytest.mark.parametrize("sample", SAMPLE_TEXTS, ids=[s["name"] for s in SAMPLE_TEXTS])
    def test_sample_detection(self, sample):
        """Each sample text should detect its expected entities."""
        detected = detect_entities_in_text(sample["text"], min_confidence=0.5)
        metrics = compute_metrics(detected, sample["expected"])

        print(f"\n--- {sample['name']} ---")
        print(f"  Detected: {len(detected)}, Expected: {len(sample['expected'])}")
        for d in detected:
            print(f"    [{d.entity_type}] \"{d.text}\" (score={d.score}, src={d.source})")
        print(f"  Precision={metrics['precision']}, Recall={metrics['recall']}, F1={metrics['f1']}")

        # We expect at least 50% recall on every test case
        assert metrics["recall"] >= 0.50, (
            f"Recall too low for {sample['name']}: {metrics['recall']} "
            f"(TP={metrics['tp']}, FN={metrics['fn']})"
        )

    def test_email_detection(self):
        """Email addresses should be detected with high confidence."""
        text = "Send to test.user@example.com for details."
        entities = detect_entities_in_text(text, min_confidence=0.5)
        emails = [e for e in entities if e.entity_type == "EMAIL"]
        assert len(emails) >= 1, "Expected at least one EMAIL entity"
        assert emails[0].score >= 0.7

    def test_ssn_detection(self):
        """SSNs should be detected accurately."""
        text = "Patient SSN: 123-45-6789"
        entities = detect_entities_in_text(text, min_confidence=0.5)
        ssns = [e for e in entities if e.entity_type == "SSN"]
        assert len(ssns) >= 1, "Expected at least one SSN entity"

    def test_phone_detection(self):
        """Phone numbers should be detected in various formats."""
        text = "Call us at (555) 123-4567 or 555.987.6543."
        entities = detect_entities_in_text(text, min_confidence=0.5)
        phones = [e for e in entities if e.entity_type == "PHONE"]
        assert len(phones) >= 1, "Expected at least one PHONE entity"

    def test_credit_card_detection(self):
        """Credit card numbers should be detected."""
        text = "Card number: 4111-1111-1111-1111"
        entities = detect_entities_in_text(text, min_confidence=0.5)
        cards = [e for e in entities if e.entity_type == "CREDIT_CARD"]
        assert len(cards) >= 1, "Expected at least one CREDIT_CARD entity"

    def test_context_boost(self):
        """Entities near context words should have boosted scores."""
        text_with_context = "Patient SSN: 234-56-7890"
        text_without_context = "Number is 234-56-7890 end"
        ents_with = detect_entities_in_text(text_with_context, min_confidence=0.5)
        ents_without = detect_entities_in_text(text_without_context, min_confidence=0.5)
        ssns_with = [e for e in ents_with if e.entity_type == "SSN"]
        ssns_without = [e for e in ents_without if e.entity_type == "SSN"]
        if ssns_with and ssns_without:
            assert ssns_with[0].score >= ssns_without[0].score, (
                "Context boosting should increase score"
            )

    def test_confidence_filter(self):
        """Entities below min_confidence should be filtered out."""
        text = "Contact john@example.com"
        high_threshold = detect_entities_in_text(text, min_confidence=0.99)
        low_threshold = detect_entities_in_text(text, min_confidence=0.1)
        assert len(low_threshold) >= len(high_threshold), (
            "Lower threshold should return more or equal entities"
        )

    def test_custom_dictionary(self):
        """Custom dictionary terms should be detected."""
        text = "The invoice was sent to Project Aurora for the Zenith Initiative review."
        entities = detect_entities_in_text(
            text,
            min_confidence=0.5,
            custom_terms=["Project Aurora", "Zenith Initiative"],
        )
        custom = [e for e in entities if e.source == "dictionary"]
        assert len(custom) >= 1, f"Expected at least one dictionary match, got {len(custom)}: {[e.text for e in entities]}"

    def test_deduplication(self):
        """Overlapping detections should be deduplicated."""
        text = "SSN: 123-45-6789 contact john@example.com"
        entities = detect_entities_in_text(text, min_confidence=0.5)
        # Count SSN entities — should be exactly 1 after dedup
        ssns = [e for e in entities if e.entity_type == "SSN"]
        assert len(ssns) == 1, f"Expected 1 SSN after dedup, got {len(ssns)}"

    def test_empty_text(self):
        """Empty text should return no entities."""
        assert detect_entities_in_text("") == []
        assert detect_entities_in_text("   ") == []
        assert detect_entities_in_text(None) == []

    def test_entity_source_tracking(self):
        """Each entity should have a source field."""
        text = "Email: user@test.com and SSN: 111-22-3333"
        entities = detect_entities_in_text(text, min_confidence=0.5)
        for ent in entities:
            assert ent.source != "unknown", f"Entity '{ent.text}' has unknown source"

    def test_overall_benchmark(self):
        """Run all samples and compute aggregate metrics."""
        all_detected: List[Entity] = []
        all_expected: List[GroundTruth] = []
        for sample in SAMPLE_TEXTS:
            detected = detect_entities_in_text(sample["text"], min_confidence=0.5)
            all_detected.extend(detected)
            all_expected.extend(sample["expected"])

        metrics = compute_metrics(all_detected, all_expected)
        print(f"\n=== OVERALL BENCHMARK ===")
        print(f"  Total detected: {len(all_detected)}")
        print(f"  Total expected: {len(all_expected)}")
        print(f"  Precision: {metrics['precision']}")
        print(f"  Recall:    {metrics['recall']}")
        print(f"  F1 Score:  {metrics['f1']}")
        print(f"  TP={metrics['tp']} FP={metrics['fp']} FN={metrics['fn']}")

        # Aggregate F1 should be at least 0.4 with regex-only
        assert metrics["f1"] >= 0.40, f"Overall F1 too low: {metrics['f1']}"

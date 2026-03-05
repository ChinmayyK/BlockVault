import os

import pytest

from blockvault.core.zk_redaction import (
    generate_redaction_proof,
    verify_redaction_proof,
    is_snarkjs_ready,
    redaction_vkey_path,
)


def _snarkjs_enabled() -> bool:
    return os.getenv("ZK_REDACTION_RUN_SNARKJS", "").lower() in {"1", "true", "yes"}


@pytest.mark.skipif(
    not _snarkjs_enabled() or not is_snarkjs_ready(),
    reason="snarkjs artifacts not available (set ZK_REDACTION_RUN_SNARKJS=1)",
)
def test_redaction_proof_roundtrip():
    original = b"Hello Alice, SSN: 123-45-6789."
    redacted = b"Hello [REDACTED], SSN: [REDACTED]."

    bundle = generate_redaction_proof(original, redacted)
    assert "proof_package" in bundle
    assert "metadata" in bundle

    proof_package = bundle["proof_package"]
    assert proof_package.get("original_root")
    assert proof_package.get("redacted_root")
    assert proof_package.get("chunk_count")

    redaction_vkey = redaction_vkey_path()
    for chunk in proof_package.get("modified_chunks", []):
        assert verify_redaction_proof(
            chunk["proof"],
            chunk["public_signals"],
            vkey_path=redaction_vkey,
        ) is True


@pytest.mark.skipif(
    not _snarkjs_enabled() or not is_snarkjs_ready(),
    reason="snarkjs artifacts not available (set ZK_REDACTION_RUN_SNARKJS=1)",
)
def test_redaction_proof_invalid_detection():
    original = b"Top Secret: Project X"
    redacted = b"Top Secret: [REDACTED]"

    bundle = generate_redaction_proof(original, redacted)
    proof_package = bundle["proof_package"]
    modified = proof_package.get("modified_chunks", [])
    assert modified, "expected at least one modified chunk"

    chunk = modified[0]
    public_signals = list(chunk.get("public_signals", []))
    public_signals[0] = str(int(public_signals[0]) + 1)

    assert verify_redaction_proof(
        chunk.get("proof"),
        public_signals,
        vkey_path=redaction_vkey_path(),
    ) is False


@pytest.mark.skipif(
    not _snarkjs_enabled() or not is_snarkjs_ready(),
    reason="snarkjs artifacts not available (set ZK_REDACTION_RUN_SNARKJS=1)",
)
def test_redaction_large_document_chunking():
    original = b"A" * (4096 * 3) + b"TAIL"
    redacted = b"A" * (4096 * 2) + b"[REDACTED]" + b"A" * (4096 - 10) + b"TAIL"

    bundle = generate_redaction_proof(original, redacted)
    proof_package = bundle["proof_package"]
    assert proof_package.get("chunk_count", 0) >= 3
    assert len(proof_package.get("modified_chunks", [])) >= 1

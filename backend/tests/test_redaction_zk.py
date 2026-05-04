import os

import pytest

from blockvault.core import zk_redaction
from blockvault.core.zk_redaction import (
    generate_redaction_proof,
    verify_redaction_proof,
    is_snarkjs_ready,
    redaction_vkey_path,
)


def _snarkjs_enabled() -> bool:
    return os.getenv("ZK_REDACTION_RUN_SNARKJS", "").lower() in {"1", "true", "yes"}


def test_snarkjs_ready_accepts_nested_circom_wasm(monkeypatch, tmp_path):
    zk_dir = tmp_path / "zk-redaction"
    (zk_dir / "scripts").mkdir(parents=True)
    (zk_dir / "node_modules" / "snarkjs").mkdir(parents=True)
    (zk_dir / "node_modules" / "circomlibjs").mkdir(parents=True)
    (zk_dir / "build" / "redaction_js").mkdir(parents=True)

    for path in (
        zk_dir / "scripts" / "generate_proof.js",
        zk_dir / "scripts" / "verify_proof.js",
        zk_dir / "build" / "redaction_js" / "redaction.wasm",
        zk_dir / "build" / "redaction_final.zkey",
        zk_dir / "build" / "verification_key.json",
    ):
        path.write_text("", encoding="utf-8")

    monkeypatch.setattr(zk_redaction, "_zk_dir", lambda: zk_dir)
    monkeypatch.setattr(zk_redaction.shutil, "which", lambda name: "/usr/bin/node" if name == "node" else None)

    assert is_snarkjs_ready() is True


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

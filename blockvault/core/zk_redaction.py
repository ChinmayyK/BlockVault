from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _zk_dir() -> Path:
    return Path(os.environ.get("ZK_REDACTION_DIR", _project_root() / "zk" / "redaction"))


def _script_path(name: str) -> Path:
    return _zk_dir() / "scripts" / name


def _build_path(name: str) -> Path:
    return _zk_dir() / "build" / name


def _config_path() -> Path:
    return _zk_dir() / "config.json"


def _load_config() -> Dict[str, Any]:
    cfg_path = _config_path()
    if not cfg_path.exists():
        raise RuntimeError(f"missing config: {cfg_path}")
    return json.loads(cfg_path.read_text("utf-8"))


def is_snarkjs_ready() -> bool:
    if shutil.which("node") is None:
        return False
    return (
        _script_path("generate_proof.js").exists()
        and _script_path("verify_proof.js").exists()
        and (_zk_dir() / "node_modules" / "snarkjs").exists()
        and (_zk_dir() / "node_modules" / "circomlibjs").exists()
        and _build_path("redaction.wasm").exists()
        and _build_path("redaction_final.zkey").exists()
        and _build_path("verification_key.json").exists()
    )


def _chunk_bytes(data: bytes, chunk_size: int, total_chunks: int) -> List[bytes]:
    chunks: List[bytes] = []
    for idx in range(total_chunks):
        start = idx * chunk_size
        end = start + chunk_size
        chunk = data[start:end]
        if len(chunk) < chunk_size:
            chunk = chunk + b"\x00" * (chunk_size - len(chunk))
        chunks.append(chunk)
    return chunks


def _blocks_from_chunk(chunk: bytes, block_size: int) -> List[int]:
    blocks: List[int] = []
    for i in range(0, len(chunk), block_size):
        block = chunk[i : i + block_size]
        if len(block) < block_size:
            block = block + b"\x00" * (block_size - len(block))
        blocks.append(int.from_bytes(block, "big"))
    return blocks


def _mask_blocks(original_chunk: bytes, redacted_chunk: bytes, block_size: int) -> List[int]:
    mask: List[int] = []
    for i in range(0, len(original_chunk), block_size):
        orig_block = original_chunk[i : i + block_size]
        red_block = redacted_chunk[i : i + block_size]
        mask.append(1 if orig_block != red_block else 0)
    return mask


def _mask_bits_to_ranges(mask_bits: List[int], block_size: int, max_len: int) -> List[Dict[str, int]]:
    ranges: List[Dict[str, int]] = []
    current_start = None
    for idx, bit in enumerate(mask_bits):
        if bit and current_start is None:
            current_start = idx * block_size
        if not bit and current_start is not None:
            end = min(idx * block_size, max_len)
            if current_start < end:
                ranges.append({"start": current_start, "end": end})
            current_start = None
    if current_start is not None:
        end = min(len(mask_bits) * block_size, max_len)
        if current_start < end:
            ranges.append({"start": current_start, "end": end})
    return ranges


def build_redaction_inputs(original_bytes: bytes, redacted_bytes: bytes) -> Dict[str, Any]:
    """Build per-chunk proof inputs for async proof generation."""
    cfg = _load_config()
    chunk_size = int(cfg.get("chunkSize", 4096))
    block_size = int(cfg.get("blockSize", 16))

    if chunk_size <= 0 or block_size <= 0:
        raise ValueError("invalid ZK config parameters")
    if chunk_size % block_size != 0:
        raise ValueError("chunkSize must be a multiple of blockSize")

    max_len = max(len(original_bytes), len(redacted_bytes))
    if max_len == 0:
        raise ValueError("cannot build inputs for empty document")

    chunk_count = int(math.ceil(max_len / chunk_size))
    if chunk_count <= 0:
        raise ValueError("invalid chunk_count computed")

    orig_chunks = _chunk_bytes(original_bytes, chunk_size, chunk_count)
    red_chunks = _chunk_bytes(redacted_bytes, chunk_size, chunk_count)

    chunks: List[Dict[str, Any]] = []
    flat_mask_blocks: List[int] = []
    modified_chunks: List[int] = []

    for idx, (orig_chunk, red_chunk) in enumerate(zip(orig_chunks, red_chunks)):
        mask_blocks = _mask_blocks(orig_chunk, red_chunk, block_size)
        flat_mask_blocks.extend(mask_blocks)
        if any(mask_blocks):
            modified_chunks.append(idx)

        chunks.append(
            {
                "index": idx,
                "original_blocks": [str(v) for v in _blocks_from_chunk(orig_chunk, block_size)],
                "redacted_blocks": [str(v) for v in _blocks_from_chunk(red_chunk, block_size)],
                "mask_blocks": mask_blocks,
            }
        )

    return {
        "chunk_size": chunk_size,
        "block_size": block_size,
        "chunk_count": chunk_count,
        "blocks_per_chunk": chunk_size // block_size,
        "original_length": len(original_bytes),
        "redacted_length": len(redacted_bytes),
        "redaction_mask": _mask_bits_to_ranges(flat_mask_blocks, block_size, max_len),
        "modified_chunks": modified_chunks,
        "chunks": chunks,
    }


def redaction_inputs_key(file_id: str) -> str:
    return f"zk/redaction/inputs/{file_id}.json"


def redaction_proof_key(file_id: str) -> str:
    return f"zk/redaction/proofs/{file_id}.json"


def redaction_vkey_path() -> Path:
    return _build_path("verification_key.json")


def compute_proof_hash(proof_package: Dict[str, Any]) -> str:
    payload = json.dumps(proof_package, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def compute_anchor_hash(original_root: str, redacted_root: str, proof_hash: str) -> str:
    return hashlib.sha256((original_root + redacted_root + proof_hash).encode("utf-8")).hexdigest()


def generate_redaction_proof(
    original_bytes: bytes,
    redacted_bytes: bytes,
    chunk_size: Optional[int] = None,
    block_size: Optional[int] = None,
) -> Dict[str, Any]:
    """Generate a Groth16 redaction proof package via snarkjs (sync mode)."""
    if shutil.which("node") is None:
        raise RuntimeError("node is required to generate redaction proofs")

    script = _script_path("generate_proof.js")
    if not script.exists():
        raise RuntimeError(f"missing script: {script}")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        orig_path = tmp_path / "original.bin"
        red_path = tmp_path / "redacted.bin"
        orig_path.write_bytes(original_bytes)
        red_path.write_bytes(redacted_bytes)

        cmd = [
            "node",
            str(script),
            "--original",
            str(orig_path),
            "--redacted",
            str(red_path),
            "--out",
            str(tmp_path),
        ]
        if chunk_size is not None:
            cmd.extend(["--chunk-size", str(int(chunk_size))])
        if block_size is not None:
            cmd.extend(["--block-size", str(int(block_size))])

        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            raise RuntimeError(f"proof generation failed: {proc.stderr.strip() or proc.stdout.strip()}")

        proof_package = json.loads((tmp_path / "proof_package.json").read_text("utf-8"))
        metadata = json.loads((tmp_path / "metadata.json").read_text("utf-8"))

        return {
            "proof_package": proof_package,
            "metadata": metadata,
        }


def generate_redaction_proof_from_inputs(
    inputs: Dict[str, Any], progress_callback: Optional[Callable[[int, int], None]] = None
) -> Dict[str, Any]:
    """Generate a Groth16 redaction proof package using precomputed inputs."""
    if shutil.which("node") is None:
        raise RuntimeError("node is required to generate redaction proofs")

    script = _script_path("generate_proof.js")
    if not script.exists():
        raise RuntimeError(f"missing script: {script}")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        inputs_path = tmp_path / "inputs.json"
        inputs_path.write_text(json.dumps(inputs), encoding="utf-8")

        cmd = [
            "node",
            str(script),
            "--inputs",
            str(inputs_path),
            "--out",
            str(tmp_path),
        ]

        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        stdout_lines = []
        for line in proc.stdout:
            stdout_lines.append(line)
            try:
                data = json.loads(line.strip())
                if isinstance(data, dict) and data.get("progress") and progress_callback:
                    progress_callback(data.get("current", 0), data.get("total", 0))
            except json.JSONDecodeError:
                pass
                
        proc.wait()
        if proc.returncode != 0:
            stderr_output = proc.stderr.read()
            stdout_output = "".join(stdout_lines)
            raise RuntimeError(f"proof generation failed: {stderr_output.strip() or stdout_output.strip()}")

        proof_package = json.loads((tmp_path / "proof_package.json").read_text("utf-8"))
        metadata = json.loads((tmp_path / "metadata.json").read_text("utf-8"))

        return {
            "proof_package": proof_package,
            "metadata": metadata,
        }


def verify_redaction_proof(
    proof: Dict[str, Any],
    public_signals: Any,
    *,
    vkey_path: Optional[Path] = None,
) -> bool:
    """Verify a Groth16 redaction proof via snarkjs."""
    if shutil.which("node") is None:
        return False

    script = _script_path("verify_proof.js")
    vkey = vkey_path or _build_path("verification_key.json")
    if not script.exists() or not vkey.exists():
        return False

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        proof_path = tmp_path / "proof.json"
        public_path = tmp_path / "public_signals.json"
        proof_path.write_text(json.dumps(proof), encoding="utf-8")
        public_path.write_text(json.dumps(public_signals), encoding="utf-8")

        cmd = [
            "node",
            str(script),
            "--proof",
            str(proof_path),
            "--public-signals",
            str(public_path),
            "--vkey",
            str(vkey),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            return False
        try:
            result = json.loads(proc.stdout.strip())
        except json.JSONDecodeError:
            return False
        return bool(result.get("valid"))

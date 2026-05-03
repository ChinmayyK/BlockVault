"""Utilities for computing redaction masks over byte ranges."""
from __future__ import annotations

import math
from typing import Dict, List, Tuple


def _chunk_bytes(data: bytes, chunk_size: int, num_chunks: int) -> List[bytes]:
    """Split bytes into fixed-size chunks, padding with zeros."""
    chunks: List[bytes] = []
    for idx in range(num_chunks):
        start = idx * chunk_size
        end = start + chunk_size
        chunk = data[start:end]
        if len(chunk) < chunk_size:
            chunk = chunk + b"\x00" * (chunk_size - len(chunk))
        chunks.append(chunk)
    return chunks


def _mask_bits_to_ranges(mask_bits: List[int], chunk_size: int, max_len: int) -> List[Dict[str, int]]:
    """Convert a list of 0/1 mask bits into merged byte ranges."""
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
        end = min(len(mask_bits) * chunk_size, max_len)
        if current_start < end:
            ranges.append({"start": current_start, "end": end})
    return ranges


def compute_redaction_mask(
    original: bytes,
    redacted: bytes,
    chunk_size: int,
) -> Tuple[List[int], List[Dict[str, int]], int]:
    """Compute redaction mask bits and merged byte ranges.

    Returns (mask_bits, ranges, num_chunks).
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    max_len = max(len(original), len(redacted))
    if max_len == 0:
        return [], [], 0
    num_chunks = int(math.ceil(max_len / chunk_size))
    orig_chunks = _chunk_bytes(original, chunk_size, num_chunks)
    red_chunks = _chunk_bytes(redacted, chunk_size, num_chunks)

    mask_bits: List[int] = []
    for o_chunk, r_chunk in zip(orig_chunks, red_chunks):
        mask_bits.append(1 if o_chunk != r_chunk else 0)

    ranges = _mask_bits_to_ranges(mask_bits, chunk_size, max_len)
    return mask_bits, ranges, num_chunks

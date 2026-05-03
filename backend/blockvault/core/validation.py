"""Centralized input validation and sanitization for BlockVault APIs.

Prevents NoSQL injection by ensuring user inputs are plain strings,
not dicts containing MongoDB operators like ``$gt``, ``$regex``, etc.

Usage::

    from blockvault.core.validation import sanitize_id, sanitize_wallet, sanitize_str

    case_id = sanitize_id(case_id)
    wallet = sanitize_wallet(wallet)
    name = sanitize_str(name, max_len=200)
"""
from __future__ import annotations

import re
from typing import Any

from flask import abort


# ---------------------------------------------------------------------------
# Type guards
# ---------------------------------------------------------------------------

def _ensure_string(value: Any, field_name: str = "input") -> str:
    """Reject non-string values (prevents MongoDB operator injection)."""
    if not isinstance(value, str):
        abort(400, f"invalid {field_name}: expected string, got {type(value).__name__}")
    return value


# ---------------------------------------------------------------------------
# Public sanitizers
# ---------------------------------------------------------------------------

_OBJECT_ID_RE = re.compile(r"^[a-fA-F0-9]{24}$")
_UUID_RE = re.compile(
    r"^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$"
)
_WALLET_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def sanitize_id(value: Any, field_name: str = "id") -> str:
    """Validate that *value* is a string matching ObjectId or UUID format.

    Aborts with 400 if the value is not a string or doesn't match.
    """
    s = _ensure_string(value, field_name)
    s = s.strip()
    if not s:
        abort(400, f"{field_name} is required")
    # Accept either 24-char hex ObjectId or UUID
    if _OBJECT_ID_RE.match(s) or _UUID_RE.match(s):
        return s
    # Also accept plain strings that look like safe identifiers (alphanumeric + hyphens)
    if re.match(r"^[\w\-]{1,128}$", s):
        return s
    abort(400, f"invalid {field_name} format")


def sanitize_wallet(value: Any, field_name: str = "wallet address") -> str:
    """Validate that *value* is a valid Ethereum wallet address."""
    s = _ensure_string(value, field_name)
    s = s.strip()
    if not s:
        abort(400, f"{field_name} is required")
    # Normalize to lowercase 0x prefix
    if not s.startswith("0x"):
        s = "0x" + s
    s = s.lower()
    if not _WALLET_RE.match(s):
        abort(400, f"invalid {field_name}: must be 0x + 40 hex chars")
    return s


def sanitize_str(
    value: Any,
    field_name: str = "input",
    max_len: int = 500,
    required: bool = False,
) -> str:
    """Ensure *value* is a plain string, optionally capped at *max_len*."""
    s = _ensure_string(value, field_name)
    if required and not s.strip():
        abort(400, f"{field_name} is required")
    if len(s) > max_len:
        abort(400, f"{field_name} too long (max {max_len} characters)")
    return s


def reject_nosql_operators(data: Any, depth: int = 0) -> None:
    """Recursively reject dicts containing MongoDB operator keys (``$``-prefixed).

    Call this on parsed JSON request bodies to prevent NoSQL injection.
    Limits recursion depth to 10 to avoid DoS via deeply nested payloads.
    """
    if depth > 10:
        abort(400, "request body too deeply nested")
    if isinstance(data, dict):
        for key in data:
            if isinstance(key, str) and key.startswith("$"):
                abort(400, f"invalid key in request body: '{key}'")
            reject_nosql_operators(data[key], depth + 1)
    elif isinstance(data, list):
        for item in data:
            reject_nosql_operators(item, depth + 1)

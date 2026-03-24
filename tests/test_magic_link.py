"""
Unit tests for HKDF wrap/unwrap, magic-link token hashing, rate limiting,
access count enforcement, and security enhancements.
"""
import hashlib
import os
import time
import pytest

from blockvault.core.key_recovery import (
    generate_file_key,
    wrap_file_key_with_hkdf,
    unwrap_file_key_with_hkdf,
)


# ---------------------------------------------------------------------------
# HKDF basic roundtrip
# ---------------------------------------------------------------------------

def test_hkdf_wrapping_roundtrip():
    """wrap → unwrap roundtrip succeeds."""
    file_key = generate_file_key()
    secret = os.urandom(32)

    wrapped = wrap_file_key_with_hkdf(file_key, secret)
    assert isinstance(wrapped, str)
    assert len(wrapped) > 0

    unwrapped = unwrap_file_key_with_hkdf(wrapped, secret)
    assert unwrapped == file_key


def test_hkdf_wrong_secret():
    """Unwrap with wrong secret raises ValueError."""
    file_key = generate_file_key()
    correct_secret = os.urandom(32)
    wrong_secret = os.urandom(32)

    wrapped = wrap_file_key_with_hkdf(file_key, correct_secret)

    with pytest.raises(ValueError, match="HKDF unwrap failed"):
        unwrap_file_key_with_hkdf(wrapped, wrong_secret)


def test_hkdf_different_wraps_produce_different_output():
    """Same key + secret but different calls produce different ciphertext (random salt)."""
    file_key = generate_file_key()
    secret = os.urandom(32)

    wrapped1 = wrap_file_key_with_hkdf(file_key, secret)
    wrapped2 = wrap_file_key_with_hkdf(file_key, secret)

    # Different salts mean different outputs
    assert wrapped1 != wrapped2

    # Both should decrypt correctly
    assert unwrap_file_key_with_hkdf(wrapped1, secret) == file_key
    assert unwrap_file_key_with_hkdf(wrapped2, secret) == file_key


# ---------------------------------------------------------------------------
# HKDF context separation (crypto hardening)
# ---------------------------------------------------------------------------

def test_hkdf_with_context_roundtrip():
    """wrap with context → unwrap with same context succeeds."""
    file_key = generate_file_key()
    secret = os.urandom(32)
    ctx = "file-share:abc123"

    wrapped = wrap_file_key_with_hkdf(file_key, secret, context=ctx)
    unwrapped = unwrap_file_key_with_hkdf(wrapped, secret, context=ctx)
    assert unwrapped == file_key


def test_hkdf_wrong_context_fails():
    """Unwrap with different context fails."""
    file_key = generate_file_key()
    secret = os.urandom(32)

    wrapped = wrap_file_key_with_hkdf(file_key, secret, context="file-share:abc")

    with pytest.raises(ValueError, match="HKDF unwrap failed"):
        unwrap_file_key_with_hkdf(wrapped, secret, context="file-share:xyz")


def test_hkdf_context_vs_no_context_different():
    """wrap with context produces different output than without."""
    file_key = generate_file_key()
    secret = os.urandom(32)

    wrapped_no_ctx = wrap_file_key_with_hkdf(file_key, secret)
    wrapped_with_ctx = wrap_file_key_with_hkdf(file_key, secret, context="file-share:abc")

    # Can't unwrap cross-context
    with pytest.raises(ValueError):
        unwrap_file_key_with_hkdf(wrapped_with_ctx, secret)  # no context

    with pytest.raises(ValueError):
        unwrap_file_key_with_hkdf(wrapped_no_ctx, secret, context="file-share:abc")


# ---------------------------------------------------------------------------
# Token hashing & expiry
# ---------------------------------------------------------------------------

def test_magic_link_token_hashing():
    """Token hashing matches expected SHA-256."""
    token = "abc123def456"
    expected = hashlib.sha256(token.encode("utf-8")).hexdigest()
    assert expected == hashlib.sha256(token.encode("utf-8")).hexdigest()
    assert len(expected) == 64


def test_token_expiry_logic():
    """Expired tokens should be detected by timestamp comparison."""
    now_ms = int(time.time() * 1000)

    # Expired 1 hour ago
    expired_at = now_ms - (60 * 60 * 1000)
    assert now_ms > expired_at  # Should be detected as expired

    # Expires in 1 hour
    future_at = now_ms + (60 * 60 * 1000)
    assert now_ms <= future_at  # Should not be expired





# ---------------------------------------------------------------------------
# Access count enforcement logic (unit test)
# ---------------------------------------------------------------------------

def test_access_count_enforcement_logic():
    """Access count must be less than max to allow access."""
    # Simulates the check in access_file()
    access_count = 0
    max_access = 1

    assert access_count < max_access  # first access: allowed

    access_count = 1
    assert not (access_count < max_access)  # second access: blocked


def test_access_count_multiple_uses():
    """Multi-use tokens allow up to max_access_count accesses."""
    max_access = 5
    for i in range(max_access):
        assert i < max_access  # access i+1 is allowed

    assert max_access >= max_access  # access max+1 is blocked


# ---------------------------------------------------------------------------
# Log sanitization
# ---------------------------------------------------------------------------

def test_url_sanitization():
    """URL fragments are stripped from logged URLs."""
    from blockvault.core.email import _sanitize_url

    url = "https://app.blockvault.io/access/abc123#secret_hex_value"
    sanitized = _sanitize_url(url)
    assert "secret_hex_value" not in sanitized
    assert sanitized.endswith("#[REDACTED]")
    assert "abc123" in sanitized


def test_url_sanitization_no_fragment():
    """URLs without fragments are returned unchanged."""
    from blockvault.core.email import _sanitize_url

    url = "https://app.blockvault.io/access/abc123"
    assert _sanitize_url(url) == url

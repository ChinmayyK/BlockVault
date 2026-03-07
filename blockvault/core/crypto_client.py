"""
Socket client for the blockvault_crypto daemon.

The Rust daemon currently serves a single request per TCP connection
and then closes the socket. Reusing pooled sockets therefore causes
intermittent "closed connection unexpectedly" failures on the next
operation. Sensitive data (passphrase, plaintext) is transmitted only
over the loopback/internal network, never via process args or
environment.

Protocol: 4-byte big-endian length prefix  +  JSON body.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import socket
import struct
import threading
import uuid
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_DEFAULT_ADDR = "127.0.0.1:9876"
_TIMEOUT = 10  # seconds (connect + read/write)
class _ConnectionPool:
    """Connection factory for the crypto daemon."""

    def __init__(self, host: str, port: int, timeout: float):
        self._host = host
        self._port = port
        self._timeout = timeout

    def _create(self) -> socket.socket:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(self._timeout)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.connect((self._host, self._port))
        return sock

    def acquire(self) -> socket.socket:
        """Create a fresh connection for a single request."""
        return self._create()

    def release(self, sock: socket.socket) -> None:
        """Close a completed connection.

        The daemon closes its side after one response, so retaining the
        socket would only poison future requests.
        """
        try:
            sock.close()
        except OSError:
            pass

    def discard(self, sock: socket.socket) -> None:
        """Discard a broken connection."""
        try:
            sock.close()
        except OSError:
            pass


_pool: _ConnectionPool | None = None
_pool_lock = threading.Lock()


def _get_pool() -> _ConnectionPool:
    global _pool  # noqa: PLW0603
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                raw = os.environ.get("CRYPTO_DAEMON_ADDR", _DEFAULT_ADDR)
                host, port_s = raw.rsplit(":", 1)
                _pool = _ConnectionPool(host, int(port_s), _TIMEOUT)
    return _pool


# ---------------------------------------------------------------------------
# Wire protocol
# ---------------------------------------------------------------------------

def _recv_exact(sock: socket.socket, n: int) -> bytes:
    """Read exactly *n* bytes from the socket."""
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("crypto daemon closed connection unexpectedly")
        buf.extend(chunk)
    return bytes(buf)


def _send_request(payload: dict[str, Any]) -> dict[str, Any]:
    """Send a JSON request to the crypto daemon and return the response.

    Uses a fresh daemon connection for each request. On any socket
    error the connection is discarded and a ``CryptoDaemonError`` is
    raised.
    """
    pool = _get_pool()
    body = json.dumps(payload).encode("utf-8")

    sock = pool.acquire()
    try:
        # Write: 4-byte big-endian length + JSON body
        sock.sendall(struct.pack(">I", len(body)))
        sock.sendall(body)

        # Read: 4-byte big-endian length + JSON response
        raw_len = _recv_exact(sock, 4)
        resp_len = struct.unpack(">I", raw_len)[0]
        raw_resp = _recv_exact(sock, resp_len)

        pool.release(sock)
        return json.loads(raw_resp)
    except (OSError, ConnectionError, socket.timeout) as exc:
        pool.discard(sock)
        raise CryptoDaemonError(f"crypto daemon unreachable: {exc}") from exc
    except Exception:
        pool.discard(sock)
        raise


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class CryptoDaemonError(Exception):
    """Raised when the crypto daemon is unreachable (maps to HTTP 503)."""
    pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def encrypt_data(plaintext: bytes, passphrase: str, aad: str | None = None) -> bytes:
    """Encrypt plaintext bytes via the crypto daemon.

    Returns ciphertext bytes.
    Raises ``CryptoDaemonError`` if daemon is unreachable (→ 503).
    Raises ``RuntimeError`` if the daemon reports failure.
    """
    resp = _send_request({
        "operation": "encrypt",
        "passphrase": passphrase,
        "aad": aad or "",
        "data": base64.b64encode(plaintext).decode("ascii"),
    })
    if not resp.get("success"):
        raise RuntimeError(f"Encryption failed: {resp.get('error', 'unknown')}")
    return base64.b64decode(resp["output"])


def decrypt_data(ciphertext: bytes, passphrase: str, aad: str | None = None) -> bytes:
    """Decrypt ciphertext bytes via the crypto daemon.

    Returns plaintext bytes.
    Raises ``CryptoDaemonError`` if daemon is unreachable (→ 503).
    Raises ``RuntimeError`` if the daemon reports failure.
    """
    resp = _send_request({
        "operation": "decrypt",
        "passphrase": passphrase,
        "aad": aad or "",
        "data": base64.b64encode(ciphertext).decode("ascii"),
    })
    if not resp.get("success"):
        raise RuntimeError(f"Decryption failed: {resp.get('error', 'unknown')}")
    return base64.b64decode(resp["output"])


def generate_encrypted_filename() -> str:
    """Generate a unique filename for an encrypted blob."""
    return f"enc_{uuid.uuid4().hex}.bin"

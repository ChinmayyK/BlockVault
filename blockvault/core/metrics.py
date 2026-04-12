"""Production observability: Prometheus metrics and Sentry error tracking.

Provides request-level instrumentation, business metric counters, and
integration hooks for the Flask application factory.

Usage::

    from blockvault.core.metrics import init_observability, track_upload, track_proof

    # In app factory:
    init_observability(app)

    # In business logic:
    track_upload(file_size=len(data), file_type="pdf")
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from flask import Flask, Response, request as flask_request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory metrics store (lightweight alternative when prometheus_client
# is not installed — still exposes /metrics in a Prometheus-compatible format)
# ---------------------------------------------------------------------------

_metrics: Dict[str, Any] = {
    # Counters
    "http_requests_total": 0,
    "http_requests_by_method": {},
    "http_requests_by_status": {},
    "http_requests_by_endpoint": {},
    "uploads_total": 0,
    "uploads_bytes_total": 0,
    "downloads_total": 0,
    "zk_proofs_total": 0,
    "zk_proofs_failed": 0,
    "auth_logins_total": 0,
    "auth_failures_total": 0,
    "ws_connections_active": 0,
    # Histograms (simplified as lists of recent durations)
    "request_duration_seconds": [],
    "upload_duration_seconds": [],
    "zk_proof_duration_seconds": [],
    "ipfs_op_total": {},
    "eth_txn_latency_seconds": [],
    "crypto_latency_seconds": [],
}

_MAX_HISTOGRAM_SAMPLES = 1000  # Keep last N samples for percentile calculation


def _inc(key: str, amount: int = 1) -> None:
    """Increment a counter metric."""
    _metrics[key] = _metrics.get(key, 0) + amount


def _inc_map(key: str, label: str, amount: int = 1) -> None:
    """Increment a labeled counter."""
    if key not in _metrics:
        _metrics[key] = {}
    _metrics[key][label] = _metrics[key].get(label, 0) + amount


def _observe(key: str, value: float) -> None:
    """Record a histogram observation."""
    if key not in _metrics:
        _metrics[key] = []
    samples = _metrics[key]
    samples.append(value)
    if len(samples) > _MAX_HISTOGRAM_SAMPLES:
        _metrics[key] = samples[-_MAX_HISTOGRAM_SAMPLES:]


# ---------------------------------------------------------------------------
# Business metric trackers (call from anywhere)
# ---------------------------------------------------------------------------

def track_upload(file_size: int = 0, file_type: str = "", duration: float = 0) -> None:
    """Track a file upload event."""
    _inc("uploads_total")
    _inc("uploads_bytes_total", file_size)
    if duration:
        _observe("upload_duration_seconds", duration)


def track_download() -> None:
    """Track a file download event."""
    _inc("downloads_total")


def track_proof(duration: float = 0, success: bool = True) -> None:
    """Track a ZK proof generation event."""
    _inc("zk_proofs_total")
    if not success:
        _inc("zk_proofs_failed")
    if duration:
        _observe("zk_proof_duration_seconds", duration)


def track_auth(success: bool = True) -> None:
    """Track an authentication attempt."""
    if success:
        _inc("auth_logins_total")
    else:
        _inc("auth_failures_total")


def track_ws_connect() -> None:
    _inc("ws_connections_active")


def track_ws_disconnect() -> None:
    _metrics["ws_connections_active"] = max(0, _metrics.get("ws_connections_active", 0) - 1)


def track_ipfs(op: str, success: bool = True) -> None:
    """Track an IPFS operation (upload/download)."""
    result = "success" if success else "failure"
    label = f"{op}:{result}"
    _inc_map("ipfs_op_total", label)


def track_eth(txn_type: str, duration: float) -> None:
    """Track Ethereum transaction latency."""
    _observe("eth_txn_latency_seconds", duration)


def track_crypto(op: str, duration: float) -> None:
    """Track cryptographic operation latency (encrypt/decrypt)."""
    _observe("crypto_latency_seconds", duration)


# ---------------------------------------------------------------------------
# Prometheus-format export
# ---------------------------------------------------------------------------

def _percentile(samples: list, p: float) -> float:
    """Calculate the p-th percentile from a sorted list of samples."""
    if not samples:
        return 0.0
    sorted_samples = sorted(samples)
    k = (len(sorted_samples) - 1) * p
    f = int(k)
    c = f + 1 if f + 1 < len(sorted_samples) else f
    return sorted_samples[f] + (k - f) * (sorted_samples[c] - sorted_samples[f])


def format_prometheus() -> str:
    """Format all metrics in Prometheus exposition format."""
    lines = []

    # Counters
    lines.append("# HELP blockvault_http_requests_total Total HTTP requests")
    lines.append("# TYPE blockvault_http_requests_total counter")
    lines.append(f'blockvault_http_requests_total {_metrics["http_requests_total"]}')

    for method, count in _metrics.get("http_requests_by_method", {}).items():
        lines.append(f'blockvault_http_requests_total{{method="{method}"}} {count}')

    for status, count in _metrics.get("http_requests_by_status", {}).items():
        lines.append(f'blockvault_http_requests_total{{status="{status}"}} {count}')

    lines.append("# HELP blockvault_uploads_total Total file uploads")
    lines.append("# TYPE blockvault_uploads_total counter")
    lines.append(f'blockvault_uploads_total {_metrics["uploads_total"]}')

    lines.append("# HELP blockvault_uploads_bytes_total Total bytes uploaded")
    lines.append("# TYPE blockvault_uploads_bytes_total counter")
    lines.append(f'blockvault_uploads_bytes_total {_metrics["uploads_bytes_total"]}')

    lines.append("# HELP blockvault_downloads_total Total file downloads")
    lines.append("# TYPE blockvault_downloads_total counter")
    lines.append(f'blockvault_downloads_total {_metrics["downloads_total"]}')

    lines.append("# HELP blockvault_zk_proofs_total Total ZK proof generations")
    lines.append("# TYPE blockvault_zk_proofs_total counter")
    lines.append(f'blockvault_zk_proofs_total {_metrics["zk_proofs_total"]}')

    lines.append("# HELP blockvault_zk_proofs_failed Total failed ZK proofs")
    lines.append("# TYPE blockvault_zk_proofs_failed counter")
    lines.append(f'blockvault_zk_proofs_failed {_metrics["zk_proofs_failed"]}')

    lines.append("# HELP blockvault_auth_logins_total Total successful logins")
    lines.append("# TYPE blockvault_auth_logins_total counter")
    lines.append(f'blockvault_auth_logins_total {_metrics["auth_logins_total"]}')

    lines.append("# HELP blockvault_auth_failures_total Total failed login attempts")
    lines.append("# TYPE blockvault_auth_failures_total counter")
    lines.append(f'blockvault_auth_failures_total {_metrics["auth_failures_total"]}')

    # Gauges
    lines.append("# HELP blockvault_ws_connections_active Active WebSocket connections")
    lines.append("# TYPE blockvault_ws_connections_active gauge")
    lines.append(f'blockvault_ws_connections_active {_metrics["ws_connections_active"]}')

    lines.append("# HELP blockvault_ipfs_op_total Total IPFS operations")
    lines.append("# TYPE blockvault_ipfs_op_total counter")
    for label, count in _metrics.get("ipfs_op_total", {}).items():
        if ":" in label:
            op, res = label.split(":", 1)
            lines.append(f'blockvault_ipfs_op_total{{op="{op}",result="{res}"}} {count}')

    # Histograms (simplified percentiles)
    for hist_name in (
        "request_duration_seconds",
        "upload_duration_seconds",
        "zk_proof_duration_seconds",
        "eth_txn_latency_seconds",
        "crypto_latency_seconds",
    ):
        samples = _metrics.get(hist_name, [])
        label = f"blockvault_{hist_name}"
        lines.append(f"# HELP {label} Duration in seconds")
        lines.append(f"# TYPE {label} summary")
        if samples:
            lines.append(f'{label}{{quantile="0.5"}} {_percentile(samples, 0.5):.6f}')
            lines.append(f'{label}{{quantile="0.9"}} {_percentile(samples, 0.9):.6f}')
            lines.append(f'{label}{{quantile="0.99"}} {_percentile(samples, 0.99):.6f}')
            lines.append(f"{label}_count {len(samples)}")
            lines.append(f"{label}_sum {sum(samples):.6f}")

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Flask integration
# ---------------------------------------------------------------------------

def init_observability(app: Flask) -> None:
    """Initialize observability: request metrics middleware, /metrics endpoint, Sentry."""

    # Request timing middleware
    @app.before_request
    def _before_request():
        flask_request._metrics_start = time.monotonic()  # type: ignore[attr-defined]

    @app.after_request
    def _after_request(response):
        start = getattr(flask_request, "_metrics_start", None)
        if start is not None:
            duration = time.monotonic() - start
            _inc("http_requests_total")
            _inc_map("http_requests_by_method", flask_request.method)
            _inc_map("http_requests_by_status", str(response.status_code))
            endpoint = flask_request.endpoint or "unknown"
            _inc_map("http_requests_by_endpoint", endpoint)
            _observe("request_duration_seconds", duration)
        return response

    # Prometheus metrics endpoint
    @app.get("/metrics")
    def prometheus_metrics():
        return Response(format_prometheus(), mimetype="text/plain; charset=utf-8")

    # Sentry integration (optional)
    sentry_dsn = app.config.get("SENTRY_DSN") or ""
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.flask import FlaskIntegration

            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[FlaskIntegration()],
                traces_sample_rate=float(app.config.get("SENTRY_TRACES_RATE", 0.1)),
                environment=app.config.get("FLASK_ENV", "production"),
                release=app.config.get("APP_VERSION", "unknown"),
            )
            logger.info("Sentry initialized (dsn=%s...)", sentry_dsn[:20])
        except ImportError:
            logger.warning("sentry-sdk not installed — error tracking disabled")
        except Exception as exc:
            logger.warning("Sentry initialization failed: %s", exc)
    else:
        logger.info("SENTRY_DSN not configured — error tracking disabled")

    logger.info("Observability initialized (metrics endpoint: /metrics)")

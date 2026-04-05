"""
S3-compatible object storage module for encrypted blob management.

Provides a module-level boto3 client singleton initialised at app startup.
Supports AWS S3 and MinIO via the ``S3_ENDPOINT`` configuration.
"""
from __future__ import annotations

import logging
import sys
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from flask import Flask

logger = logging.getLogger(__name__)

_s3_client = None
_bucket: str | None = None


def init_s3(app: Flask) -> None:
    """Create the module-level S3 client singleton.

    Must be called once during ``create_app``.  If the target bucket is
    unreachable the process exits immediately (fail-fast).
    """
    global _s3_client, _bucket  # noqa: PLW0603

    bucket = app.config.get("S3_BUCKET")
    if not bucket:
        logger.critical("S3_BUCKET is not configured. Cannot start without object storage.")
        sys.exit(1)

    _bucket = bucket

    kwargs: dict = {
        "region_name": app.config.get("S3_REGION", "us-east-1"),
        "config": BotoConfig(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    }

    endpoint = app.config.get("S3_ENDPOINT")
    if endpoint:
        kwargs["endpoint_url"] = endpoint

    access_key = app.config.get("S3_ACCESS_KEY")
    secret_key = app.config.get("S3_SECRET_KEY")
    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key

    _s3_client = boto3.client("s3", **kwargs)

    # Fail-fast: verify bucket is reachable (and create if missing in dev/minio).
    try:
        _s3_client.head_bucket(Bucket=_bucket)
        logger.info("S3 bucket '%s' is reachable.", _bucket)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"404", "NoSuchBucket", "NotFound"}:
            try:
                _s3_client.create_bucket(Bucket=_bucket)
                logger.info("Created missing S3 bucket '%s'.", _bucket)
            except Exception as create_exc:
                logger.warning(
                    "S3 bucket '%s' missing and auto-create failed: %s. Storage operations will fail until resolved.",
                    _bucket,
                    create_exc,
                )
        else:
            logger.warning(
                "S3 bucket '%s' is unreachable at startup: %s. Storage operations will fail until resolved.",
                _bucket,
                exc,
            )
    except Exception as exc:
        logger.warning(
            "S3 bucket '%s' is unreachable at startup: %s. Storage operations will fail until resolved.",
            _bucket,
            exc,
        )


def _client():
    if _s3_client is None:
        raise RuntimeError(
            "S3 client not initialised. Ensure init_s3() is called during app startup."
        )
    return _s3_client


def _get_bucket() -> str:
    if _bucket is None:
        raise RuntimeError("S3 bucket not configured.")
    return _bucket


def head_bucket() -> None:
    """Verify bucket is reachable (for health checks)."""
    _client().head_bucket(Bucket=_get_bucket())


# ---------------------------------------------------------------------------
# Blob operations
# ---------------------------------------------------------------------------


def upload_blob(key: str, data: bytes) -> None:
    """Upload encrypted bytes to S3.

    Content-Type is forced to ``application/octet-stream`` and no
    server-side encryption is applied (the application handles crypto).
    """
    _client().put_object(
        Bucket=_get_bucket(),
        Key=key,
        Body=data,
        ContentType="application/octet-stream",
    )


def download_blob(key: str) -> bytes:
    """Download an encrypted blob from S3 and return raw bytes."""
    try:
        resp = _client().get_object(Bucket=_get_bucket(), Key=key)
        return resp["Body"].read()
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            raise FileNotFoundError(f"S3 object not found: {key}") from exc
        raise


def delete_blob(key: str) -> None:
    """Delete an encrypted blob from S3 (best-effort)."""
    try:
        _client().delete_object(Bucket=_get_bucket(), Key=key)
    except Exception:
        logger.warning("Failed to delete S3 object: %s", key, exc_info=True)


def blob_exists(key: str) -> bool:
    """Check whether an encrypted blob exists in S3 via HEAD."""
    try:
        _client().head_object(Bucket=_get_bucket(), Key=key)
        return True
    except ClientError:
        return False


def generate_presigned_url(key: str, expires: int = 300) -> Optional[str]:
    """Generate a pre-signed GET URL for a blob (default 5 min expiry)."""
    try:
        url = _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": _get_bucket(), "Key": key},
            ExpiresIn=expires,
        )
        return url
    except Exception:
        logger.warning("Failed to generate pre-signed URL for: %s", key, exc_info=True)
        return None

"""Celery application for BlockVault background tasks.

Broker and result backend use Redis, configured via the
``CELERY_BROKER_URL`` environment variable (default ``redis://localhost:6379/0``).
"""
from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery = Celery(
    "blockvault",
    broker=broker_url,
    backend=broker_url,
    include=["blockvault.core.tasks"],
)

# Batch anchoring interval (seconds).  Default: daily (86400).
# Set ANCHOR_BATCH_INTERVAL_SECONDS to override.
_batch_interval = int(os.environ.get("ANCHOR_BATCH_INTERVAL_SECONDS", "86400"))

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_always_eager=os.environ.get("FLASK_ENV", "development") == "development",
    # Soft/hard time limits so a stuck IPFS or web3 call doesn't block forever
    task_soft_time_limit=120,
    task_time_limit=180,
    # Celery Beat schedule for periodic tasks
    beat_schedule={
        "batch-anchor-daily": {
            "task": "blockvault.core.tasks.batch_anchor",
            "schedule": _batch_interval,
            "options": {"queue": "default"},
        },
        "anchor-audit-chain-hourly": {
            "task": "blockvault.core.tasks.anchor_audit_chain",
            "schedule": 3600,  # every hour
            "options": {"queue": "default"},
        },
    },
)

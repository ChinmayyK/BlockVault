"""Celery application for BlockVault background tasks.

Broker and result backend use Redis, configured via the
``CELERY_BROKER_URL`` environment variable (default ``redis://localhost:6379/0``).
"""
from __future__ import annotations

import os

from celery import Celery

broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery = Celery(
    "blockvault",
    broker=broker_url,
    backend=broker_url,
    include=["blockvault.core.tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    # Soft/hard time limits so a stuck IPFS or web3 call doesn't block forever
    task_soft_time_limit=120,
    task_time_limit=180,
)

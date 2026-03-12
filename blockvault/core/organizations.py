"""
Organization management with compliance profile support.

This module provides:
- OrganizationStore: Persistence for organization data including compliance profile assignments
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from datetime import datetime

from pymongo.database import Database

from blockvault.core.db import get_db

logger = logging.getLogger(__name__)


class OrganizationStore:
    """Manages organization data including compliance profiles."""

    def __init__(self, db: Optional[Database] = None):
        """Initialize the organization store.

        Args:
            db: MongoDB database instance (defaults to get_db())
        """
        self.db = db or get_db()
        self.collection = self.db["organizations"]
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        """Create indexes for organizations collection."""
        try:
            self.collection.create_index("name", background=True)
            logger.info("Organizations indexes ensured.")
        except Exception as exc:
            logger.warning("Failed to create organization indexes: %s", exc)

    def set_compliance_profile(
        self, org_id: str, profile_name: Optional[str]
    ) -> None:
        """Set or clear organization's compliance profile.

        Args:
            org_id: Organization ID
            profile_name: Profile name to activate, or None to deactivate

        Raises:
            ValueError: If profile_name is provided but doesn't exist
            RuntimeError: If organization doesn't exist
        """
        # Validate profile exists if provided
        if profile_name is not None:
            from blockvault.core.compliance_profiles import ComplianceProfileStore

            profile_store = ComplianceProfileStore(self.db)
            if not profile_store.profile_exists(profile_name):
                raise ValueError(f"Compliance profile '{profile_name}' does not exist")

        # Check organization exists
        org = self.collection.find_one({"_id": org_id})
        if not org:
            raise RuntimeError(f"Organization '{org_id}' not found")

        # Update organization
        now = int(datetime.utcnow().timestamp() * 1000)
        self.collection.update_one(
            {"_id": org_id},
            {
                "$set": {
                    "compliance_profile": profile_name,
                    "updated_at": now,
                }
            },
        )

        action = "activated" if profile_name else "deactivated"
        logger.info(
            "Compliance profile %s for organization %s: %s",
            action,
            org_id,
            profile_name or "none",
        )

    def get_compliance_profile(self, org_id: str) -> Optional[str]:
        """Get organization's active compliance profile name.

        Args:
            org_id: Organization ID

        Returns:
            Profile name or None if no profile active or org doesn't exist
        """
        org = self.collection.find_one({"_id": org_id})
        if not org:
            return None
        return org.get("compliance_profile")

    def create_organization(self, org_id: str, name: str) -> dict[str, Any]:
        """Create a new organization.

        Args:
            org_id: Unique organization ID
            name: Organization name

        Returns:
            Created organization document

        Raises:
            ValueError: If organization already exists
        """
        if self.collection.find_one({"_id": org_id}):
            raise ValueError(f"Organization with ID '{org_id}' already exists")

        now = int(datetime.utcnow().timestamp() * 1000)
        org = {
            "_id": org_id,
            "name": name,
            "compliance_profile": None,
            "created_at": now,
            "updated_at": now,
        }

        self.collection.insert_one(org)
        logger.info("Created organization: %s", name)
        return org

    def get_organization(self, org_id: str) -> Optional[dict[str, Any]]:
        """Get organization by ID.

        Args:
            org_id: Organization ID

        Returns:
            Organization document or None if not found
        """
        return self.collection.find_one({"_id": org_id})

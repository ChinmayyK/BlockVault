"""
Compliance Profiles for regulatory-aligned redaction policies.

This module provides:
- ComplianceProfileStore: Persistence and validation for compliance profiles
- ProfileValidator: Validation of detection rules against supported types
- seed_compliance_profiles: Initialize default profiles (GDPR, HIPAA, FINRA, Legal Discovery)
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Optional
from datetime import datetime

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from blockvault.core.db import get_db

logger = logging.getLogger(__name__)

# Supported detection rule identifiers
SUPPORTED_RULES = {
    "PERSON",
    "EMAIL",
    "PHONE",
    "ADDRESS",
    "SSN",
    "MEDICAL_ID",
    "ACCOUNT_NUMBER",
    "CREDIT_CARD",
    "ORGANIZATION",
    "AADHAAR",
    "PAN",
    "PASSPORT",
}

VALID_RISK_THRESHOLDS = {"low", "medium", "high"}


class ProfileValidator:
    """Validates compliance profile configurations."""

    @staticmethod
    def validate_rules(rules: list[str]) -> tuple[bool, Optional[str]]:
        """Validate detection rules against supported types.

        Args:
            rules: List of detection rule identifiers

        Returns:
            (is_valid, error_message)
        """
        if not rules:
            return False, "Rules array cannot be empty"

        if not isinstance(rules, list):
            return False, "Rules must be a list"

        unsupported = set(rules) - SUPPORTED_RULES
        if unsupported:
            unsupported_str = ", ".join(sorted(unsupported))
            return False, f"Unsupported detection rules: {unsupported_str}"

        return True, None


class ComplianceProfileStore:
    """Manages compliance profile persistence and validation."""

    def __init__(self, db: Optional[Database] = None):
        """Initialize the profile store.

        Args:
            db: MongoDB database instance (defaults to get_db())
        """
        self.db = db or get_db()
        self.collection = self.db["compliance_profiles"]
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        """Create indexes for compliance_profiles collection."""
        try:
            self.collection.create_index("profile_id", unique=True, background=True)
            self.collection.create_index("name", background=True)
            logger.info("Compliance profiles indexes ensured.")
        except Exception as exc:
            logger.warning("Failed to create compliance profile indexes: %s", exc)

    def create_profile(
        self,
        profile_id: str,
        name: str,
        description: str,
        rules: list[str],
        risk_threshold: str,
        auto_redact: bool,
    ) -> dict[str, Any]:
        """Create a new compliance profile with validation.

        Args:
            profile_id: Unique identifier for the profile
            name: Display name
            description: Human-readable description
            rules: List of detection rule identifiers
            risk_threshold: One of "low", "medium", "high"
            auto_redact: Enable automatic redaction

        Returns:
            Created profile document

        Raises:
            ValueError: If validation fails
            DuplicateKeyError: If profile_id already exists
        """
        # Validate risk_threshold
        if risk_threshold not in VALID_RISK_THRESHOLDS:
            raise ValueError(
                f"risk_threshold must be one of: {', '.join(sorted(VALID_RISK_THRESHOLDS))}"
            )

        # Validate rules
        is_valid, error_msg = ProfileValidator.validate_rules(rules)
        if not is_valid:
            raise ValueError(error_msg)

        # Validate auto_redact
        if not isinstance(auto_redact, bool):
            raise ValueError("auto_redact must be a boolean value")

        # Validate required fields
        if not name or not isinstance(name, str):
            raise ValueError("name is required and must be a non-empty string")

        if not description or not isinstance(description, str):
            raise ValueError("description is required and must be a non-empty string")

        now = int(datetime.utcnow().timestamp() * 1000)
        profile = {
            "profile_id": profile_id,
            "name": name,
            "description": description,
            "rules": rules,
            "risk_threshold": risk_threshold,
            "auto_redact": auto_redact,
            "created_at": now,
            "updated_at": now,
        }

        try:
            self.collection.insert_one(profile)
            logger.info("Created compliance profile: %s", name)
            return profile
        except DuplicateKeyError:
            raise ValueError(f"Profile with ID '{profile_id}' already exists")

    def get_profile_by_name(self, name: str) -> Optional[dict[str, Any]]:
        """Retrieve a profile by its name.

        Args:
            name: Profile name

        Returns:
            Profile document or None if not found
        """
        return self.collection.find_one({"name": name})

    def get_all_profiles(self) -> list[dict[str, Any]]:
        """Retrieve all available compliance profiles.

        Returns:
            List of profile documents
        """
        profiles = list(self.collection.find({}))
        # Remove MongoDB _id from results
        for profile in profiles:
            profile.pop("_id", None)
        return profiles

    def profile_exists(self, name: str) -> bool:
        """Check if a profile exists by name.

        Args:
            name: Profile name

        Returns:
            True if profile exists, False otherwise
        """
        return self.collection.count_documents({"name": name}, limit=1) > 0


def seed_compliance_profiles(db: Optional[Database] = None) -> None:
    """Initialize default compliance profiles (idempotent).

    Creates four default profiles:
    - GDPR: European data protection
    - HIPAA: Healthcare privacy protection
    - FINRA: Financial industry compliance
    - Legal Discovery: Legal document discovery

    Safe to run multiple times - will skip existing profiles.

    Args:
        db: MongoDB database instance (defaults to get_db())
    """
    store = ComplianceProfileStore(db)

    default_profiles = [
        {
            "profile_id": "gdpr",
            "name": "GDPR",
            "description": "General Data Protection Regulation compliance profile for European data protection",
            "rules": ["PERSON", "EMAIL", "PHONE", "ADDRESS"],
            "risk_threshold": "medium",
            "auto_redact": True,
        },
        {
            "profile_id": "hipaa",
            "name": "HIPAA",
            "description": "Health Insurance Portability and Accountability Act compliance profile for protecting patient health information",
            "rules": ["PERSON", "EMAIL", "PHONE", "SSN", "MEDICAL_ID"],
            "risk_threshold": "high",
            "auto_redact": True,
        },
        {
            "profile_id": "finra",
            "name": "FINRA",
            "description": "Financial Industry Regulatory Authority compliance profile for financial services",
            "rules": ["PERSON", "ACCOUNT_NUMBER", "CREDIT_CARD"],
            "risk_threshold": "high",
            "auto_redact": True,
        },
        {
            "profile_id": "legal_discovery",
            "name": "Legal Discovery",
            "description": "Legal document discovery compliance profile for litigation and investigation",
            "rules": ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ORGANIZATION"],
            "risk_threshold": "medium",
            "auto_redact": True,
        },
    ]

    for profile_data in default_profiles:
        if store.profile_exists(profile_data["name"]):
            logger.info("Compliance profile '%s' already exists, skipping.", profile_data["name"])
            continue

        try:
            store.create_profile(**profile_data)
        except Exception as exc:
            logger.error("Failed to create compliance profile '%s': %s", profile_data["name"], exc)

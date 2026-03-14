"""
Organization management with membership and compliance profile support.

Collections:
  - organizations: {_id, name, compliance_profile, created_at, updated_at}
  - org_members:   {org_id, wallet_address, role, joined_at}
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from pymongo.database import Database

from blockvault.core.db import get_db
from blockvault.core.roles import OrgRole

logger = logging.getLogger(__name__)


class OrganizationStore:
    """Manages organization data, membership, and compliance profiles."""

    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()
        self.collection = self.db["organizations"]
        self.members_collection = self.db["org_members"]
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        try:
            self.collection.create_index("name", background=True)
            self.members_collection.create_index(
                [("org_id", 1), ("wallet_address", 1)],
                unique=True,
                background=True,
                name="idx_org_members_unique",
            )
            self.members_collection.create_index(
                "wallet_address",
                background=True,
                name="idx_org_members_wallet",
            )
            logger.info("Organization indexes ensured.")
        except Exception as exc:
            logger.warning("Failed to create organization indexes: %s", exc)

    # ------------------------------------------------------------------
    # Organization CRUD
    # ------------------------------------------------------------------

    def create_organization(
        self, org_id: str, name: str, creator_wallet: str
    ) -> Dict[str, Any]:
        """Create a new organization. Creator becomes ORG_OWNER."""
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

        # Auto-add creator as ORG_OWNER
        self.add_member(org_id, creator_wallet, OrgRole.ORG_OWNER)

        logger.info("Created organization '%s' by %s", name, creator_wallet)
        return org

    def get_organization(self, org_id: str) -> Optional[Dict[str, Any]]:
        return self.collection.find_one({"_id": org_id})

    def list_organizations(self) -> List[Dict[str, Any]]:
        return list(self.collection.find({}))

    # ------------------------------------------------------------------
    # Membership
    # ------------------------------------------------------------------

    def add_member(
        self, org_id: str, wallet_address: str, role: OrgRole = OrgRole.ORG_MEMBER
    ) -> Dict[str, Any]:
        """Add a member to an organization (or update role if exists)."""
        wallet = wallet_address.strip().lower()
        now = int(datetime.utcnow().timestamp() * 1000)
        doc = {
            "org_id": org_id,
            "wallet_address": wallet,
            "role": role.value,
            "joined_at": now,
        }
        self.members_collection.update_one(
            {"org_id": org_id, "wallet_address": wallet},
            {"$set": doc},
            upsert=True,
        )
        logger.info("Added %s to org %s as %s", wallet, org_id, role.value)
        return doc

    def remove_member(self, org_id: str, wallet_address: str) -> bool:
        """Remove a member from an organization."""
        wallet = wallet_address.strip().lower()
        result = self.members_collection.delete_one(
            {"org_id": org_id, "wallet_address": wallet}
        )
        return result.deleted_count > 0

    def update_member_role(
        self, org_id: str, wallet_address: str, new_role: OrgRole
    ) -> bool:
        """Update a member's role in an organization."""
        wallet = wallet_address.strip().lower()
        result = self.members_collection.update_one(
            {"org_id": org_id, "wallet_address": wallet},
            {"$set": {"role": new_role.value}},
        )
        return result.modified_count > 0

    def get_members(self, org_id: str) -> List[Dict[str, Any]]:
        """Get all members of an organization."""
        return list(
            self.members_collection.find(
                {"org_id": org_id}, {"_id": 0}
            )
        )

    def get_member_role(
        self, org_id: str, wallet_address: str
    ) -> Optional[OrgRole]:
        """Get a user's role in an organization."""
        wallet = wallet_address.strip().lower()
        doc = self.members_collection.find_one(
            {"org_id": org_id, "wallet_address": wallet}
        )
        if not doc:
            return None
        try:
            return OrgRole(doc["role"])
        except (ValueError, KeyError):
            return None

    def get_user_orgs(self, wallet_address: str) -> List[Dict[str, Any]]:
        """Get all organizations a user belongs to, with their roles."""
        wallet = wallet_address.strip().lower()
        memberships = list(
            self.members_collection.find(
                {"wallet_address": wallet}, {"_id": 0}
            )
        )
        result = []
        for m in memberships:
            org = self.get_organization(m["org_id"])
            if org:
                result.append({
                    "org_id": m["org_id"],
                    "name": org.get("name", ""),
                    "role": m["role"],
                    "joined_at": m.get("joined_at"),
                })
        return result

    # ------------------------------------------------------------------
    # Compliance profiles (preserved from original)
    # ------------------------------------------------------------------

    def set_compliance_profile(
        self, org_id: str, profile_name: Optional[str]
    ) -> None:
        if profile_name is not None:
            from blockvault.core.compliance_profiles import ComplianceProfileStore
            profile_store = ComplianceProfileStore(self.db)
            if not profile_store.profile_exists(profile_name):
                raise ValueError(f"Compliance profile '{profile_name}' does not exist")

        org = self.collection.find_one({"_id": org_id})
        if not org:
            raise RuntimeError(f"Organization '{org_id}' not found")

        now = int(datetime.utcnow().timestamp() * 1000)
        self.collection.update_one(
            {"_id": org_id},
            {"$set": {"compliance_profile": profile_name, "updated_at": now}},
        )

    def get_compliance_profile(self, org_id: str) -> Optional[str]:
        org = self.collection.find_one({"_id": org_id})
        if not org:
            return None
        return org.get("compliance_profile")

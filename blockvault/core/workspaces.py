"""
Workspace management with membership support.

Collections:
  - workspaces:         {_id, name, org_id, owner_wallet, created_at}
  - workspace_members:  {workspace_id, wallet_address, role, joined_at}
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime

from pymongo.database import Database

from blockvault.core.db import get_db
from blockvault.core.roles import WorkspaceRole

logger = logging.getLogger(__name__)

PERSONAL_VAULT_NAME = "Personal Vault"


class WorkspaceStore:
    """Manages workspace data and membership."""

    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()
        self.collection = self.db["workspaces"]
        self.members_collection = self.db["workspace_members"]
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        try:
            self.collection.create_index("owner_wallet", background=True)
            self.collection.create_index("org_id", background=True)
            self.members_collection.create_index(
                [("workspace_id", 1), ("wallet_address", 1)],
                unique=True,
                background=True,
                name="idx_ws_members_unique",
            )
            self.members_collection.create_index(
                "wallet_address",
                background=True,
                name="idx_ws_members_wallet",
            )
            logger.info("Workspace indexes ensured.")
        except Exception as exc:
            logger.warning("Failed to create workspace indexes: %s", exc)

    # ------------------------------------------------------------------
    # Workspace CRUD
    # ------------------------------------------------------------------

    def create_workspace(
        self,
        name: str,
        owner_wallet: str,
        org_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        encrypted_workspace_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new workspace. Creator becomes WORKSPACE_OWNER."""
        wallet = owner_wallet.strip().lower()
        ws_id = workspace_id or str(uuid.uuid4())
        now = int(datetime.utcnow().timestamp() * 1000)

        doc = {
            "_id": ws_id,
            "name": name,
            "org_id": org_id,
            "owner_wallet": wallet,
            "created_at": now,
        }
        self.collection.insert_one(doc)

        # Auto-add creator as WORKSPACE_OWNER
        self.add_member(ws_id, wallet, WorkspaceRole.WORKSPACE_OWNER, encrypted_workspace_key)

        logger.info("Created workspace '%s' (id=%s) for %s", name, ws_id, wallet)
        return doc

    def get_workspace(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        return self.collection.find_one({"_id": workspace_id})

    def list_org_workspaces(self, org_id: str) -> List[Dict[str, Any]]:
        return list(self.collection.find({"org_id": org_id}))

    # ------------------------------------------------------------------
    # Personal Vault
    # ------------------------------------------------------------------

    def ensure_personal_vault(self, wallet_address: str, encrypted_workspace_key: Optional[str] = None) -> Dict[str, Any]:
        """Get or create the user's personal vault workspace."""
        wallet = wallet_address.strip().lower()

        # Check if personal vault already exists
        existing = self.collection.find_one({
            "owner_wallet": wallet,
            "org_id": None,
            "name": PERSONAL_VAULT_NAME,
        })
        if existing:
            return existing

        # Create one
        return self.create_workspace(
            name=PERSONAL_VAULT_NAME,
            owner_wallet=wallet,
            org_id=None,
            encrypted_workspace_key=encrypted_workspace_key,
        )

    # ------------------------------------------------------------------
    # Membership
    # ------------------------------------------------------------------

    def add_member(
        self,
        workspace_id: str,
        wallet_address: str,
        role: WorkspaceRole = WorkspaceRole.WORKSPACE_VIEWER,
        encrypted_workspace_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Add a member to a workspace (or update role if exists)."""
        wallet = wallet_address.strip().lower()
        now = int(datetime.utcnow().timestamp() * 1000)
        doc = {
            "workspace_id": workspace_id,
            "wallet_address": wallet,
            "role": role.value,
            "joined_at": now,
        }
        if encrypted_workspace_key:
            doc["encrypted_workspace_key"] = encrypted_workspace_key
            
        self.members_collection.update_one(
            {"workspace_id": workspace_id, "wallet_address": wallet},
            {"$set": doc},
            upsert=True,
        )
        return doc

    def remove_member(self, workspace_id: str, wallet_address: str) -> bool:
        wallet = wallet_address.strip().lower()
        result = self.members_collection.delete_one(
            {"workspace_id": workspace_id, "wallet_address": wallet}
        )
        return result.deleted_count > 0

    def update_member_role(
        self, workspace_id: str, wallet_address: str, new_role: WorkspaceRole
    ) -> bool:
        wallet = wallet_address.strip().lower()
        result = self.members_collection.update_one(
            {"workspace_id": workspace_id, "wallet_address": wallet},
            {"$set": {"role": new_role.value}},
        )
        return result.modified_count > 0

    def get_members(self, workspace_id: str) -> List[Dict[str, Any]]:
        return list(
            self.members_collection.find({"workspace_id": workspace_id}, {"_id": 0})
        )

    def get_member_role(
        self, workspace_id: str, wallet_address: str
    ) -> Optional[WorkspaceRole]:
        wallet = wallet_address.strip().lower()
        doc = self.members_collection.find_one(
            {"workspace_id": workspace_id, "wallet_address": wallet}
        )
        if not doc:
            return None
        try:
            return WorkspaceRole(doc["role"])
        except (ValueError, KeyError):
            return None

    def get_user_workspaces(self, wallet_address: str) -> List[Dict[str, Any]]:
        """Get all workspaces a user belongs to, with their roles."""
        wallet = wallet_address.strip().lower()
        memberships = list(
            self.members_collection.find({"wallet_address": wallet}, {"_id": 0})
        )
        result = []
        for m in memberships:
            ws = self.get_workspace(m["workspace_id"])
            if ws:
                result.append({
                    "workspace_id": m["workspace_id"],
                    "name": ws.get("name", ""),
                    "org_id": ws.get("org_id"),
                    "role": m["role"],
                    "encrypted_workspace_key": m.get("encrypted_workspace_key"),
                })
        return result

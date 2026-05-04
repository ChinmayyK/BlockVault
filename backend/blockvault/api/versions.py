"""Document version history API blueprint.

Provides endpoints to view and manage file version chains.
"""
from __future__ import annotations

import logging
from flask import Blueprint, request, abort, jsonify

from ..core.security import require_auth, Role
from ..core.audit import log_event
from ..core.validation import sanitize_id, sanitize_str, reject_nosql_operators
from ..core import versioning as version_store

logger = logging.getLogger(__name__)

bp = Blueprint("versions", __name__)


@bp.get("/files/<file_id>/versions")
@require_auth
def list_versions(file_id: str):
    """List all versions of a file."""
    file_id = sanitize_id(file_id, "file_id")
    owner = getattr(request, "address", "").lower()

    # Get or create the version chain
    chain_id = version_store.get_file_version_chain(file_id)
    if not chain_id:
        # No version chain yet — return single "version 1" entry
        return jsonify({
            "versions": [],
            "total": 0,
            "versionChainId": None,
            "message": "No version history — this file has a single version.",
        })

    versions = version_store.list_versions(chain_id)
    return jsonify({
        "versions": versions,
        "total": len(versions),
        "versionChainId": chain_id,
    })


@bp.post("/files/<file_id>/versions")
@require_auth
def create_version(file_id: str):
    """Create a new version entry for a file.

    Body: { "newFileId": "...", "changeSummary": "..." }
    The newFileId should reference an already-uploaded file.
    """
    file_id = sanitize_id(file_id, "file_id")
    owner = getattr(request, "address", "").lower()
    data = request.get_json(silent=True) or {}
    reject_nosql_operators(data)

    new_file_id = data.get("newFileId")
    if not new_file_id:
        abort(400, "newFileId is required")
    new_file_id = sanitize_id(new_file_id, "newFileId")

    change_summary = data.get("changeSummary", "")

    # Get or create the version chain for the original file
    chain_id = version_store.get_file_version_chain(file_id)
    if not chain_id:
        # Initialize a version chain for the original file
        chain_id = version_store.create_version_chain(file_id, owner)

    version = version_store.add_version(
        chain_id=chain_id,
        new_file_id=new_file_id,
        parent_file_id=file_id,
        owner=owner,
        change_summary=change_summary,
    )

    log_event("file_version_created", target_id=file_id, details={
        "version_number": version["versionNumber"],
        "new_file_id": new_file_id,
        "chain_id": chain_id,
    })

    return jsonify(version), 201


@bp.get("/files/<file_id>/versions/<int:version_number>")
@require_auth
def get_version(file_id: str, version_number: int):
    """Get metadata for a specific version."""
    file_id = sanitize_id(file_id, "file_id")
    chain_id = version_store.get_file_version_chain(file_id)
    if not chain_id:
        abort(404, "No version history for this file")

    version = version_store.get_version(chain_id, version_number)
    if not version:
        abort(404, f"Version {version_number} not found")

    return jsonify(version)

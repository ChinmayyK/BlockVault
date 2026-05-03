"""
Compliance Profile Management API.

Endpoints:
- GET /compliance/profiles - List all available compliance profiles
- POST /orgs/<org_id>/compliance-profile - Activate a compliance profile
- DELETE /orgs/<org_id>/compliance-profile - Deactivate the active profile
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request, abort

from ..core.security import verify_jwt, Role
from ..core.compliance_profiles import ComplianceProfileStore
from ..core.organizations import OrganizationStore
from ..core.audit import log_event

logger = logging.getLogger(__name__)

bp = Blueprint("compliance", __name__)


def ensure_role(min_role: int) -> bool:
    """Verify JWT and check role. Abort if insufficient."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        abort(401, "authorization required")

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        decoded = verify_jwt(token)
    except Exception as exc:
        logger.warning("JWT verification failed: %s", exc)
        abort(401, "invalid or expired token")

    address = decoded.get("sub", "").lower()
    request.address = address  # type: ignore[attr-defined]

    # Check role from database
    from ..core.db import get_db
    user_doc = get_db()["users"].find_one({"address": address})
    user_role = int(user_doc.get("role", Role.USER)) if user_doc else Role.USER

    if user_role < min_role:
        abort(403, f"role {Role.name(min_role)} required")

    return True


@bp.route("/profiles", methods=["GET"])
def list_compliance_profiles():
    """List all available compliance profiles.

    Returns:
        JSON response with profiles array
    """
    try:
        store = ComplianceProfileStore()
        profiles = store.get_all_profiles()

        # Format response
        formatted_profiles = []
        for profile in profiles:
            formatted_profiles.append({
                "name": profile.get("name"),
                "description": profile.get("description"),
                "rules": profile.get("rules", []),
                "risk_threshold": profile.get("risk_threshold"),
                "auto_redact": profile.get("auto_redact", True),
            })

        return jsonify({"profiles": formatted_profiles})
    except Exception as exc:
        logger.error("Failed to list compliance profiles: %s", exc)
        abort(500, "failed to retrieve compliance profiles")


@bp.route("/orgs/<org_id>/compliance-profile", methods=["POST"])
def activate_compliance_profile(org_id: str):
    """Activate a compliance profile for an organization.

    Requires admin role.

    Args:
        org_id: Organization ID

    Request body:
        {
            "profile_name": str  # Name of profile to activate
        }

    Returns:
        JSON response with success status and profile name
    """
    ensure_role(Role.ADMIN)

    data = request.get_json()
    if not data or "profile_name" not in data:
        abort(400, "profile_name required in request body")

    profile_name = data["profile_name"]
    if not isinstance(profile_name, str) or not profile_name.strip():
        abort(400, "profile_name must be a non-empty string")

    try:
        # Validate profile exists
        profile_store = ComplianceProfileStore()
        if not profile_store.profile_exists(profile_name):
            abort(400, f"Compliance profile '{profile_name}' does not exist")

        # Get previous profile for audit log
        org_store = OrganizationStore()
        previous_profile = org_store.get_compliance_profile(org_id)

        # Activate profile
        org_store.set_compliance_profile(org_id, profile_name)

        # Log audit event
        requester = getattr(request, "address", "unknown")
        log_event(
            action="compliance_profile_activated",
            user_id=requester,
            target_id=org_id,
            details={
                "profile_name": profile_name,
                "previous_profile": previous_profile,
                "activated_by": requester,
            },
        )

        logger.info(
            "Compliance profile '%s' activated for org '%s' by %s",
            profile_name,
            org_id,
            requester,
        )

        return jsonify({"success": True, "profile": profile_name})

    except ValueError as exc:
        # Profile doesn't exist or validation error
        abort(400, str(exc))
    except RuntimeError as exc:
        # Organization not found
        abort(404, str(exc))
    except Exception as exc:
        logger.error("Failed to activate compliance profile: %s", exc)
        abort(500, "failed to activate compliance profile")


@bp.route("/orgs/<org_id>/compliance-profile", methods=["DELETE"])
def deactivate_compliance_profile(org_id: str):
    """Deactivate the active compliance profile for an organization.

    Requires admin role.

    Args:
        org_id: Organization ID

    Returns:
        JSON response with success status
    """
    ensure_role(Role.ADMIN)

    try:
        org_store = OrganizationStore()

        # Get current profile for audit log
        current_profile = org_store.get_compliance_profile(org_id)

        # Deactivate profile
        org_store.set_compliance_profile(org_id, None)

        # Log audit event
        requester = getattr(request, "address", "unknown")
        log_event(
            action="compliance_profile_deactivated",
            user_id=requester,
            target_id=org_id,
            details={
                "profile_name": current_profile,
                "deactivated_by": requester,
            },
        )

        logger.info(
            "Compliance profile deactivated for org '%s' by %s (was: %s)",
            org_id,
            requester,
            current_profile,
        )

        return jsonify({"success": True})

    except RuntimeError as exc:
        # Organization not found
        abort(404, str(exc))
    except Exception as exc:
        logger.error("Failed to deactivate compliance profile: %s", exc)
        abort(500, "failed to deactivate compliance profile")

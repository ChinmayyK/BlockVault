from __future__ import annotations

from flask import Blueprint, request, abort
from ..core.security import require_auth, require_role, Role
from ..core.settings import get_settings, update_settings

bp = Blueprint("settings", __name__)


@bp.get("/")
@require_auth
def read_settings():  # type: ignore
    get_settings()
    return {}


@bp.post("/")
@require_auth
@require_role(Role.ADMIN)
def write_settings():  # type: ignore
    data = request.get_json(silent=True) or {}
    update_settings()
    from ..core.audit import log_event
    log_event("settings_update", details={"keys": list(data.keys())})
    return {"updated": True}


@bp.post('/import-manifest')
@require_auth
@require_role(Role.ADMIN)
def import_manifest():  # type: ignore
    return {"imported": False, "note": "on-chain access control removed"}
"""
Enhanced audit log API endpoints.

Provides querying, filtering, and export functionality for audit logs.
"""
from flask import Blueprint, request, jsonify, abort, current_app
from ..core.security import require_auth, Role
from ..core.postgres_db import get_postgres_connection
from ..core.enhanced_audit import verify_hash_chain
import csv
import io
import json
from datetime import datetime, timedelta

bp = Blueprint("audit_logs", __name__, url_prefix="/api/audit")


def ensure_role(min_role: int) -> bool:
    """Ensure user has minimum role."""
    from ..core.permissions import _get_platform_role
    user_role = _get_platform_role(getattr(request, "address", ""))
    if user_role.value < min_role:
        abort(403, f"requires role {min_role} or higher")
    return True


@bp.get("/logs")
@require_auth
def query_audit_logs():
    """Query audit logs with filtering and pagination.
    
    Query parameters:
    - user_id: Filter by user ID
    - category: Filter by category (auth, document, admin, security)
    - event_type: Filter by specific event type
    - resource_id: Filter by resource ID
    - start_date: Start date (ISO format)
    - end_date: End date (ISO format)
    - limit: Number of results (default 50, max 1000)
    - offset: Pagination offset
    """
    ensure_role(Role.ADMIN)
    
    # Parse query parameters
    user_id = request.args.get("user_id")
    category = request.args.get("category")
    event_type = request.args.get("event_type")
    resource_id = request.args.get("resource_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    
    try:
        limit = min(int(request.args.get("limit", "50")), 1000)
        offset = int(request.args.get("offset", "0"))
    except ValueError:
        abort(400, "limit and offset must be integers")
    
    # Build query
    conditions = []
    params = []
    
    if user_id:
        conditions.append("user_id = %s")
        params.append(user_id)
    
    if category:
        conditions.append("category = %s")
        params.append(category)
    
    if event_type:
        conditions.append("event_type = %s")
        params.append(event_type)
    
    if resource_id:
        conditions.append("resource_id = %s")
        params.append(resource_id)
    
    if start_date:
        try:
            datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            conditions.append("timestamp >= %s")
            params.append(start_date)
        except ValueError:
            abort(400, "invalid start_date format")
    
    if end_date:
        try:
            datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            conditions.append("timestamp <= %s")
            params.append(end_date)
        except ValueError:
            abort(400, "invalid end_date format")
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    
    try:
        with get_postgres_connection() as conn:
            with conn.cursor() as cur:
                # Get total count
                count_query = f"SELECT COUNT(*) FROM audit_logs WHERE {where_clause}"
                cur.execute(count_query, params)
                total = cur.fetchone()[0]
                
                # Get logs
                query = f"""
                    SELECT 
                        log_id, timestamp, event_type, category, user_id,
                        resource_id, resource_type, action, result,
                        context, metadata, current_hash, blockchain_tx_id
                    FROM audit_logs
                    WHERE {where_clause}
                    ORDER BY timestamp DESC
                    LIMIT %s OFFSET %s
                """
                cur.execute(query, params + [limit, offset])
                
                logs = []
                for row in cur.fetchall():
                    logs.append({
                        "log_id": str(row[0]),
                        "timestamp": row[1].isoformat() if row[1] else None,
                        "event_type": row[2],
                        "category": row[3],
                        "user_id": row[4],
                        "resource_id": row[5],
                        "resource_type": row[6],
                        "action": row[7],
                        "result": row[8],
                        "context": json.loads(row[9]) if row[9] else {},
                        "metadata": json.loads(row[10]) if row[10] else {},
                        "hash": row[11],
                        "blockchain_tx_id": row[12],
                    })
                
                return {
                    "logs": logs,
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "has_more": offset + limit < total
                }
    
    except Exception as exc:
        current_app.logger.error(f"Failed to query audit logs: {exc}")
        abort(500, "failed to query audit logs")


@bp.get("/logs/export")
@require_auth
def export_audit_logs():
    """Export audit logs in CSV or JSON format.
    
    Query parameters: Same as query_audit_logs
    - format: csv or json (default: csv)
    """
    ensure_role(Role.ADMIN)
    
    export_format = request.args.get("format", "csv").lower()
    if export_format not in ("csv", "json"):
        abort(400, "format must be csv or json")
    
    # Use same filtering logic as query
    user_id = request.args.get("user_id")
    category = request.args.get("category")
    event_type = request.args.get("event_type")
    resource_id = request.args.get("resource_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    
    # Build query
    conditions = []
    params = []
    
    if user_id:
        conditions.append("user_id = %s")
        params.append(user_id)
    
    if category:
        conditions.append("category = %s")
        params.append(category)
    
    if event_type:
        conditions.append("event_type = %s")
        params.append(event_type)
    
    if resource_id:
        conditions.append("resource_id = %s")
        params.append(resource_id)
    
    if start_date:
        conditions.append("timestamp >= %s")
        params.append(start_date)
    
    if end_date:
        conditions.append("timestamp <= %s")
        params.append(end_date)
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    
    try:
        with get_postgres_connection() as conn:
            with conn.cursor() as cur:
                query = f"""
                    SELECT 
                        log_id, timestamp, event_type, category, user_id,
                        resource_id, resource_type, action, result,
                        context, metadata, current_hash, blockchain_tx_id
                    FROM audit_logs
                    WHERE {where_clause}
                    ORDER BY timestamp DESC
                    LIMIT 10000
                """
                cur.execute(query, params)
                
                rows = cur.fetchall()
                
                if export_format == "csv":
                    # Generate CSV
                    output = io.StringIO()
                    writer = csv.writer(output)
                    
                    # Header
                    writer.writerow([
                        "log_id", "timestamp", "event_type", "category", "user_id",
                        "resource_id", "resource_type", "action", "result",
                        "ip_address", "user_agent", "geolocation", "hash", "blockchain_tx_id"
                    ])
                    
                    # Data
                    for row in rows:
                        context = json.loads(row[9]) if row[9] else {}
                        writer.writerow([
                            str(row[0]),
                            row[1].isoformat() if row[1] else "",
                            row[2],
                            row[3],
                            row[4] or "",
                            row[5] or "",
                            row[6] or "",
                            row[7],
                            row[8],
                            context.get("ip_address", ""),
                            context.get("user_agent", ""),
                            json.dumps(context.get("geolocation")) if context.get("geolocation") else "",
                            row[11],
                            row[12] or "",
                        ])
                    
                    response = current_app.response_class(
                        output.getvalue(),
                        mimetype="text/csv",
                        headers={"Content-Disposition": f"attachment; filename=audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"}
                    )
                    return response
                
                else:  # json
                    logs = []
                    for row in rows:
                        logs.append({
                            "log_id": str(row[0]),
                            "timestamp": row[1].isoformat() if row[1] else None,
                            "event_type": row[2],
                            "category": row[3],
                            "user_id": row[4],
                            "resource_id": row[5],
                            "resource_type": row[6],
                            "action": row[7],
                            "result": row[8],
                            "context": json.loads(row[9]) if row[9] else {},
                            "metadata": json.loads(row[10]) if row[10] else {},
                            "hash": row[11],
                            "blockchain_tx_id": row[12],
                        })
                    
                    response = current_app.response_class(
                        json.dumps({"logs": logs, "exported_at": datetime.utcnow().isoformat()}),
                        mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"}
                    )
                    return response
    
    except Exception as exc:
        current_app.logger.error(f"Failed to export audit logs: {exc}")
        abort(500, "failed to export audit logs")


@bp.get("/logs/verify")
@require_auth
def verify_audit_logs():
    """Verify integrity of audit log hash chain.
    
    Query parameters:
    - start_log_id: Starting log ID (optional)
    - end_log_id: Ending log ID (optional)
    """
    ensure_role(Role.ADMIN)
    
    start_log_id = request.args.get("start_log_id")
    end_log_id = request.args.get("end_log_id")
    
    try:
        result = verify_hash_chain(start_log_id, end_log_id)
        return result
    except Exception as exc:
        current_app.logger.error(f"Failed to verify hash chain: {exc}")
        abort(500, "failed to verify hash chain")


@bp.get("/security-alerts")
@require_auth
def get_security_alerts():
    """Get recent security alerts.
    
    Query parameters:
    - limit: Number of results (default 50, max 500)
    - severity: Filter by severity (high, medium, low)
    """
    ensure_role(Role.ADMIN)
    
    try:
        limit = min(int(request.args.get("limit", "50")), 500)
    except ValueError:
        abort(400, "limit must be an integer")
    
    severity = request.args.get("severity")
    
    try:
        with get_postgres_connection() as conn:
            with conn.cursor() as cur:
                conditions = ["event_type = 'security.alert'"]
                params = []
                
                if severity:
                    conditions.append("metadata->>'severity' = %s")
                    params.append(severity)
                
                where_clause = " AND ".join(conditions)
                
                query = f"""
                    SELECT 
                        log_id, timestamp, user_id, metadata
                    FROM audit_logs
                    WHERE {where_clause}
                    ORDER BY timestamp DESC
                    LIMIT %s
                """
                cur.execute(query, params + [limit])
                
                alerts = []
                for row in cur.fetchall():
                    metadata = json.loads(row[3]) if row[3] else {}
                    alerts.append({
                        "alert_id": str(row[0]),
                        "timestamp": row[1].isoformat() if row[1] else None,
                        "user_id": row[2],
                        "rule_id": metadata.get("rule_id"),
                        "alert_name": metadata.get("alert_name"),
                        "severity": metadata.get("severity"),
                        "description": metadata.get("description"),
                    })
                
                return {"alerts": alerts, "count": len(alerts)}
    
    except Exception as exc:
        current_app.logger.error(f"Failed to get security alerts: {exc}")
        abort(500, "failed to get security alerts")

"""
Enhanced audit trail system with cryptographic hash chain and tamper detection.

Provides comprehensive logging of all system activities with:
- Cryptographic hash chain for tamper evidence
- Geolocation tracking
- Security alert generation
- Blockchain anchoring for critical events
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any

import requests
from flask import request

from blockvault.core.postgres_db import get_postgres_connection

logger = logging.getLogger(__name__)

# Event categories
AUDIT_EVENTS = {
    "AUTH": {
        "LOGIN_SUCCESS": "auth.login.success",
        "LOGIN_FAILURE": "auth.login.failure",
        "LOGOUT": "auth.logout",
        "PASSWORD_CHANGE": "auth.password.change",
        "MFA_ENABLED": "auth.mfa.enabled",
        "SESSION_EXPIRED": "auth.session.expired",
    },
    "DOCUMENT": {
        "UPLOAD": "document.upload",
        "DOWNLOAD": "document.download",
        "VIEW": "document.view",
        "UPDATE": "document.update",
        "DELETE": "document.delete",
        "SHARE": "document.share",
        "UNSHARE": "document.unshare",
    },
    "ADMIN": {
        "USER_CREATE": "admin.user.create",
        "USER_DELETE": "admin.user.delete",
        "ROLE_CHANGE": "admin.role.change",
        "SETTINGS_UPDATE": "admin.settings.update",
        "POLICY_CREATE": "admin.policy.create",
    },
    "SECURITY": {
        "SUSPICIOUS_LOGIN": "security.suspicious_login",
        "MULTIPLE_FAILURES": "security.multiple_failures",
        "UNAUTHORIZED_ACCESS": "security.unauthorized_access",
        "API_KEY_COMPROMISED": "security.api_key_compromised",
    },
}

# Security alert rules
ALERT_RULES = [
    {
        "rule_id": "multiple-login-failures",
        "name": "Multiple Failed Login Attempts",
        "event_type": "auth.login.failure",
        "threshold": 5,
        "time_window": 300,  # 5 minutes
        "severity": "high",
    },
    {
        "rule_id": "new-location-login",
        "name": "Login from New Location",
        "event_type": "auth.login.success",
        "pattern": "new_location",
        "severity": "medium",
    },
]


class AuditLogger:
    """Enhanced audit logging with hash chain and security alerts."""
    
    def __init__(self):
        self._last_hash = None
    
    def log_event(
        self,
        event_type: str,
        category: str,
        action: str,
        result: str,
        user_id: str | None = None,
        resource_id: str | None = None,
        resource_type: str | None = None,
        metadata: dict | None = None,
        blockchain_tx_id: str | None = None,
    ) -> str:
        """Log an audit event with hash chain.
        
        Args:
            event_type: Type of event (e.g., 'auth.login.success')
            category: Event category ('auth', 'document', 'admin', 'security')
            action: Action performed
            result: Result ('success', 'failure', 'denied')
            user_id: User ID (if applicable)
            resource_id: Resource ID (if applicable)
            resource_type: Resource type (if applicable)
            metadata: Additional metadata
            blockchain_tx_id: Blockchain transaction ID (for critical events)
            
        Returns:
            Log ID
        """
        try:
            # Get request context
            context = self._get_request_context()
            
            # Get previous hash for chain
            previous_hash = self._get_last_hash()
            
            # Create log entry
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": event_type,
                "category": category,
                "user_id": user_id,
                "resource_id": resource_id,
                "resource_type": resource_type,
                "action": action,
                "result": result,
                "context": context,
                "metadata": metadata or {},
                "previous_hash": previous_hash,
            }
            
            # Calculate current hash
            current_hash = self._calculate_hash(log_entry)
            log_entry["current_hash"] = current_hash
            log_entry["blockchain_tx_id"] = blockchain_tx_id
            
            # Store in database
            log_id = self._store_log(log_entry)
            
            # Update last hash
            self._last_hash = current_hash
            
            # Check for security alerts
            self._check_security_alerts(event_type, user_id, context)
            
            return log_id
            
        except Exception as exc:
            logger.error(f"Failed to log audit event: {exc}")
            return None
    
    def _get_request_context(self) -> dict:
        """Extract context from current request."""
        try:
            ip_address = request.remote_addr or "unknown"
            user_agent = request.headers.get("User-Agent", "unknown")
            
            # Get geolocation from IP
            geolocation = self._get_geolocation(ip_address)
            
            return {
                "ip_address": ip_address,
                "user_agent": user_agent,
                "geolocation": geolocation,
                "session_id": request.cookies.get("session_id", "unknown"),
            }
        except Exception:
            return {
                "ip_address": "unknown",
                "user_agent": "unknown",
                "geolocation": None,
                "session_id": "unknown",
            }
    
    def _get_geolocation(self, ip_address: str) -> dict | None:
        """Get geolocation data from IP address.
        
        Uses ip-api.com free tier (45 requests/minute limit).
        """
        if ip_address in ("unknown", "127.0.0.1", "localhost"):
            return None
        
        try:
            response = requests.get(
                f"http://ip-api.com/json/{ip_address}",
                timeout=2
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    return {
                        "country": data.get("country"),
                        "city": data.get("city"),
                        "coordinates": [data.get("lat"), data.get("lon")],
                    }
        except Exception as exc:
            logger.debug(f"Geolocation lookup failed: {exc}")
        
        return None
    
    def _get_last_hash(self) -> str | None:
        """Get the hash of the most recent audit log entry."""
        if self._last_hash:
            return self._last_hash
        
        try:
            with get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT current_hash FROM audit_logs
                        ORDER BY timestamp DESC
                        LIMIT 1
                    """)
                    result = cur.fetchone()
                    if result:
                        self._last_hash = result[0]
                        return self._last_hash
        except Exception as exc:
            logger.warning(f"Failed to get last hash: {exc}")
        
        return None
    
    def _calculate_hash(self, log_entry: dict) -> str:
        """Calculate SHA-256 hash of log entry."""
        # Create deterministic string representation
        hash_content = json.dumps(log_entry, sort_keys=True)
        return hashlib.sha256(hash_content.encode()).hexdigest()
    
    def _store_log(self, log_entry: dict) -> str:
        """Store log entry in database."""
        with get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO audit_logs (
                        timestamp, event_type, category, user_id,
                        resource_id, resource_type, action, result,
                        context, metadata, previous_hash, current_hash,
                        blockchain_tx_id
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING log_id
                """, (
                    log_entry["timestamp"],
                    log_entry["event_type"],
                    log_entry["category"],
                    log_entry["user_id"],
                    log_entry["resource_id"],
                    log_entry["resource_type"],
                    log_entry["action"],
                    log_entry["result"],
                    json.dumps(log_entry["context"]),
                    json.dumps(log_entry["metadata"]),
                    log_entry["previous_hash"],
                    log_entry["current_hash"],
                    log_entry["blockchain_tx_id"],
                ))
                result = cur.fetchone()
                return str(result[0])
    
    def _check_security_alerts(
        self,
        event_type: str,
        user_id: str | None,
        context: dict
    ) -> None:
        """Check if event triggers security alerts."""
        for rule in ALERT_RULES:
            if rule["event_type"] == event_type:
                if "threshold" in rule:
                    self._check_threshold_alert(rule, user_id)
                elif "pattern" in rule:
                    self._check_pattern_alert(rule, user_id, context)
    
    def _check_threshold_alert(self, rule: dict, user_id: str | None) -> None:
        """Check threshold-based alert rule."""
        if not user_id:
            return
        
        try:
            with get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    # Count events in time window
                    cur.execute("""
                        SELECT COUNT(*) FROM audit_logs
                        WHERE event_type = %s
                        AND user_id = %s
                        AND timestamp > NOW() - INTERVAL '%s seconds'
                    """, (
                        rule["event_type"],
                        user_id,
                        rule["time_window"]
                    ))
                    count = cur.fetchone()[0]
                    
                    if count >= rule["threshold"]:
                        self._generate_security_alert(
                            rule["rule_id"],
                            rule["name"],
                            rule["severity"],
                            user_id,
                            f"{count} {rule['event_type']} events in {rule['time_window']}s"
                        )
        except Exception as exc:
            logger.error(f"Failed to check threshold alert: {exc}")
    
    def _check_pattern_alert(
        self,
        rule: dict,
        user_id: str | None,
        context: dict
    ) -> None:
        """Check pattern-based alert rule."""
        if rule["pattern"] == "new_location":
            # Check if login from new location
            if self._is_new_location(user_id, context.get("geolocation")):
                self._generate_security_alert(
                    rule["rule_id"],
                    rule["name"],
                    rule["severity"],
                    user_id,
                    f"Login from new location: {context.get('geolocation')}"
                )
    
    def _is_new_location(self, user_id: str | None, geolocation: dict | None) -> bool:
        """Check if geolocation is new for user."""
        if not user_id or not geolocation:
            return False
        
        try:
            with get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    # Check recent login locations
                    cur.execute("""
                        SELECT DISTINCT context->>'geolocation'
                        FROM audit_logs
                        WHERE user_id = %s
                        AND event_type = 'auth.login.success'
                        AND timestamp > NOW() - INTERVAL '30 days'
                        LIMIT 10
                    """, (user_id,))
                    
                    recent_locations = [row[0] for row in cur.fetchall()]
                    current_location = json.dumps(geolocation)
                    
                    return current_location not in recent_locations
        except Exception:
            return False
    
    def _generate_security_alert(
        self,
        rule_id: str,
        name: str,
        severity: str,
        user_id: str | None,
        description: str
    ) -> None:
        """Generate a security alert."""
        logger.warning(f"Security alert: {name} - {description}")
        
        # Store alert (could be in separate table or notification system)
        # For now, log as audit event
        self.log_event(
            event_type="security.alert",
            category="security",
            action="alert_generated",
            result="success",
            user_id=user_id,
            metadata={
                "rule_id": rule_id,
                "alert_name": name,
                "severity": severity,
                "description": description,
            }
        )


# Global audit logger instance
_audit_logger = AuditLogger()


def log_audit_event(**kwargs) -> str:
    """Log an audit event (convenience function)."""
    return _audit_logger.log_event(**kwargs)


def verify_hash_chain(start_log_id: str = None, end_log_id: str = None) -> dict:
    """Verify integrity of audit log hash chain.
    
    Args:
        start_log_id: Starting log ID (optional)
        end_log_id: Ending log ID (optional)
        
    Returns:
        Verification result with any broken links
    """
    try:
        with get_postgres_connection() as conn:
            with conn.cursor() as cur:
                # Get logs in order
                query = "SELECT * FROM audit_logs ORDER BY timestamp"
                params = []
                
                if start_log_id and end_log_id:
                    query += " WHERE log_id >= %s AND log_id <= %s"
                    params = [start_log_id, end_log_id]
                
                cur.execute(query, params)
                logs = cur.fetchall()
                
                broken_links = []
                for i in range(1, len(logs)):
                    prev_log = logs[i - 1]
                    curr_log = logs[i]
                    
                    # Verify hash chain
                    if curr_log["previous_hash"] != prev_log["current_hash"]:
                        broken_links.append({
                            "log_id": curr_log["log_id"],
                            "expected_previous_hash": prev_log["current_hash"],
                            "actual_previous_hash": curr_log["previous_hash"],
                        })
                
                return {
                    "verified": len(broken_links) == 0,
                    "total_logs": len(logs),
                    "broken_links": broken_links,
                }
    except Exception as exc:
        logger.error(f"Hash chain verification failed: {exc}")
        return {"verified": False, "error": str(exc)}

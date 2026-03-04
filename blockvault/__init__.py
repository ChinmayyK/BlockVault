"""BlockVault Flask application factory with security hardening.

Security features:
- Flask-Limiter for per-endpoint rate limiting
- Restricted CORS (no wildcard in production)
- Structured JSON logging
- dev_token endpoint auto-disabled in production
"""
import logging
import os
import sys
from flask import Flask, jsonify, request as flask_request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from .core.config import load_config
from .core.db import init_db, get_client
from .core.s3 import init_s3
from .core.settings import bootstrap_settings_into_config
from .api.auth import bp as auth_bp
from .api.files import bp as files_bp
from .api.users import bp as users_bp
from .api.settings import bp as settings_bp
from .api.blockchain import bp as blockchain_bp


# ---------------------------------------------------------------------------
# Structured logging setup
# ---------------------------------------------------------------------------

def _setup_logging(app: Flask) -> None:
    """Configure structured JSON-like logging for production, standard for dev."""
    log_level = logging.DEBUG if app.config.get("DEBUG") else logging.INFO

    class StructuredFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            import json, time as _time
            entry = {
                "ts": _time.strftime("%Y-%m-%dT%H:%M:%S", _time.gmtime(record.created)),
                "level": record.levelname,
                "logger": record.name,
                "msg": record.getMessage(),
            }
            if record.exc_info and record.exc_info[1]:
                entry["exc"] = self.formatException(record.exc_info)
            return json.dumps(entry, default=str)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)
    if not app.config.get("DEBUG"):
        handler.setFormatter(StructuredFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "[%(asctime)s] %(levelname)s %(name)s: %(message)s"
        ))

    # Apply to root logger so all modules get structured output
    root = logging.getLogger()
    root.setLevel(log_level)
    root.handlers.clear()
    root.addHandler(handler)

    app.logger.handlers = root.handlers
    app.logger.setLevel(log_level)


# ---------------------------------------------------------------------------
# Rate limiter key function: prefer authenticated address, fall back to IP
# ---------------------------------------------------------------------------

def _rate_limit_key() -> str:
    """Use the authenticated wallet address if available, otherwise remote IP."""
    addr = getattr(flask_request, "address", None)
    if addr:
        return str(addr).lower()
    return get_remote_address()


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> Flask:
    app = Flask(__name__)

    cfg = load_config()
    is_production = cfg.env == "production"

    app.config.update(
        SECRET_KEY=cfg.secret_key,
        JWT_SECRET=cfg.jwt_secret,
        JWT_EXP_MINUTES=cfg.jwt_exp_minutes,
        MONGO_URI=cfg.mongo_uri,
        ENV=cfg.env,
        DEBUG=cfg.debug,
        IPFS_ENABLED=cfg.ipfs_enabled,
        IPFS_API_URL=cfg.ipfs_api_url,
        IPFS_API_TOKEN=cfg.ipfs_api_token,
        IPFS_GATEWAY_URL=cfg.ipfs_gateway_url,
        CORS_ALLOWED_ORIGINS=cfg.cors_allowed_origins,
        S3_BUCKET=cfg.s3_bucket,
        S3_REGION=cfg.s3_region,
        S3_ENDPOINT=cfg.s3_endpoint,
        S3_ACCESS_KEY=cfg.s3_access_key,
        S3_SECRET_KEY=cfg.s3_secret_key,
    )

    # -----------------------------------------------------------------
    # Structured logging
    # -----------------------------------------------------------------
    _setup_logging(app)

    # -----------------------------------------------------------------
    # Database and storage init
    # -----------------------------------------------------------------
    init_db(app)
    init_s3(app)
    with app.app_context():
        try:
            bootstrap_settings_into_config()
        except Exception as e:
            app.logger.warning("Failed to bootstrap dynamic settings: %s", e)

    # -----------------------------------------------------------------
    # CORS — restrict in production, allow all in development
    # -----------------------------------------------------------------
    allowed_origins = cfg.cors_allowed_origins
    if is_production:
        if not allowed_origins or allowed_origins.strip() in {"*", ""}:
            app.logger.warning(
                "CORS_ALLOWED_ORIGINS not set in production — "
                "defaulting to same-origin only. Set CORS_ALLOWED_ORIGINS env var."
            )
            # No wildcard in production: allow only same-origin
            cors_config = {r"/*": {"origins": []}}
        else:
            origin_list = [o.strip() for o in allowed_origins.split(",") if o.strip()]
            cors_config = {r"/*": {"origins": origin_list}}
    else:
        # Development: if origins configured use them, otherwise allow all
        if allowed_origins and allowed_origins.strip() not in {"*", ""}:
            origin_list = [o.strip() for o in allowed_origins.split(",") if o.strip()]
            cors_config = {r"/*": {"origins": origin_list}}
        else:
            cors_config = {r"/*": {"origins": "*"}}

    CORS(
        app,
        resources=cors_config,
        expose_headers=["Authorization", "Content-Type", "X-Request-ID"],
        supports_credentials=False,
    )

    # -----------------------------------------------------------------
    # Request ID middleware
    # -----------------------------------------------------------------
    import uuid

    @app.before_request
    def _inject_request_id():
        rid = flask_request.headers.get("X-Request-ID")
        if not rid:
            rid = uuid.uuid4().hex
        flask_request.request_id = rid  # type: ignore[attr-defined]

    @app.after_request
    def _propagate_request_id(response):
        rid = getattr(flask_request, "request_id", None)
        if rid:
            response.headers["X-Request-ID"] = rid
        # §9 Security headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'"
        if not app.debug:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # -----------------------------------------------------------------
    # Rate limiting (Flask-Limiter)
    # -----------------------------------------------------------------
    limiter = Limiter(
        key_func=_rate_limit_key,
        app=app,
        default_limits=["200/minute"],
        storage_uri=os.environ.get("CELERY_BROKER_URL", "memory://"),
    )

    # Auth endpoints: strict 5/min
    limiter.limit("5/minute")(auth_bp)

    # Upload (files blueprint): 10/min per user
    limiter.limit("10/minute")(files_bp)

    # -----------------------------------------------------------------
    # Standard JSON error responses
    # -----------------------------------------------------------------
    @app.errorhandler(400)
    @app.errorhandler(401)
    @app.errorhandler(403)
    @app.errorhandler(404)
    @app.errorhandler(405)
    @app.errorhandler(410)
    @app.errorhandler(413)
    @app.errorhandler(415)
    @app.errorhandler(429)  # Rate limit exceeded
    @app.errorhandler(500)
    def json_error(err):  # type: ignore
        code = getattr(err, 'code', 500)
        return jsonify({"error": getattr(err, 'description', str(err)), "code": code}), code

    # -----------------------------------------------------------------
    # Register blueprints
    # -----------------------------------------------------------------
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(files_bp, url_prefix="/files")
    app.register_blueprint(users_bp, url_prefix="/users")
    app.register_blueprint(settings_bp, url_prefix="/settings")
    app.register_blueprint(blockchain_bp, url_prefix="/blockchain")

    from .mock_cases import register_case_routes
    register_case_routes(app)

    # -----------------------------------------------------------------
    # Utility / health endpoints
    # -----------------------------------------------------------------

    @app.get('/status')
    def status():
        import time
        import requests
        ipfs_enabled = bool(app.config.get('IPFS_ENABLED'))
        anchoring_enabled = bool(app.config.get('ETH_RPC_URL') and app.config.get('ETH_PRIVATE_KEY') and app.config.get('FILE_REGISTRY_ADDRESS'))
        ipfs_available = False
        ipfs_version = None
        ipfs_error = None
        if ipfs_enabled:
            api_url = (app.config.get('IPFS_API_URL') or '').rstrip('/') or 'http://127.0.0.1:5001'
            try:
                ver_endpoint = api_url + '/api/v0/version'
                r = requests.post(ver_endpoint, timeout=2)
                if r.ok:
                    js = r.json()
                    ipfs_available = True
                    ipfs_version = js.get('Version') or js.get('version')
                else:
                    ipfs_error = f"version status {r.status_code}"
            except Exception as e:
                ipfs_error = str(e).__class__.__name__ if len(str(e)) < 120 else str(e)[:120]
        cfg_flags = {
            'ipfs_enabled': ipfs_enabled,
            'ipfs_available': ipfs_available,
            'ipfs_version': ipfs_version,
            'anchoring_enabled': anchoring_enabled,
            'ipfs_error': ipfs_error,
        }
        mode = 'off-chain'
        if ipfs_enabled and anchoring_enabled:
            mode = 'hybrid'
        elif anchoring_enabled:
            mode = 'anchored'
        elif ipfs_enabled:
            mode = 'ipfs'
        return {**cfg_flags, 'mode': mode}

    @app.get('/auth/_routes')
    def auth_routes():
        auth_rules = []
        for r in app.url_map.iter_rules():  # type: ignore
            if str(r).startswith('/auth'):
                auth_rules.append({
                    'rule': str(r),
                    'methods': sorted(m for m in r.methods if m in {'GET','POST','DELETE','PUT','PATCH'}),
                })
        return {'auth_routes': auth_rules, 'count': len(auth_rules)}

    @app.get("/health")
    def health():
        try:
            get_client().admin.command("ping")
            resp = jsonify({"status": "ok"})
            resp.headers['X-Route'] = 'health'
            return resp
        except Exception as exc:
            resp = jsonify({"status": "error", "detail": str(exc)})
            resp.headers['X-Route'] = 'health'
            return resp, 503

    @app.get("/")
    def index():
        resp = jsonify({
            "name": cfg.app_name,
            "message": "BlockVault backend running",
            "endpoints": [
                "/health",
                "/auth/get_nonce",
                "/auth/login",
                "/auth/me",
                "/files (POST upload)",
                "/files/<id> (GET download)",
                "/files (GET list)",
                "/files/<id> (DELETE)",
                "/files/<id>/verify (GET verify integrity + Merkle proof)",
                "/files/<id>/share (POST create/update share)",
                "/files/shared (GET shares received)",
                "/files/shares/outgoing (GET shares sent)",
                "/files/shares/<id> (DELETE share)",
                "/files/<id>/access (GET list cached access roles, POST record, DELETE remove)",
                "/files/<id>/status (GET async processing status)",
                "/users/profile (GET role & sharing key status)",
                "/users/public_key (POST/DELETE manage sharing key)",
                "/settings (GET current dynamic contract addresses, POST admin update)",
            ],
        })
        resp.headers['X-Route'] = 'index'
        return resp

    @app.get('/ping')
    def ping():
        r = jsonify({'pong': True})
        r.headers['X-Route'] = 'ping'
        return r

    # -----------------------------------------------------------------
    # Debug / dev endpoints — ADMIN-only and disabled in production
    # -----------------------------------------------------------------

    @app.get("/debug/files")
    def debug_files():
        if is_production:
            return {"error": "not available in production"}, 404
        from .core.security import verify_jwt, Role
        auth_header = flask_request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return {"error": "auth required"}, 401
        try:
            decoded = verify_jwt(auth_header.removeprefix("Bearer ").strip())
        except Exception:
            return {"error": "invalid token"}, 401
        from .core.db import get_db
        addr = decoded.get("sub", "").lower()
        user_doc = get_db()["users"].find_one({"address": addr})
        user_role = int(user_doc.get("role", Role.USER)) if user_doc else Role.USER
        if user_role < Role.ADMIN:
            return {"error": "admin role required"}, 403
        try:
            coll = get_db()["files"]
            docs = []
            for d in coll.find({}):
                docs.append({
                    "_id": str(d.get("_id")),
                    "owner": d.get("owner"),
                    "enc_filename": d.get("enc_filename"),
                    "created_at": d.get("created_at"),
                })
            return {"count": len(docs), "files": docs}
        except Exception as e:
            return {"error": str(e)}, 500

    @app.get("/auth/dev_token")
    def dev_token():
        # Auto-disabled in production regardless of env var
        if is_production:
            return {"error": "not available in production"}, 404
        if os.getenv("ALLOW_DEV_TOKEN", "0").lower() not in {"1", "true", "yes"}:
            return {"error": "not enabled"}, 404
        raw_address = (flask_request.args.get('address') or '').strip()
        if not raw_address:
            return {"error": "address query param required"}, 400
        from string import hexdigits
        cleaned = raw_address.lower()
        if cleaned.startswith('0x'):
            cleaned = cleaned[2:]
        if len(cleaned) != 40:
            return {"error": "invalid address length", "provided_length": len(cleaned)}, 400
        if any(c not in hexdigits for c in cleaned):
            return {"error": "address contains non-hex characters"}, 400
        address = '0x' + cleaned
        from .core.security import generate_jwt
        token = generate_jwt({"sub": address})
        return {"token": token, "address": address}

    return app

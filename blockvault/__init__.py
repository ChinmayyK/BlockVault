from flask import Flask, jsonify
import os
from flask_cors import CORS
from .core.config import load_config
from .core.db import init_db, get_client
from .core.s3 import init_s3
from .core.settings import bootstrap_settings_into_config
from .api.auth import bp as auth_bp
from .api.files import bp as files_bp
from .api.users import bp as users_bp
from .api.settings import bp as settings_bp
from .api.blockchain import bp as blockchain_bp

def create_app() -> Flask:
    app = Flask(__name__)

    cfg = load_config()
    app.config.update(
        SECRET_KEY=cfg.secret_key,
        JWT_SECRET=cfg.jwt_secret,
        JWT_EXP_MINUTES=cfg.jwt_exp_minutes,  # JWT expiration in minutes (default 60)
        MONGO_URI=cfg.mongo_uri,
        ENV=cfg.env,
        DEBUG=cfg.debug,
        IPFS_ENABLED=cfg.ipfs_enabled,
        IPFS_API_URL=cfg.ipfs_api_url,
        IPFS_API_TOKEN=cfg.ipfs_api_token,
        IPFS_GATEWAY_URL=cfg.ipfs_gateway_url,
    # On-chain access control removed; no ETH_RPC_URL needed
        CORS_ALLOWED_ORIGINS=cfg.cors_allowed_origins,
        S3_BUCKET=cfg.s3_bucket,
        S3_REGION=cfg.s3_region,
        S3_ENDPOINT=cfg.s3_endpoint,
        S3_ACCESS_KEY=cfg.s3_access_key,
        S3_SECRET_KEY=cfg.s3_secret_key,
    )

    init_db(app)
    init_s3(app)
    # Load DB-stored dynamic settings (contract overrides) after DB init
    with app.app_context():  # ensure current_app available
        try:
            bootstrap_settings_into_config()
        except Exception as e:  # non-fatal
            app.logger.warning(f"Failed to bootstrap dynamic settings: {e}")
        # On-chain sync removed
    # Enable CORS with optional origin overrides for deployment.
    allowed_origins = cfg.cors_allowed_origins or "*"
    if allowed_origins.strip() in {"*", ""}:
        cors_config = {r"/*": {"origins": "*"}}
    else:
        origin_list = [o.strip() for o in allowed_origins.split(",") if o.strip()]
        cors_config = {r"/*": {"origins": origin_list}}
    CORS(
        app,
        resources=cors_config,
        expose_headers=["Authorization", "Content-Type"],
        supports_credentials=False,
    )

    # Standard JSON error responses
    @app.errorhandler(400)
    @app.errorhandler(401)
    @app.errorhandler(403)
    @app.errorhandler(404)
    @app.errorhandler(405)
    @app.errorhandler(410)
    @app.errorhandler(413)
    @app.errorhandler(415)
    @app.errorhandler(500)
    def json_error(err):  # type: ignore
        code = getattr(err, 'code', 500)
        return jsonify({"error": getattr(err, 'description', str(err)), "code": code}), code

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(files_bp, url_prefix="/files")
    app.register_blueprint(users_bp, url_prefix="/users")
    app.register_blueprint(settings_bp, url_prefix="/settings")
    app.register_blueprint(blockchain_bp, url_prefix="/blockchain")
    
    # Register case management routes
    from .mock_cases import register_case_routes
    register_case_routes(app)

    @app.get('/status')
    def status():  # runtime capability flags for frontend label (Off-Chain / Anchored / Hybrid)
        import time
        import requests
        ipfs_enabled = bool(app.config.get('IPFS_ENABLED'))
        anchoring_enabled = bool(app.config.get('ETH_RPC_URL') and app.config.get('ETH_PRIVATE_KEY') and app.config.get('FILE_REGISTRY_ADDRESS'))
        ipfs_available = False
        ipfs_version = None
        ipfs_error = None
        if ipfs_enabled:
            api_url = (app.config.get('IPFS_API_URL') or '').rstrip('/') or 'http://127.0.0.1:5001'
            # Only attempt a very fast health probe; keep failure silent beyond response fields
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
        return {
            **cfg_flags,
            'mode': mode,
        }

    @app.get('/auth/_routes')
    def auth_routes():  # lightweight diagnostics
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
                "/files/<id>/verify (GET verify integrity)",
                "/files/<id>/share (POST create/update share)",
                "/files/shared (GET shares received)",
                "/files/shares/outgoing (GET shares sent)",
                "/files/shares/<id> (DELETE share)",
                "/files/<id>/access (GET list cached access roles, POST record, DELETE remove)",
                "/files/<id>/status (GET async processing status)",
                "/users/profile (GET role & sharing key status)",
                "/users/public_key (POST/DELETE manage sharing key)",
                "/settings (GET current dynamic contract addresses, POST admin update)",
                "/debug/files (DEV only raw listing)",
            ],
        })
        resp.headers['X-Route'] = 'index'
        return resp

    @app.get('/ping')
    def ping():
        r = jsonify({'pong': True})
        r.headers['X-Route'] = 'ping'
        return r

    @app.get("/debug/files")
    def debug_files():  # ADMIN-only dev aid
        from .core.security import verify_jwt, Role
        auth_header = __import__('flask').request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return {"error": "auth required"}, 401
        try:
            decoded = verify_jwt(auth_header.removeprefix("Bearer ").strip())
        except Exception:
            return {"error": "invalid token"}, 401
        # Check admin role
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

    # Dev-only token minting (DO NOT ENABLE IN PROD). Set ALLOW_DEV_TOKEN=1 to expose.
    @app.get("/auth/dev_token")
    def dev_token():
        if os.getenv("ALLOW_DEV_TOKEN", "0").lower() not in {"1", "true", "yes"}:
            return {"error": "not enabled"}, 404
        raw_address = ( ( __import__('flask').request.args.get('address') ) or '' ).strip()
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

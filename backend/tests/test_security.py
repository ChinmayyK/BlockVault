"""Tests for blockvault.core.security — JWT, Role, require_role."""
import time
import types
import sys
import pytest


# ---------------------------------------------------------------------------
# Minimal Flask app fixture
# ---------------------------------------------------------------------------

def _ensure_stubs():
    """Ensure stub packages exist for direct module import."""
    for name in ["blockvault", "blockvault.core", "blockvault.api"]:
        if name not in sys.modules:
            mod = types.ModuleType(name)
            mod.__path__ = []
            sys.modules[name] = mod


@pytest.fixture
def app():
    """Create a minimal Flask app with JWT config for testing security module."""
    _ensure_stubs()
    from flask import Flask
    app = Flask(__name__)
    app.config["JWT_SECRET"] = "test-secret-key-for-unit-tests"
    app.config["JWT_EXP_MINUTES"] = 60
    return app


@pytest.fixture
def security(app):
    """Import security module with app context."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "blockvault.core.security",
        "blockvault/core/security.py",
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["blockvault.core.security"] = mod
    # Need jwt available
    with app.app_context():
        spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# JWT Tests
# ---------------------------------------------------------------------------

class TestJWT:
    def test_generate_and_verify(self, app, security):
        with app.app_context():
            token = security.generate_jwt({"sub": "0xabc123"})
            decoded = security.verify_jwt(token)
            assert decoded["sub"] == "0xabc123"
            assert "iat" in decoded
            assert "exp" in decoded

    def test_expired_token(self, app, security):
        import jwt
        with app.app_context():
            payload = {
                "sub": "0xtest",
                "iat": int(time.time()) - 7200,
                "exp": int(time.time()) - 3600,
            }
            token = jwt.encode(payload, "test-secret-key-for-unit-tests", algorithm="HS256")
            with pytest.raises(jwt.ExpiredSignatureError):
                security.verify_jwt(token)

    def test_wrong_secret(self, app, security):
        import jwt
        payload = {"sub": "0xtest", "iat": int(time.time()), "exp": int(time.time()) + 3600}
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        with app.app_context():
            with pytest.raises(jwt.InvalidTokenError):
                security.verify_jwt(token)


# ---------------------------------------------------------------------------
# Role Tests
# ---------------------------------------------------------------------------

class TestRole:
    def test_role_hierarchy(self, security):
        assert security.Role.AUDITOR < security.Role.USER < security.Role.ADMIN

    def test_role_values(self, security):
        assert int(security.Role.AUDITOR) == 1
        assert int(security.Role.USER) == 2
        assert int(security.Role.ADMIN) == 3

    def test_role_name(self, security):
        assert security.role_name(security.Role.ADMIN) == "admin"
        assert security.role_name(security.Role.USER) == "user"
        assert security.role_name(security.Role.AUDITOR) == "auditor"

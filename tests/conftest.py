"""Shared pytest fixtures for BlockVault integration tests.

Provides a Flask test client backed by a disposable MongoDB test database
(via mongomock if available, or a real local MongoDB on a test db).
"""
from __future__ import annotations

import os
import sys
import time
import types
import pytest
from unittest.mock import patch, MagicMock

# ---------------------------------------------------------------------------
# Ensure package stubs so direct file-location imports work
# ---------------------------------------------------------------------------

def _ensure_stubs():
    for name in ["blockvault", "blockvault.core", "blockvault.api"]:
        if name not in sys.modules:
            mod = types.ModuleType(name)
            mod.__path__ = []
            sys.modules[name] = mod


# ---------------------------------------------------------------------------
# Flask app + test client
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def mongo_client():
    """Return a MongoClient connected to a test database.
    Uses mongomock for purely in-memory tests when available,
    otherwise falls back to a local MongoDB on `blockvault_test` db.
    """
    try:
        import mongomock
        client = mongomock.MongoClient()
    except ImportError:
        from pymongo import MongoClient
        client = MongoClient(os.environ.get("MONGO_URI", "mongodb://localhost:27017"))
    yield client
    # Cleanup
    try:
        client.drop_database("blockvault_test")
    except Exception:
        pass


@pytest.fixture()
def app(mongo_client):
    """Create a fully configured Flask app for integration testing."""
    os.environ.setdefault("SECRET_KEY", "test-secret-key")
    os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
    os.environ.setdefault("MONGO_DB", "blockvault_test")
    os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
    os.environ.setdefault("JWT_EXP_MINUTES", "60")

    # Patch get_db and get_client before importing main app
    test_db = mongo_client["blockvault_test"]
    
    with patch("blockvault.core.db.get_db", return_value=test_db), \
         patch("blockvault.core.db.get_client", return_value=mongo_client):
        from blockvault import create_app
        flask_app = create_app()
        flask_app.config["TESTING"] = True
        flask_app.config["JWT_SECRET"] = "test-jwt-secret"
        flask_app.config["JWT_EXP_MINUTES"] = 60

        yield flask_app

    # Clean up test database after each test
    for coll_name in test_db.list_collection_names():
        test_db.drop_collection(coll_name)


@pytest.fixture()
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture()
def auth_headers(app):
    """Generate valid JWT auth headers for a test wallet address."""
    _ensure_stubs()
    with app.app_context():
        from blockvault.core.security import generate_jwt
        test_address = "0x" + "a1" * 20
        token = generate_jwt({"sub": test_address})
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }, test_address


@pytest.fixture()
def auth_token_and_address(auth_headers):
    """Convenience: returns (headers, address) tuple."""
    return auth_headers

"""Tests for blockvault.core.audit — append-only event logging."""
import sys
import types
import time
import pytest


def _ensure_stubs():
    for name in ["blockvault", "blockvault.core"]:
        if name not in sys.modules:
            mod = types.ModuleType(name)
            mod.__path__ = []
            sys.modules[name] = mod


@pytest.fixture
def mock_db(monkeypatch):
    """Mock the get_db function to return an in-memory collection."""
    _ensure_stubs()

    inserted = []

    class MockCollection:
        def insert_one(self, doc):
            inserted.append(doc)
            return type("Result", (), {"inserted_id": "mock_id"})()

    class MockDB:
        def __getitem__(self, name):
            return MockCollection()

    # Create a mock db module
    db_mod = types.ModuleType("blockvault.core.db")
    db_mod.get_db = lambda: MockDB()
    sys.modules["blockvault.core.db"] = db_mod

    return inserted


@pytest.fixture
def audit(mock_db):
    """Import audit module with mocked DB."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "blockvault.core.audit",
        "blockvault/core/audit.py",
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["blockvault.core.audit"] = mod
    spec.loader.exec_module(mod)
    return mod


class TestAuditLogging:
    def test_log_event_creates_document(self, audit, mock_db):
        """log_event should insert a document into audit_events."""
        # Outside request context — user_id/ip will be None, that's fine
        audit.log_event("test_action", target_id="file123", details={"key": "value"})
        assert len(mock_db) == 1
        doc = mock_db[0]
        assert doc["action"] == "test_action"
        assert doc["target_id"] == "file123"
        assert doc["details"] == {"key": "value"}
        assert "timestamp" in doc
        assert doc["user_id"] is None  # no request context

    def test_log_event_actions(self, audit, mock_db):
        """All standard actions should be loggable."""
        actions = ["login", "upload", "download", "share", "delete", "verify"]
        for action in actions:
            audit.log_event(action)
        assert len(mock_db) == len(actions)
        logged_actions = [d["action"] for d in mock_db]
        assert logged_actions == actions

    def test_log_event_never_crashes(self, audit, monkeypatch):
        """Audit logging failures must not propagate exceptions."""
        def broken_collection():
            raise RuntimeError("DB down")

        monkeypatch.setattr(audit, "_audit_collection", broken_collection)
        # Should not raise
        audit.log_event("upload", target_id="file456")

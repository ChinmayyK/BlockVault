import pytest

from blockvault.core.config import load_config


def test_load_config_rejects_default_secret_key_in_production(monkeypatch):
    monkeypatch.setenv("FLASK_ENV", "production")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setenv("JWT_SECRET", "custom-jwt-secret")

    with pytest.raises(ValueError, match="SECRET_KEY"):
        load_config()


def test_load_config_rejects_default_jwt_secret_in_production(monkeypatch):
    monkeypatch.setenv("FLASK_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "custom-secret-key")
    monkeypatch.delenv("JWT_SECRET", raising=False)

    with pytest.raises(ValueError, match="JWT_SECRET"):
        load_config()

import pytest
from flask import json
from blockvault.core.security import generate_jwt, generate_refresh_token

def test_refresh_token_flow(client, auth_headers):
    """Test generating a refresh token, then using it to get a new access token."""
    headers, address = auth_headers
    
    # 1. Create a refresh token natively
    raw_rt = generate_refresh_token(address, device_fingerprint="pytest")
    
    # 2. Try to refresh with the valid token
    resp = client.post("/auth/refresh", json={"refresh_token": raw_rt})
    assert resp.status_code == 200
    data = resp.json
    
    assert "jwt" in data
    assert "refresh_token" in data
    # The token should be rotated
    assert data["refresh_token"] != raw_rt

def test_refresh_token_invalid(client):
    """Test that invalid refresh tokens are rejected."""
    resp = client.post("/auth/refresh", json={"refresh_token": "invalid_random_string"})
    assert resp.status_code == 401

def test_revoke_refresh_tokens(client, auth_headers):
    """Test that revoking tokens clears them from DB."""
    headers, address = auth_headers
    from blockvault.core.db import get_db

    raw_rt = generate_refresh_token(address, device_fingerprint="pytest2")
    
    db = get_db()
    # Ensure it's there
    user_doc = db["users"].find_one({"address": address})
    assert len(user_doc["refresh_tokens"]) >= 1
    
    # Revoke
    resp = client.post("/auth/revoke", headers=headers)
    assert resp.status_code == 200
    
    # Ensure it's gone
    user_doc = db["users"].find_one({"address": address})
    assert len(user_doc.get("refresh_tokens", [])) == 0

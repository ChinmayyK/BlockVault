import pytest
from flask import json
from blockvault.core.db import get_db

def test_get_notifications_empty(client, auth_headers):
    headers, address = auth_headers
    resp = client.get("/notifications", headers=headers)
    assert resp.status_code == 200
    data = resp.json
    assert data["notifications"] == []
    assert data["unread_count"] == 0

def test_create_and_get_notifications(client, auth_headers):
    headers, address = auth_headers
    
    # Manually insert a notification via core to test API fetch
    from blockvault.core.notifications import notify_file_shared
    
    # 1. Dispatch a share notification
    notify_file_shared(address, "0xOwner", "Secret.pdf", "file_123")
    
    # 2. Fetch notifications
    resp = client.get("/notifications", headers=headers)
    assert resp.status_code == 200
    data = resp.json
    
    assert data["unread_count"] == 1
    assert len(data["notifications"]) == 1
    notif = data["notifications"][0]
    
    assert notif["type"] == "file_shared"
    assert notif["read"] is False
    assert notif["title"] == "File Shared With You"
    assert "Secret.pdf" in notif["message"]

def test_mark_notification_read(client, auth_headers):
    headers, address = auth_headers
    
    from blockvault.core.notifications import create_notification
    notif = create_notification(address, "Alert", "Body")
    nid = notif["id"]
    
    # Verify unread initially
    resp = client.get("/notifications", headers=headers)
    assert resp.json["unread_count"] == 1
    
    # Mark read
    patch_resp = client.patch(f"/notifications/{nid}/read", headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json["status"] == "ok"
    
    # Verify unread is 0
    resp = client.get("/notifications", headers=headers)
    assert resp.json["unread_count"] == 0

def test_mark_all_read(client, auth_headers):
    headers, address = auth_headers
    
    from blockvault.core.notifications import create_notification
    create_notification(address, "A1", "B1")
    create_notification(address, "A2", "B2")
    
    assert client.get("/notifications", headers=headers).json["unread_count"] == 2
    
    post_resp = client.post("/notifications/read-all", headers=headers)
    assert post_resp.status_code == 200
    assert post_resp.json["modified_count"] == 2
    
    assert client.get("/notifications", headers=headers).json["unread_count"] == 0

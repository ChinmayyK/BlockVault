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
    from blockvault.core.notifications import NotificationStore
    store = NotificationStore()
    
    # 1. Dispatch a share notification
    store.dispatch_file_share(address, "file_123", "Secret.pdf", "0xOwner")
    
    # 2. Fetch notifications
    resp = client.get("/notifications", headers=headers)
    assert resp.status_code == 200
    data = resp.json
    
    assert data["unread_count"] == 1
    assert len(data["notifications"]) == 1
    notif = data["notifications"][0]
    
    assert notif["type"] == "FILE_SHARED"
    assert notif["is_read"] is False
    assert notif["title"] == "New File Shared"
    assert "Secret.pdf" in notif["message"]

def test_mark_notification_read(client, auth_headers):
    headers, address = auth_headers
    
    from blockvault.core.notifications import NotificationStore
    store = NotificationStore()
    nid = store.dispatch_system_alert(address, "Alert", "Body")
    
    # Verify unread initially
    resp = client.get("/notifications/unread-count", headers=headers)
    assert resp.json["unread_count"] == 1
    
    # Mark read
    patch_resp = client.patch(f"/notifications/{nid}/read", headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json["status"] == "ok"
    
    # Verify unread is 0
    resp = client.get("/notifications/unread-count", headers=headers)
    assert resp.json["unread_count"] == 0

def test_mark_all_read(client, auth_headers):
    headers, address = auth_headers
    
    from blockvault.core.notifications import NotificationStore
    store = NotificationStore()
    store.dispatch_system_alert(address, "A1", "B1")
    store.dispatch_system_alert(address, "A2", "B2")
    
    assert client.get("/notifications/unread-count", headers=headers).json["unread_count"] == 2
    
    post_resp = client.post("/notifications/read-all", headers=headers)
    assert post_resp.status_code == 200
    assert post_resp.json["modified_count"] == 2
    
    assert client.get("/notifications/unread-count", headers=headers).json["unread_count"] == 0

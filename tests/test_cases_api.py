"""Integration tests for the Cases API — CRUD, tasks, team, signatures.

Tests the production MongoDB-backed cases module that replaced mock_cases.
"""
from __future__ import annotations

import json
import pytest


# ---------------------------------------------------------------------------
# Case CRUD
# ---------------------------------------------------------------------------

class TestCaseCRUD:
    """Test /cases endpoints for create, read, update, delete."""

    def test_create_case(self, client, auth_headers):
        headers, address = auth_headers
        resp = client.post("/cases", headers=headers, json={
            "title": "Acme Merger",
            "description": "M&A for Acme Corp",
            "clientName": "Acme Corporation",
            "practiceArea": "corporate",
            "priority": "high",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["title"] == "Acme Merger"
        assert data["clientName"] == "Acme Corporation"
        assert data["id"]  # UUID assigned
        assert data["leadAttorney"] == address

    def test_create_case_requires_title(self, client, auth_headers):
        headers, _ = auth_headers
        resp = client.post("/cases", headers=headers, json={
            "description": "missing title",
        })
        assert resp.status_code == 400

    def test_list_cases(self, client, auth_headers):
        headers, _ = auth_headers
        # Create two cases
        client.post("/cases", headers=headers, json={"title": "Case A"})
        client.post("/cases", headers=headers, json={"title": "Case B"})
        resp = client.get("/cases", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] >= 2
        titles = [c["title"] for c in data["cases"]]
        assert "Case A" in titles
        assert "Case B" in titles

    def test_get_case(self, client, auth_headers):
        headers, _ = auth_headers
        create_resp = client.post("/cases", headers=headers, json={"title": "Fetch Me"})
        case_id = create_resp.get_json()["id"]
        resp = client.get(f"/cases/{case_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["title"] == "Fetch Me"

    def test_get_nonexistent_case(self, client, auth_headers):
        headers, _ = auth_headers
        resp = client.get("/cases/nonexistent-id", headers=headers)
        assert resp.status_code == 404

    def test_update_case(self, client, auth_headers):
        headers, _ = auth_headers
        create_resp = client.post("/cases", headers=headers, json={"title": "Original"})
        case_id = create_resp.get_json()["id"]
        resp = client.put(f"/cases/{case_id}", headers=headers, json={
            "title": "Updated Title",
            "status": "closed",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["title"] == "Updated Title"
        assert data["status"] == "closed"

    def test_delete_case(self, client, auth_headers):
        headers, _ = auth_headers
        create_resp = client.post("/cases", headers=headers, json={"title": "Delete Me"})
        case_id = create_resp.get_json()["id"]
        resp = client.delete(f"/cases/{case_id}", headers=headers)
        assert resp.status_code == 200
        # Verify deleted
        resp2 = client.get(f"/cases/{case_id}", headers=headers)
        assert resp2.status_code == 404

    def test_filter_by_status(self, client, auth_headers):
        headers, _ = auth_headers
        client.post("/cases", headers=headers, json={"title": "Active Case", "status": "active"})
        client.post("/cases", headers=headers, json={"title": "Closed Case", "status": "closed"})
        resp = client.get("/cases?status=active", headers=headers)
        data = resp.get_json()
        assert all(c["status"] == "active" for c in data["cases"])


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

class TestCaseTasks:
    """Test /cases/<id>/tasks endpoints."""

    def test_create_and_list_tasks(self, client, auth_headers):
        headers, _ = auth_headers
        create_resp = client.post("/cases", headers=headers, json={"title": "Task Case"})
        case_id = create_resp.get_json()["id"]

        # Create task
        task_resp = client.post(f"/cases/{case_id}/tasks", headers=headers, json={
            "title": "Review contract",
            "priority": "high",
            "assignedTo": "0x1234",
        })
        assert task_resp.status_code == 201
        task = task_resp.get_json()
        assert task["title"] == "Review contract"
        assert task["caseId"] == case_id

        # List tasks
        list_resp = client.get(f"/cases/{case_id}/tasks", headers=headers)
        assert list_resp.status_code == 200
        tasks = list_resp.get_json()["tasks"]
        assert len(tasks) == 1
        assert tasks[0]["title"] == "Review contract"


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------

class TestCaseTeam:
    """Test /cases/<id>/team endpoints."""

    def test_add_team_member(self, client, auth_headers):
        headers, _ = auth_headers
        create_resp = client.post("/cases", headers=headers, json={"title": "Team Case"})
        case_id = create_resp.get_json()["id"]

        member_resp = client.post(f"/cases/{case_id}/team", headers=headers, json={
            "walletAddress": "0xnewmember",
            "role": "associate",
            "name": "Jane Doe",
        })
        assert member_resp.status_code == 201
        member = member_resp.get_json()
        assert member["walletAddress"] == "0xnewmember"


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class TestCaseDashboard:
    """Test /cases/<id>/dashboard endpoint."""

    def test_dashboard(self, client, auth_headers):
        headers, _ = auth_headers
        create_resp = client.post("/cases", headers=headers, json={"title": "Dashboard Case"})
        case_id = create_resp.get_json()["id"]
        resp = client.get(f"/cases/{case_id}/dashboard", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["caseId"] == case_id
        assert "overview" in data
        assert "teamMembers" in data["overview"]


# ---------------------------------------------------------------------------
# Signature Requests
# ---------------------------------------------------------------------------

class TestSignatureRequests:
    """Test signature request endpoints."""

    def test_create_signature_request(self, client, auth_headers):
        headers, address = auth_headers
        resp = client.post("/documents/test-doc-1/request-signature", headers=headers, json={
            "documentName": "Contract.pdf",
            "signers": [{"address": "0xsigner1"}, {"address": "0xsigner2"}],
            "message": "Please sign",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["signatureRequest"]["documentId"] == "test-doc-1"
        assert data["signatureRequest"]["requestedBy"] == address
        assert len(data["signatureRequest"]["signers"]) == 2

    def test_list_sent_signature_requests(self, client, auth_headers):
        headers, address = auth_headers
        # Create a request first
        client.post("/documents/test-doc-2/request-signature", headers=headers, json={
            "documentName": "Agreement.pdf",
            "signers": [{"address": "0xsigner1"}],
        })
        resp = client.get(f"/signature-requests-sent?user_address={address}", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] >= 1

    def test_sign_document(self, client, auth_headers):
        headers, address = auth_headers
        resp = client.post("/documents/test-doc-3/sign", headers=headers, json={
            "signerAddress": address,
            "signature": "0xmocksig123",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["signature"]["status"] == "signed"

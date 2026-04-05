from __future__ import annotations

import logging
from flask import Blueprint, jsonify
from ..core.security import require_auth
from ..core.db import get_db
from datetime import datetime

logger = logging.getLogger(__name__)

bp = Blueprint("blockchain", __name__)


def _chain_of_custody_collection():
    return get_db()["chain_of_custody"]


def _transactions_collection():
    return get_db()["transactions"]


@bp.get("/chain-of-custody")
@require_auth
def get_chain_of_custody():
    """Get all chain of custody entries for the authenticated user."""
    try:
        from flask import request
        user_address = request.address  # Set by require_auth
        
        collection = _chain_of_custody_collection()
        
        # Try to get entries from database
        try:
            # Check if collection exists and has data
            if hasattr(collection, 'find'):
                entries = list(collection.find({"owner": user_address}))
                # Convert ObjectId to string
                for entry in entries:
                    if "_id" in entry:
                        entry["id"] = str(entry["_id"])
                        del entry["_id"]
                return jsonify({"entries": entries})
            else:
                return jsonify({"entries": []})
        except Exception as exc:
            logger.warning("chain-of-custody query failed: %s", exc)
            return jsonify({"entries": []})
    except Exception as e:
        return jsonify({"error": str(e), "entries": []}), 500


@bp.get("/chain-of-custody/<document_id>")
@require_auth
def get_document_chain(document_id: str):
    """Get chain of custody entries for a specific document."""
    try:
        from flask import request
        user_address = request.address
        
        collection = _chain_of_custody_collection()
        
        try:
            if hasattr(collection, 'find'):
                entries = list(collection.find({
                    "documentId": document_id,
                    "owner": user_address
                }))
                # Convert ObjectId to string
                for entry in entries:
                    if "_id" in entry:
                        entry["id"] = str(entry["_id"])
                        del entry["_id"]
                return jsonify({"entries": entries})
            else:
                return jsonify({"entries": []})
        except Exception as exc:
            logger.warning("document chain query failed: %s", exc)
            return jsonify({"entries": []})
    except Exception as e:
        return jsonify({"error": str(e), "entries": []}), 500


@bp.get("/verify/<document_hash>")
@require_auth
def verify_document(document_hash: str):
    """Verify a document by its hash."""
    try:
        from flask import request
        user_address = request.address
        
        collection = _chain_of_custody_collection()
        
        try:
            # Try to find document by hash
            if not hasattr(collection, 'find_one'):
                return jsonify({
                    "verified": False,
                    "found": False,
                    "match": False,
                    "documentHash": document_hash,
                    "documentId": None,
                    "documentName": None,
                    "message": "Document not found in blockchain records",
                    "transactions": []
                })
            
            entry = collection.find_one({"hash": document_hash})
            
            if entry:
                if "_id" in entry:
                    entry["id"] = str(entry["_id"])
                    del entry["_id"]
                
                return jsonify({
                    "verified": True,
                    "found": True,
                    "match": True,
                    "documentHash": document_hash,
                    "documentId": entry.get("documentId"),
                    "documentName": entry.get("documentName"),
                    "owner": entry.get("owner"),
                    "timestamp": entry.get("timestamp"),
                    "status": entry.get("status", "verified"),
                    "message": "Document verified successfully",
                    "transactions": []
                })
            else:
                return jsonify({
                    "verified": False,
                    "found": False,
                    "match": False,
                    "documentHash": document_hash,
                    "documentId": None,
                    "documentName": None,
                    "message": "Document not found in blockchain records",
                    "transactions": []
                })
        except Exception as exc:
            logger.warning("document verification query failed: %s", exc)
            return jsonify({
                "verified": False,
                "found": False,
                "match": False,
                "documentHash": document_hash,
                "documentId": None,
                "documentName": None,
                "message": "Unable to verify document",
                "transactions": []
            })
    except Exception as e:
        return jsonify({
            "verified": False,
            "found": False,
            "match": False,
            "documentHash": document_hash,
            "documentId": None,
            "documentName": None,
            "message": f"Verification error: {str(e)}",
            "transactions": []
        }), 500


@bp.get("/transactions")
@require_auth
def get_transactions():
    """Get all blockchain transactions for the authenticated user."""
    try:
        from flask import request
        user_address = request.address
        
        collection = _transactions_collection()
        
        try:
            if hasattr(collection, 'find'):
                transactions = list(collection.find({
                    "$or": [
                        {"from": user_address},
                        {"to": user_address}
                    ]
                }))
                # Convert ObjectId to string
                for tx in transactions:
                    if "_id" in tx:
                        tx["id"] = str(tx["_id"])
                        del tx["_id"]
                return jsonify({"transactions": transactions})
            else:
                return jsonify({"transactions": []})
        except Exception as exc:
            logger.warning("transactions query failed: %s", exc)
            return jsonify({"transactions": []})
    except Exception as e:
        return jsonify({"error": str(e), "transactions": []}), 500


@bp.get("/contract/status")
@require_auth
def get_contract_status():
    """Get smart contract status."""
    try:
        from flask import current_app
        
        # Get contract address from config
        contract_address = current_app.config.get("FILE_REGISTRY_ADDRESS", "")
        network = current_app.config.get("ETH_RPC_URL", "")
        
        # Determine network name from RPC URL
        network_name = "Unknown"
        if network:
            if "localhost" in network or "127.0.0.1" in network:
                network_name = "localhost"
            elif "sepolia" in network.lower():
                network_name = "sepolia"
            elif "goerli" in network.lower():
                network_name = "goerli"
            elif "mainnet" in network.lower():
                network_name = "mainnet"
            elif "polygon" in network.lower():
                network_name = "polygon"
        
        return jsonify({
            "contractAddress": contract_address,
            "network": network_name,
            "paused": False,
            "owner": "",
            "version": "1.0.0"
        })
    except Exception as e:
        return jsonify({
            "contractAddress": "",
            "network": "Unknown",
            "paused": False,
            "owner": "",
            "version": ""
        }), 500


@bp.get("/stats")
@require_auth
def get_stats():
    """Get blockchain statistics."""
    try:
        from flask import request
        user_address = request.address
        
        custody_collection = _chain_of_custody_collection()
        tx_collection = _transactions_collection()
        
        try:
            # Check if collections have the required methods
            if not (hasattr(custody_collection, 'distinct') and hasattr(custody_collection, 'count_documents')):
                return jsonify({
                    "totalDocuments": 0,
                    "totalTransactions": 0,
                    "chainEntries": 0,
                    "gasUsed": 0,
                    "lastActivity": datetime.now().isoformat()
                })
            
            # Count documents (unique documentIds)
            documents = custody_collection.distinct("documentId", {"owner": user_address})
            total_documents = len(documents)
            
            # Count chain entries
            chain_entries = custody_collection.count_documents({"owner": user_address})
            
            # Count transactions
            total_transactions = 0
            if hasattr(tx_collection, 'count_documents'):
                total_transactions = tx_collection.count_documents({
                    "$or": [
                        {"from": user_address},
                        {"to": user_address}
                    ]
                })
            
            # Get last activity timestamp
            last_activity = datetime.now().isoformat()
            if hasattr(custody_collection, 'find_one'):
                last_entry = custody_collection.find_one(
                    {"owner": user_address},
                    sort=[("timestamp", -1)]
                )
                if last_entry:
                    last_activity = last_entry.get("timestamp", last_activity)
                    if isinstance(last_activity, datetime):
                        last_activity = last_activity.isoformat()
                    elif not isinstance(last_activity, str):
                        last_activity = datetime.now().isoformat()
            
            # Calculate gas used (sum from transactions)
            gas_used = 0
            try:
                if hasattr(tx_collection, 'find'):
                    gas_txs = tx_collection.find({
                        "$or": [
                            {"from": user_address},
                            {"to": user_address}
                        ]
                    })
                    for tx in gas_txs:
                        gas = tx.get("gasUsed") or tx.get("gas_used") or 0
                        if isinstance(gas, (int, float)):
                            gas_used += int(gas)
            except Exception as exc:
                logger.debug("gas calculation skipped for tx: %s", exc)
            
            return jsonify({
                "totalDocuments": total_documents,
                "totalTransactions": total_transactions,
                "chainEntries": chain_entries,
                "gasUsed": gas_used,
                "lastActivity": last_activity
            })
        except Exception as exc:
            logger.warning("stats computation failed: %s", exc)
            return jsonify({
                "totalDocuments": 0,
                "totalTransactions": 0,
                "chainEntries": 0,
                "gasUsed": 0,
                "lastActivity": datetime.now().isoformat()
            })
    except Exception as e:
        return jsonify({
            "totalDocuments": 0,
            "totalTransactions": 0,
            "chainEntries": 0,
            "gasUsed": 0,
            "lastActivity": datetime.now().isoformat()
        }), 500


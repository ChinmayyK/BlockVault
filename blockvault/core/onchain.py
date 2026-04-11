from __future__ import annotations
"""Lightweight optional on-chain anchoring utilities.

This module lets the backend emit a transaction (or simulated hash) anchoring
an uploaded file's metadata (sha256, size, optional IPFS CID) to a simple
FileRegistry contract. If a contract address or RPC URL / private key are
missing, functions gracefully no-op.
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any
import os
import json
import time
import logging

from flask import current_app

logger = logging.getLogger(__name__)

try:
    from web3 import Web3  # type: ignore
except ImportError:  # backend may not have web3 installed yet
    Web3 = None  # type: ignore

# ---------------------------------------------------------------------------
# ABI loading — prefer exported JSON from Hardhat, fall back to minimal ABI
# ---------------------------------------------------------------------------

_MINIMAL_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "fileHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "size", "type": "uint256"},
            {"internalType": "string", "name": "cid", "type": "string"},
        ],
        "name": "anchorFile",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "merkleRoot", "type": "bytes32"},
            {"internalType": "uint256", "name": "fileCount", "type": "uint256"},
        ],
        "name": "anchorBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

_ABI_DIR = os.path.join(os.path.dirname(__file__), "abi")


def _load_abi(contract_name: str) -> list:
    """Load ABI from exported JSON, falling back to the minimal hardcoded ABI."""
    abi_path = os.path.join(_ABI_DIR, f"{contract_name}.json")
    if os.path.isfile(abi_path):
        try:
            with open(abi_path, "r") as f:
                abi = json.load(f)
            logger.debug("Loaded ABI from %s (%d entries)", abi_path, len(abi))
            return abi
        except Exception as exc:
            logger.warning("Failed to load ABI from %s: %s — using minimal ABI", abi_path, exc)
    return _MINIMAL_ABI


FILE_REGISTRY_ABI = _load_abi("FileRegistry")


def enabled() -> bool:
    cfg = current_app.config
    return bool(
        cfg.get("ETH_RPC_URL")
        and cfg.get("ETH_PRIVATE_KEY")
        and cfg.get("FILE_REGISTRY_ADDRESS")
        and Web3 is not None
    )


def _w3() -> Optional[Any]:  # pragma: no cover - simple accessor
    if not enabled():
        return None
    try:
        return Web3(Web3.HTTPProvider(current_app.config.get("ETH_RPC_URL")))  # type: ignore[arg-type]
    except Exception as e:
        logger.warning("web3 init failed: %s", e)
        return None


def anchor_file(hash_hex: str, size: int, cid: Optional[str]) -> Optional[str]:
    """Anchor file metadata on-chain (legacy per-file mode).

    Returns transaction hash (hex) or a simulated hash when disabled.
    """
    if not hash_hex or len(hash_hex) != 64:
        logger.debug("anchor_file: invalid hash %s", hash_hex)
        return None
    if not enabled():
        # Return deterministic pseudo-hash for traceability even when disabled
        pseudo = f"simulated::{hash_hex[:16]}::{size}"
        return pseudo
    try:
        w3 = _w3()
        if w3 is None:
            return None
        acct = w3.eth.account.from_key(current_app.config.get("ETH_PRIVATE_KEY"))  # type: ignore
        contract_addr = current_app.config.get("FILE_REGISTRY_ADDRESS")
        contract = w3.eth.contract(address=Web3.to_checksum_address(contract_addr), abi=FILE_REGISTRY_ABI)  # type: ignore
        file_hash_bytes = bytes.fromhex(hash_hex)
        # bytes32 => first 32 bytes (sha256 already 32)
        nonce = w3.eth.get_transaction_count(acct.address)
        fn_call = contract.functions.anchorFile(file_hash_bytes, int(size), cid or "")
        try:
            estimated_gas = fn_call.estimate_gas({"from": acct.address})
            gas_limit = int(estimated_gas * 1.2)  # 20% safety margin
        except Exception:
            gas_limit = 200000  # fallback
        txn = fn_call.build_transaction({
            "from": acct.address,
            "nonce": nonce,
            "gas": gas_limit,
            "maxFeePerGas": w3.to_wei('30', 'gwei'),
            "maxPriorityFeePerGas": w3.to_wei('1', 'gwei'),
            "chainId": w3.eth.chain_id,
        })
        signed = acct.sign_transaction(txn)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt_hash = tx_hash.hex()
        logger.info("Anchored file sha256=%s size=%s cid=%s tx=%s", hash_hex, size, cid, receipt_hash)
        return receipt_hash
    except Exception as e:
        logger.warning("anchor_file failed: %s", e)
        return None


def anchor_merkle_root(root_hex: str, file_count: int) -> Optional[str]:
    """Anchor a Merkle root on-chain (batch mode).

    Calls ``FileRegistry.anchorBatch(bytes32, uint256)`` with the root
    hash and the number of files in the batch.

    Returns transaction hash (hex) or a simulated hash when disabled.
    """
    if not root_hex or len(root_hex) != 64:
        logger.debug("anchor_merkle_root: invalid root %s", root_hex)
        return None
    if not enabled():
        pseudo = f"simulated::merkle::{root_hex[:16]}::{file_count}"
        return pseudo
    try:
        w3 = _w3()
        if w3 is None:
            return None
        acct = w3.eth.account.from_key(current_app.config.get("ETH_PRIVATE_KEY"))  # type: ignore
        contract_addr = current_app.config.get("FILE_REGISTRY_ADDRESS")
        contract = w3.eth.contract(address=Web3.to_checksum_address(contract_addr), abi=FILE_REGISTRY_ABI)  # type: ignore
        root_bytes = bytes.fromhex(root_hex)
        nonce = w3.eth.get_transaction_count(acct.address)
        fn_call = contract.functions.anchorBatch(root_bytes, file_count)
        try:
            estimated_gas = fn_call.estimate_gas({"from": acct.address})
            gas_limit = int(estimated_gas * 1.2)  # 20% safety margin
        except Exception:
            gas_limit = 200000  # fallback
        txn = fn_call.build_transaction({
            "from": acct.address,
            "nonce": nonce,
            "gas": gas_limit,
            "maxFeePerGas": w3.to_wei('30', 'gwei'),
            "maxPriorityFeePerGas": w3.to_wei('1', 'gwei'),
            "chainId": w3.eth.chain_id,
        })
        signed = acct.sign_transaction(txn)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt_hash = tx_hash.hex()
        logger.info("Anchored Merkle root=%s file_count=%s tx=%s", root_hex, file_count, receipt_hash)
        return receipt_hash
    except Exception as e:
        logger.warning("anchor_merkle_root failed: %s", e)
        return None


def anchor_redaction_proof(anchor_hash: str) -> Optional[str]:
    """Anchor a redaction proof commitment on-chain.

    The commitment should be hash(original_hash + redacted_hash + proof_hash).
    """
    if not anchor_hash or len(anchor_hash) != 64:
        logger.debug("anchor_redaction_proof: invalid hash %s", anchor_hash)
        return None
    # Reuse anchor_file for a simple bytes32 anchor when enabled.
    return anchor_file(anchor_hash, 0, None)

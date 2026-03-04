"""Merkle tree construction, proof generation, and verification.

Used for batch-anchoring file hashes on-chain.  Instead of one
transaction per file, the system builds a Merkle tree from all
unanchored SHA-256 hashes, anchors the root, and stores per-file
inclusion proofs.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


def _hash_pair(left: bytes, right: bytes) -> bytes:
    """Hash two 32-byte nodes together (sorted to make tree order-independent)."""
    if left > right:
        left, right = right, left
    return hashlib.sha256(left + right).digest()


def _hex_to_bytes(h: str) -> bytes:
    return bytes.fromhex(h)


def _bytes_to_hex(b: bytes) -> str:
    return b.hex()


@dataclass
class ProofStep:
    """One sibling in a Merkle inclusion proof."""
    hash: str          # hex-encoded sibling hash
    position: str      # "left" or "right"


@dataclass
class MerkleTree:
    """Balanced binary Merkle tree over SHA-256 leaf hashes.

    Odd leaf counts are handled by duplicating the last leaf.
    """

    leaves: List[str] = field(default_factory=list)
    _layers: List[List[bytes]] = field(default_factory=list, repr=False)

    @classmethod
    def build(cls, leaf_hashes: List[str]) -> "MerkleTree":
        """Construct a Merkle tree from hex-encoded SHA-256 hashes."""
        if not leaf_hashes:
            raise ValueError("Cannot build Merkle tree from empty list")

        tree = cls(leaves=list(leaf_hashes))
        layer: List[bytes] = [_hex_to_bytes(h) for h in leaf_hashes]
        tree._layers.append(layer)

        while len(layer) > 1:
            # Duplicate last element if odd count
            if len(layer) % 2 == 1:
                layer = layer + [layer[-1]]

            next_layer: List[bytes] = []
            for i in range(0, len(layer), 2):
                next_layer.append(_hash_pair(layer[i], layer[i + 1]))
            tree._layers.append(next_layer)
            layer = next_layer

        return tree

    @property
    def root(self) -> str:
        """Hex-encoded Merkle root."""
        if not self._layers:
            raise ValueError("Tree not built")
        return _bytes_to_hex(self._layers[-1][0])

    def proof(self, leaf_hex: str) -> List[ProofStep]:
        """Generate an inclusion proof for the given leaf hash.

        Returns a list of ``ProofStep`` objects (sibling hash + position)
        that, combined with the leaf, reconstruct the root.
        """
        leaf_bytes = _hex_to_bytes(leaf_hex)
        # Find index in bottom layer
        try:
            idx = self._layers[0].index(leaf_bytes)
        except ValueError:
            raise ValueError(f"Leaf {leaf_hex} not in tree")

        proof_steps: List[ProofStep] = []
        for layer in self._layers[:-1]:  # skip root layer
            # Pad layer for odd-length (same logic as build)
            working = layer if len(layer) % 2 == 0 else layer + [layer[-1]]

            if idx % 2 == 0:
                sibling_idx = idx + 1
                position = "right"
            else:
                sibling_idx = idx - 1
                position = "left"

            proof_steps.append(ProofStep(
                hash=_bytes_to_hex(working[sibling_idx]),
                position=position,
            ))
            idx //= 2

        return proof_steps

    def proof_dicts(self, leaf_hex: str) -> List[Dict[str, str]]:
        """Same as ``proof`` but returns plain dicts for JSON serialization."""
        return [{"hash": s.hash, "position": s.position} for s in self.proof(leaf_hex)]


def verify_proof(
    leaf_hex: str,
    proof: List[Dict[str, str]],
    expected_root: str,
) -> bool:
    """Verify a Merkle inclusion proof.

    Parameters
    ----------
    leaf_hex : hex-encoded SHA-256 hash of the leaf
    proof : list of ``{"hash": ..., "position": ...}`` dicts
    expected_root : hex-encoded expected Merkle root

    Returns True if the reconstructed root matches ``expected_root``.
    """
    current = _hex_to_bytes(leaf_hex)
    for step in proof:
        sibling = _hex_to_bytes(step["hash"])
        if step["position"] == "left":
            current = _hash_pair(sibling, current)
        else:
            current = _hash_pair(current, sibling)
    return _bytes_to_hex(current) == expected_root

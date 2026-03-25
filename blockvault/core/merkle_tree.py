"""Persistent Append-Only Merkle Tree Log.

This module provides an efficient Merkle Tree built over the append-only audit events.
It stores the leaf hashes in MongoDB and dynamically computes intermediate nodes up
to the Merkle Root, providing cryptographic inclusion proofs.
"""
import hashlib
from typing import List, Dict, Any

from blockvault.core.db import get_db

def _hash_pair(left: str, right: str) -> str:
    """Combine two hashes symmetrically or asymmetrically. 
    Standard Merkle Trees concatenate left and right in order.
    """
    return hashlib.sha256((left + right).encode()).hexdigest()

class MerkleLog:
    def __init__(self):
        self.coll = get_db()["merkle_state"]
        # Ensure the global singleton state document exists
        if not self.coll.find_one({"_id": "global"}):
            self.coll.insert_one({"_id": "global", "leaves": []})

    def append_leaf(self, leaf_hash: str) -> int:
        """Appends a leaf hash and returns its deterministic index.
        
        This securely links the audit event to the Merkle Tree.
        """
        result = self.coll.find_one_and_update(
            {"_id": "global"},
            {"$push": {"leaves": leaf_hash}},
            return_document=True
        )
        return len(result["leaves"]) - 1

    def get_leaves(self) -> List[str]:
        doc = self.coll.find_one({"_id": "global"})
        return doc.get("leaves", []) if doc else []

    def _build_tree(self, leaves: List[str]) -> List[List[str]]:
        """Builds the tree from the bottom (leaves) up to the root.
        
        Returns all levels to facilitate proof extraction.
        """
        if not leaves:
            return []
            
        levels = [leaves]
        current_level = list(leaves)
        
        while len(current_level) > 1:
            next_level = []
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                if i + 1 < len(current_level):
                    right = current_level[i + 1]
                    next_level.append(_hash_pair(left, right))
                else:
                    # Duplicate the last node if there's an odd number (standard strategy)
                    next_level.append(_hash_pair(left, left))
            levels.append(next_level)
            current_level = next_level
            
        return levels

    def get_root(self) -> str:
        """Calculate the overall cryptographic Root Hash of all audit events."""
        leaves = self.get_leaves()
        if not leaves:
            return hashlib.sha256(b"GENESIS").hexdigest()
        levels = self._build_tree(leaves)
        return levels[-1][0]

    def get_proof(self, index: int) -> List[Dict[str, str]]:
        """Extract a Merkle Inclusion Proof (sibling route) for a leaf index."""
        leaves = self.get_leaves()
        if index < 0 or index >= len(leaves):
            raise ValueError("Invalid leaf index")
            
        levels = self._build_tree(leaves)
        proof = []
        
        curr_idx = index
        for level in levels[:-1]: 
            # We don't need a sibling for the very top root, so stop before the last level
            is_right_child = (curr_idx % 2 == 1)
            sibling_idx = curr_idx - 1 if is_right_child else curr_idx + 1
            
            if sibling_idx < len(level):
                sibling_hash = level[sibling_idx]
            else:
                # Odd node duplication edge-case
                sibling_hash = level[curr_idx]
                
            proof.append({
                "direction": "left" if is_right_child else "right",
                "hash": sibling_hash
            })
            curr_idx //= 2
            
        return proof

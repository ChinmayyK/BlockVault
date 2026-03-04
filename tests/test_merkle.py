"""Tests for blockvault.core.merkle — MerkleTree and verify_proof."""
import hashlib
import pytest


# ---------------------------------------------------------------------------
# Import helpers — avoid triggering Flask-dependent __init__.py
# ---------------------------------------------------------------------------

def _import_merkle():
    """Direct import of merkle module without going through blockvault package."""
    import importlib.util, types, sys
    # Register a stub 'blockvault' package so the module-level import chain works
    if "blockvault" not in sys.modules:
        pkg = types.ModuleType("blockvault")
        pkg.__path__ = []
        sys.modules["blockvault"] = pkg
    if "blockvault.core" not in sys.modules:
        core = types.ModuleType("blockvault.core")
        core.__path__ = []
        sys.modules["blockvault.core"] = core

    spec = importlib.util.spec_from_file_location(
        "blockvault.core.merkle",
        "blockvault/core/merkle.py",
        submodule_search_locations=[],
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["blockvault.core.merkle"] = mod
    spec.loader.exec_module(mod)
    return mod


merkle = _import_merkle()
MerkleTree = merkle.MerkleTree
verify_proof = merkle.verify_proof


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _leaf(i: int) -> str:
    return hashlib.sha256(f"file{i}".encode()).hexdigest()


@pytest.fixture
def five_leaves():
    return [_leaf(i) for i in range(5)]


@pytest.fixture
def four_leaves():
    return [_leaf(i) for i in range(4)]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestMerkleTree:
    def test_single_leaf(self):
        leaf = _leaf(0)
        tree = MerkleTree.build([leaf])
        assert tree.root == leaf
        proof = tree.proof_dicts(leaf)
        assert verify_proof(leaf, proof, tree.root)

    def test_odd_leaf_count(self, five_leaves):
        tree = MerkleTree.build(five_leaves)
        for leaf in five_leaves:
            proof = tree.proof_dicts(leaf)
            assert verify_proof(leaf, proof, tree.root), f"Failed for {leaf[:8]}"

    def test_even_leaf_count(self, four_leaves):
        tree = MerkleTree.build(four_leaves)
        for leaf in four_leaves:
            proof = tree.proof_dicts(leaf)
            assert verify_proof(leaf, proof, tree.root), f"Failed for {leaf[:8]}"

    def test_wrong_root_fails(self, five_leaves):
        tree = MerkleTree.build(five_leaves)
        proof = tree.proof_dicts(five_leaves[0])
        assert not verify_proof(five_leaves[0], proof, "0" * 64)

    def test_wrong_leaf_fails(self, five_leaves):
        tree = MerkleTree.build(five_leaves)
        proof = tree.proof_dicts(five_leaves[0])
        fake_leaf = hashlib.sha256(b"fake").hexdigest()
        assert not verify_proof(fake_leaf, proof, tree.root)

    def test_two_leaves(self):
        leaves = [_leaf(0), _leaf(1)]
        tree = MerkleTree.build(leaves)
        for leaf in leaves:
            assert verify_proof(leaf, tree.proof_dicts(leaf), tree.root)

    def test_large_tree(self):
        leaves = [_leaf(i) for i in range(100)]
        tree = MerkleTree.build(leaves)
        # Spot check several leaves
        for i in [0, 1, 49, 50, 99]:
            proof = tree.proof_dicts(leaves[i])
            assert verify_proof(leaves[i], proof, tree.root)

    def test_deterministic(self, five_leaves):
        t1 = MerkleTree.build(five_leaves)
        t2 = MerkleTree.build(five_leaves)
        assert t1.root == t2.root

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            MerkleTree.build([])

    def test_proof_of_absent_leaf_raises(self, five_leaves):
        tree = MerkleTree.build(five_leaves)
        absent = hashlib.sha256(b"not-in-tree").hexdigest()
        with pytest.raises(ValueError):
            tree.proof_dicts(absent)

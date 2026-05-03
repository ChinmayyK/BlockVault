pragma circom 2.1.5;

include "poseidon.circom";

// Merkle root over Poseidon pairwise hashing.
template MerkleRoot(n, depth) {
    signal input leaves[n];
    signal output root;

    signal layer[depth + 1][n];
    component hashers[depth][n / 2];

    for (var i = 0; i < n; i++) {
        layer[0][i] <== leaves[i];
    }

    for (var d = 0; d < depth; d++) {
        var levelSize = n >> d;
        for (var i = 0; i < levelSize / 2; i++) {
            hashers[d][i] = Poseidon(2);
            hashers[d][i].inputs[0] <== layer[d][2 * i];
            hashers[d][i].inputs[1] <== layer[d][2 * i + 1];
            layer[d + 1][i] <== hashers[d][i].out;
        }
    }

    root <== layer[depth][0];
}

// Per-chunk redaction proof:
// - For unmasked blocks, original == redacted.
// - Chunk hashes are the Merkle roots over block values.
template ChunkRedaction(blocks, depth) {
    signal input originalHash;
    signal input redactedHash;
    signal input mask[blocks];
    signal input originalBlocks[blocks];
    signal input redactedBlocks[blocks];

    for (var i = 0; i < blocks; i++) {
        mask[i] * (mask[i] - 1) === 0;
        (1 - mask[i]) * (originalBlocks[i] - redactedBlocks[i]) === 0;
    }

    component origRoot = MerkleRoot(blocks, depth);
    component redRoot = MerkleRoot(blocks, depth);

    for (var i = 0; i < blocks; i++) {
        origRoot.leaves[i] <== originalBlocks[i];
        redRoot.leaves[i] <== redactedBlocks[i];
    }

    originalHash === origRoot.root;
    redactedHash === redRoot.root;
}

// Default parameters:
// chunkSize=4096, blockSize=16 => blocks=256, depth=8
component main {public [originalHash, redactedHash, mask]} = ChunkRedaction(256, 8);

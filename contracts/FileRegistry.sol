// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FileRegistry
 * @notice Minimal anchoring contract used by BlockVault to record an immutable
 *         tuple (sha256 hash, original size, optional IPFS CID) for uploaded files.
 *         This does NOT store plaintext or enforce access control. It is purely
 *         for public audit / timestamping.
 *
 *         A client (backend) calls anchorFile once per logical file. Re-anchoring
 *         the same hash with a different size/CID is prevented. Emitted events
 *         allow off-chain indexers to build richer metadata views.
 */
contract FileRegistry {
    struct FileMeta {
        uint256 size;     // original plaintext size in bytes
        string cid;       // optional IPFS CID (can be empty string)
        uint256 timestamp; // block timestamp when anchored
        address submitter; // msg.sender that anchored
    }

    // sha256 hash (32 bytes) => metadata
    mapping(bytes32 => FileMeta) private _files;

    event FileAnchored(bytes32 indexed fileHash, uint256 size, string cid, address indexed submitter, uint256 timestamp);

    error AlreadyAnchored();
    error ZeroHash();
    error ZeroSize();

    /**
     * @dev Anchor file metadata. Fails if hash already anchored.
     * @param fileHash sha256 of original plaintext file (32 bytes)
     * @param size Original file size in bytes (>0)
     * @param cid Optional IPFS CID string (can be empty)
     */
    function anchorFile(bytes32 fileHash, uint256 size, string calldata cid) external {
        if (fileHash == bytes32(0)) revert ZeroHash();
        if (size == 0) revert ZeroSize();
        if (_files[fileHash].timestamp != 0) revert AlreadyAnchored();
        _files[fileHash] = FileMeta({
            size: size,
            cid: cid,
            timestamp: block.timestamp,
            submitter: msg.sender
        });
        emit FileAnchored(fileHash, size, cid, msg.sender, block.timestamp);
    }

    /**
     * @dev Return stored metadata for a file hash. Returns zeros if not anchored.
     */
    function getFile(bytes32 fileHash) external view returns (FileMeta memory) {
        return _files[fileHash];
    }

    /**
     * @dev Convenience view: returns (anchored?, size, cid, timestamp, submitter).
     */
    function getFileTuple(bytes32 fileHash) external view returns (bool, uint256, string memory, uint256, address) {
        FileMeta memory m = _files[fileHash];
        if (m.timestamp == 0) return (false, 0, "", 0, address(0));
        return (true, m.size, m.cid, m.timestamp, m.submitter);
    }

    // -----------------------------------------------------------------
    // Merkle batch anchoring
    // -----------------------------------------------------------------

    struct BatchMeta {
        uint256 fileCount;
        uint256 timestamp;
        address submitter;
    }

    mapping(bytes32 => BatchMeta) private _batches;

    event BatchAnchored(bytes32 indexed merkleRoot, uint256 fileCount, address indexed submitter, uint256 timestamp);

    error BatchAlreadyAnchored();
    error ZeroRoot();
    error ZeroCount();

    /**
     * @dev Anchor a Merkle root representing a batch of file hashes.
     * @param merkleRoot  Merkle root of the SHA-256 leaf hashes
     * @param fileCount   Number of files in the batch
     */
    function anchorBatch(bytes32 merkleRoot, uint256 fileCount) external {
        if (merkleRoot == bytes32(0)) revert ZeroRoot();
        if (fileCount == 0) revert ZeroCount();
        if (_batches[merkleRoot].timestamp != 0) revert BatchAlreadyAnchored();
        _batches[merkleRoot] = BatchMeta({
            fileCount: fileCount,
            timestamp: block.timestamp,
            submitter: msg.sender
        });
        emit BatchAnchored(merkleRoot, fileCount, msg.sender, block.timestamp);
    }

    /**
     * @dev Return stored batch metadata for a Merkle root.
     */
    function getBatch(bytes32 merkleRoot) external view returns (BatchMeta memory) {
        return _batches[merkleRoot];
    }
}

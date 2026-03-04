// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FileRegistry
 * @notice Immutable anchoring contract for BlockVault.  Records (sha256, size,
 *         optional CID) tuples for uploaded files and Merkle batch roots.
 *
 *         Access control: only the deployer (owner) or explicitly authorized
 *         signers may call anchorFile / anchorBatch.  This prevents spam and
 *         economic abuse from unauthorized callers.
 */
contract FileRegistry {

    // -----------------------------------------------------------------
    // Access control
    // -----------------------------------------------------------------

    address public owner;
    mapping(address => bool) public authorizedSigners;

    error Unauthorized();

    modifier onlyAuthorized() {
        if (msg.sender != owner && !authorizedSigners[msg.sender]) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedSigners[msg.sender] = true;
    }

    function addSigner(address signer) external {
        if (msg.sender != owner) revert Unauthorized();
        authorizedSigners[signer] = true;
    }

    function removeSigner(address signer) external {
        if (msg.sender != owner) revert Unauthorized();
        authorizedSigners[signer] = false;
    }

    // -----------------------------------------------------------------
    // Per-file anchoring
    // -----------------------------------------------------------------

    struct FileMeta {
        uint256 size;
        string cid;
        uint256 timestamp;
        address submitter;
    }

    mapping(bytes32 => FileMeta) private _files;

    event FileAnchored(bytes32 indexed fileHash, uint256 size, string cid, address indexed submitter, uint256 timestamp);

    error AlreadyAnchored();
    error ZeroHash();
    error ZeroSize();

    function anchorFile(bytes32 fileHash, uint256 size, string calldata cid) external onlyAuthorized {
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

    function getFile(bytes32 fileHash) external view returns (FileMeta memory) {
        return _files[fileHash];
    }

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

    function anchorBatch(bytes32 merkleRoot, uint256 fileCount) external onlyAuthorized {
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

    function getBatch(bytes32 merkleRoot) external view returns (BatchMeta memory) {
        return _batches[merkleRoot];
    }
}

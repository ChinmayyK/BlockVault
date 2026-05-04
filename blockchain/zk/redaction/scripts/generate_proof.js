#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const snarkjs = require("snarkjs");
const circomlib = require("circomlibjs");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) {
      continue;
    }
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[name] = next;
      i += 1;
    } else {
      args[name] = true;
    }
  }
  return args;
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function toFixedHex(value) {
  let hex = value.toString(16);
  if (hex.length % 2 === 1) {
    hex = "0" + hex;
  }
  return hex.padStart(64, "0");
}

function chunkBuffer(buf, chunkSize, totalChunks) {
  const chunks = [];
  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    let chunk = buf.subarray(start, end);
    if (chunk.length < chunkSize) {
      const padded = Buffer.alloc(chunkSize);
      chunk.copy(padded);
      chunk = padded;
    }
    chunks.push(chunk);
  }
  return chunks;
}

function blocksFromChunk(chunk, blockSize) {
  const blocks = [];
  for (let i = 0; i < chunk.length; i += blockSize) {
    const block = chunk.subarray(i, i + blockSize);
    const hex = Buffer.from(block).toString("hex").padEnd(blockSize * 2, "0");
    blocks.push(BigInt("0x" + hex));
  }
  return blocks;
}

function maskBlocks(originalChunk, redactedChunk, blockSize) {
  const mask = [];
  for (let i = 0; i < originalChunk.length; i += blockSize) {
    const origBlock = originalChunk.subarray(i, i + blockSize);
    const redBlock = redactedChunk.subarray(i, i + blockSize);
    let different = 0;
    for (let j = 0; j < origBlock.length; j += 1) {
      if (origBlock[j] !== redBlock[j]) {
        different = 1;
        break;
      }
    }
    mask.push(different);
  }
  return mask;
}

function resolveWasmPath(circuitDir) {
  const candidates = [
    path.join(circuitDir, "build", "redaction.wasm"),
    path.join(circuitDir, "build", "redaction_js", "redaction.wasm"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

async function main() {
  const args = parseArgs(process.argv);
  const circuitDir = path.resolve(args["circuit-dir"] || path.join(__dirname, ".."));
  const configPath = path.join(circuitDir, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const chunkSize = parseInt(args["chunk-size"] || config.chunkSize, 10);
  const blockSize = parseInt(args["block-size"] || config.blockSize, 10);
  const outDir = path.resolve(args.out || process.cwd());
  const inputsPath = args.inputs;

  if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
    throw new Error("Invalid chunk size.");
  }
  if (!Number.isFinite(blockSize) || blockSize <= 0) {
    throw new Error("Invalid block size.");
  }
  if (chunkSize % blockSize !== 0) {
    throw new Error("chunkSize must be a multiple of blockSize.");
  }

  let inputs = null;
  if (inputsPath) {
    inputs = JSON.parse(fs.readFileSync(inputsPath, "utf-8"));
  }

  if (!inputs) {
    const originalPath = args.original;
    const redactedPath = args.redacted;
    if (!originalPath || !redactedPath) {
      throw new Error("Missing --inputs or --original/--redacted paths.");
    }
    const original = fs.readFileSync(originalPath);
    const redacted = fs.readFileSync(redactedPath);
    const maxLen = Math.max(original.length, redacted.length);
    const chunkCount = Math.ceil(maxLen / chunkSize) || 1;
    const originalChunks = chunkBuffer(original, chunkSize, chunkCount);
    const redactedChunks = chunkBuffer(redacted, chunkSize, chunkCount);

    inputs = {
      chunk_size: chunkSize,
      block_size: blockSize,
      original_length: original.length,
      redacted_length: redacted.length,
      chunks: originalChunks.map((chunk, idx) => {
        const redChunk = redactedChunks[idx];
        const blocks = blocksFromChunk(chunk, blockSize);
        const redBlocks = blocksFromChunk(redChunk, blockSize);
        const mask = maskBlocks(chunk, redChunk, blockSize);
        return {
          index: idx,
          original_blocks: blocks.map((b) => b.toString()),
          redacted_blocks: redBlocks.map((b) => b.toString()),
          mask_blocks: mask,
        };
      }),
    };
  }

  const blocksPerChunk = chunkSize / blockSize;
  const poseidon = await circomlib.buildPoseidon();
  const poseidonHash = (vals) => poseidon.F.toObject(poseidon(vals));

  function merkleRoot(leaves) {
    let level = leaves.slice();
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] !== undefined ? level[i + 1] : level[i];
        next.push(poseidonHash([left, right]));
      }
      level = next;
    }
    return level[0];
  }

  const wasmPath = resolveWasmPath(circuitDir);
  const zkeyPath = path.join(circuitDir, "build", "redaction_final.zkey");
  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    throw new Error("Missing circuit artifacts. Run scripts/setup.sh first.");
  }

  const chunkCount = (inputs.chunks || []).length;
  const totalProofs = (inputs.chunks || []).filter(c => c.mask_blocks.some(b => Number(b) === 1)).length;
  let currentProof = 0;
  const originalChunkHashes = new Array(chunkCount).fill(BigInt(0));
  const redactedChunkHashes = new Array(chunkCount).fill(BigInt(0));
  const modifiedChunks = [];

  for (const chunk of inputs.chunks || []) {
    const originalBlocks = chunk.original_blocks.map((v) => BigInt(v));
    const redactedBlocks = chunk.redacted_blocks.map((v) => BigInt(v));
    const maskBlocks = chunk.mask_blocks.map((v) => Number(v));

    if (originalBlocks.length !== blocksPerChunk || redactedBlocks.length !== blocksPerChunk) {
      throw new Error("Invalid block count for chunk.");
    }

    const originalHash = merkleRoot(originalBlocks);
    const redactedHash = merkleRoot(redactedBlocks);
    originalChunkHashes[chunk.index] = originalHash;
    redactedChunkHashes[chunk.index] = redactedHash;

    const hasMask = maskBlocks.some((b) => b === 1);
    if (!hasMask) {
      continue;
    }

    const input = {
      originalHash: originalHash.toString(),
      redactedHash: redactedHash.toString(),
      mask: maskBlocks.map((b) => b.toString()),
      originalBlocks: originalBlocks.map((b) => b.toString()),
      redactedBlocks: redactedBlocks.map((b) => b.toString()),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    currentProof += 1;
    console.log(JSON.stringify({
      progress: true,
      current: currentProof,
      total: totalProofs,
      chunk_index: chunk.index
    }));

    modifiedChunks.push({
      index: chunk.index,
      mask_blocks: maskBlocks,
      proof,
      public_signals: publicSignals,
    });
  }

  const originalRoot = merkleRoot(originalChunkHashes);
  const redactedRoot = merkleRoot(redactedChunkHashes);

  const proofPackage = {
    version: "1",
    chunk_size: chunkSize,
    block_size: blockSize,
    chunk_count: chunkCount,
    original_root: toFixedHex(BigInt(originalRoot)),
    redacted_root: toFixedHex(BigInt(redactedRoot)),
    original_chunk_hashes: originalChunkHashes.map((v) => toFixedHex(BigInt(v))),
    redacted_chunk_hashes: redactedChunkHashes.map((v) => toFixedHex(BigInt(v))),
    modified_chunks: modifiedChunks,
  };

  const proofHash = sha256(Buffer.from(JSON.stringify(proofPackage)));
  const anchorHash = sha256(Buffer.from(proofPackage.original_root + proofPackage.redacted_root + proofHash, "utf-8"));

  const metadata = {
    chunk_size: chunkSize,
    block_size: blockSize,
    chunk_count: chunkCount,
    modified_chunks: modifiedChunks.map((c) => c.index),
    original_root: proofPackage.original_root,
    redacted_root: proofPackage.redacted_root,
    proof_hash: proofHash,
    anchor_hash: anchorHash,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "proof_package.json"), JSON.stringify(proofPackage, null, 2));
  fs.writeFileSync(path.join(outDir, "metadata.json"), JSON.stringify(metadata, null, 2));
  process.stdout.write(JSON.stringify({ ok: true, metadata_path: path.join(outDir, "metadata.json") }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

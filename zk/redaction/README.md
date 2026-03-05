# ZK Redaction Proofs

This folder contains the Circom circuit and snarkjs tooling used to generate and verify
redaction proofs for BlockVault.

## Quick Start

1. Install dependencies:
```bash
cd zk/redaction
npm install
```

2. Compile circuit + generate keys:
```bash
./scripts/setup.sh
```

3. Generate proofs:
```bash
node ./scripts/generate_proof.js \
  --original /path/to/original.bin \
  --redacted /path/to/redacted.bin \
  --out /tmp/redaction-proof
```

Or use precomputed inputs (for async Celery workers):
```bash
node ./scripts/generate_proof.js \
  --inputs /tmp/redaction-inputs.json \
  --out /tmp/redaction-proof
```

4. Verify a proof (per modified chunk):
The `proof_package.json` contains `modified_chunks[]` entries with `proof` and
`public_signals`. Use those with `verify_proof.js`:
```bash
node ./scripts/verify_proof.js \
  --proof /tmp/redaction-proof/chunk-proof.json \
  --public-signals /tmp/redaction-proof/chunk-public-signals.json
```

## Outputs

`generate_proof.js` writes:
- `proof_package.json` — per-chunk proofs and document roots
- `metadata.json` — summary fields (roots, proof hash, anchor hash)

## Parameters

Defaults are defined in `zk/redaction/config.json`:
- `chunkSize`: fixed chunk size in bytes (default `4096`)
- `blockSize`: fixed block size in bytes (default `16`)
- `ptauPower`: Powers of Tau size for setup (default `12`)

The system generates **per-chunk proofs** only for modified chunks. Each chunk is
split into fixed-size blocks; the circuit enforces that unmasked blocks remain equal.
Chunk hashes are Poseidon Merkle roots over block values, and document roots are
Merkle roots over chunk hashes. Update both the circuit and `config.json` together
before re-running setup.

Hashing details:
- Chunk hash = Poseidon Merkle root over block values
- Document root = Poseidon Merkle root over chunk hashes

## Trusted Setup (Production)

Groth16 requires a trusted setup ceremony. For production deployments,
document at minimum:
- who ran the setup (names, orgs, timestamps)
- exact circuit parameters and source commit
- hardware/entropy procedure used
- how toxic waste was disposed/secured

Include the attestation alongside `build/*.zkey` and verify it in CI.

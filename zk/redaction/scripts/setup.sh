#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
PTAU_POWER="$(jq -r '.ptauPower' "$ROOT_DIR/config.json" 2>/dev/null || echo 12)"

mkdir -p "$BUILD_DIR"

if ! command -v circom >/dev/null 2>&1; then
  echo "circom not found on PATH. Install circom to compile the circuit." >&2
  exit 1
fi

if [ ! -x "$ROOT_DIR/node_modules/.bin/snarkjs" ]; then
  echo "snarkjs not installed. Run 'npm install' in $ROOT_DIR." >&2
  exit 1
fi

echo "Compiling circuit..."
circom "$ROOT_DIR/circuits/redaction.circom" \
  --r1cs --wasm --sym \
  -l "$ROOT_DIR/node_modules/circomlib/circuits" \
  -o "$BUILD_DIR"

POT0="$BUILD_DIR/pot${PTAU_POWER}_0000.ptau"
POT1="$BUILD_DIR/pot${PTAU_POWER}_0001.ptau"
POT_FINAL="$BUILD_DIR/pot${PTAU_POWER}_final.ptau"

if [ ! -f "$POT_FINAL" ]; then
  echo "Generating Powers of Tau..."
  "$ROOT_DIR/node_modules/.bin/snarkjs" powersoftau new bn128 "$PTAU_POWER" "$POT0" -v
  "$ROOT_DIR/node_modules/.bin/snarkjs" powersoftau contribute "$POT0" "$POT1" \
    --name="blockvault-redaction" -e="blockvault-redaction"
  "$ROOT_DIR/node_modules/.bin/snarkjs" powersoftau prepare phase2 "$POT1" "$POT_FINAL" -v
fi

echo "Creating Groth16 setup..."
"$ROOT_DIR/node_modules/.bin/snarkjs" groth16 setup \
  "$BUILD_DIR/redaction.r1cs" \
  "$POT_FINAL" \
  "$BUILD_DIR/redaction_0000.zkey"

"$ROOT_DIR/node_modules/.bin/snarkjs" zkey contribute \
  "$BUILD_DIR/redaction_0000.zkey" \
  "$BUILD_DIR/redaction_final.zkey" \
  --name="blockvault-redaction" -e="blockvault-redaction"

"$ROOT_DIR/node_modules/.bin/snarkjs" zkey export verificationkey \
  "$BUILD_DIR/redaction_final.zkey" \
  "$BUILD_DIR/verification_key.json"

echo "Done. Artifacts in $BUILD_DIR"

#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

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

async function main() {
  const args = parseArgs(process.argv);
  const circuitDir = path.resolve(args["circuit-dir"] || path.join(__dirname, ".."));
  const proofPath = args.proof;
  const publicPath = args["public-signals"];
  const vkeyPath = args.vkey || path.join(circuitDir, "build", "verification_key.json");

  if (!proofPath || !publicPath) {
    throw new Error("Missing --proof or --public-signals path.");
  }
  const proof = JSON.parse(fs.readFileSync(proofPath, "utf-8"));
  const publicSignals = JSON.parse(fs.readFileSync(publicPath, "utf-8"));
  const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf-8"));

  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  process.stdout.write(JSON.stringify({ valid }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

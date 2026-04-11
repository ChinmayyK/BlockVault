/**
 * Export compiled ABIs to the backend for dynamic loading.
 *
 * Run after `npx hardhat compile`:
 *   npx hardhat run scripts/export-abi.ts
 */
import * as fs from "fs";
import * as path from "path";

const CONTRACTS = ["FileRegistry"];
const BACKEND_ABI_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "blockvault",
  "core",
  "abi"
);

async function main() {
  console.log("Exporting ABIs to backend...\n");

  if (!fs.existsSync(BACKEND_ABI_DIR)) {
    fs.mkdirSync(BACKEND_ABI_DIR, { recursive: true });
  }

  for (const name of CONTRACTS) {
    const artifactPath = path.join(
      __dirname,
      "..",
      "artifacts",
      `${name}.sol`,
      `${name}.json`
    );

    if (!fs.existsSync(artifactPath)) {
      console.warn(`⚠️  Artifact not found for ${name}. Run 'npx hardhat compile' first.`);
      continue;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const abi = artifact.abi;
    const outPath = path.join(BACKEND_ABI_DIR, `${name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(abi, null, 2));
    console.log(`✅ ${name}.json → ${outPath} (${abi.length} entries)`);
  }

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Export failed:", error);
    process.exit(1);
  });

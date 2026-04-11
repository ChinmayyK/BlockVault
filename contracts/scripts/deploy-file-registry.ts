import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("BlockVault — FileRegistry Deployment");
  console.log("=".repeat(60));
  console.log(`Network:  ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
  console.log("-".repeat(60));

  // Deploy FileRegistry
  const FileRegistry = await ethers.getContractFactory("FileRegistry");
  const fileRegistry = await FileRegistry.deploy();
  await fileRegistry.waitForDeployment();

  const address = await fileRegistry.getAddress();
  console.log(`✅ FileRegistry deployed to: ${address}`);

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentInfo = {
    contract: "FileRegistry",
    address,
    deployer: deployer.address,
    network: network.name,
    chainId: Number(network.chainId),
    timestamp: new Date().toISOString(),
    txHash: fileRegistry.deploymentTransaction()?.hash || "",
  };

  const filePath = path.join(
    deploymentsDir,
    `${network.name || "unknown"}.json`
  );

  // Merge with existing deployments for this network
  let existing: Record<string, any> = {};
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  existing["FileRegistry"] = deploymentInfo;

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
  console.log(`📄 Deployment info saved to: ${filePath}`);
  console.log("=".repeat(60));

  // Verify on Etherscan if not local
  if (
    network.name !== "hardhat" &&
    network.name !== "localhost" &&
    process.env.ETHERSCAN_API_KEY
  ) {
    console.log("⏳ Waiting for block confirmations before verification...");
    const tx = fileRegistry.deploymentTransaction();
    if (tx) {
      await tx.wait(5);
    }

    try {
      const { run } = await import("hardhat");
      await run("verify:verify", {
        address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan");
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log("ℹ️  Contract already verified");
      } else {
        console.warn("⚠️  Verification failed:", err.message);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

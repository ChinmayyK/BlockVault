import { expect } from "chai";
import { ethers } from "hardhat";
import { FileRegistry } from "../typechain-types";

describe("FileRegistry", function () {
  let registry: FileRegistry;
  let owner: any;
  let alice: any;
  let bob: any;

  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("sample-file-content"));
  const SAMPLE_CID = "bafybeihdwdcefgh4dqkjv67uzcmw7oj";
  const SAMPLE_SIZE = 1024;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FileRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  // -------------------------------------------------------------------
  // Access Control
  // -------------------------------------------------------------------

  describe("Access Control", function () {
    it("should set deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should authorize the owner by default", async function () {
      expect(await registry.authorizedSigners(owner.address)).to.be.true;
    });

    it("should allow owner to add a signer", async function () {
      await registry.addSigner(alice.address);
      expect(await registry.authorizedSigners(alice.address)).to.be.true;
    });

    it("should allow owner to remove a signer", async function () {
      await registry.addSigner(alice.address);
      await registry.removeSigner(alice.address);
      expect(await registry.authorizedSigners(alice.address)).to.be.false;
    });

    it("should reject addSigner from non-owner", async function () {
      await expect(
        registry.connect(alice).addSigner(bob.address)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });

  // -------------------------------------------------------------------
  // File Anchoring
  // -------------------------------------------------------------------

  describe("anchorFile", function () {
    it("should anchor a file and emit event", async function () {
      const tx = await registry.anchorFile(SAMPLE_HASH, SAMPLE_SIZE, SAMPLE_CID);
      await expect(tx)
        .to.emit(registry, "FileAnchored")
        .withArgs(
          SAMPLE_HASH,
          SAMPLE_SIZE,
          SAMPLE_CID,
          owner.address,
          (await ethers.provider.getBlock("latest"))!.timestamp
        );
    });

    it("should store file metadata correctly", async function () {
      await registry.anchorFile(SAMPLE_HASH, SAMPLE_SIZE, SAMPLE_CID);
      const meta = await registry.getFile(SAMPLE_HASH);
      expect(meta.size).to.equal(SAMPLE_SIZE);
      expect(meta.cid).to.equal(SAMPLE_CID);
      expect(meta.submitter).to.equal(owner.address);
      expect(meta.timestamp).to.be.greaterThan(0);
    });

    it("should return correct tuple via getFileTuple", async function () {
      await registry.anchorFile(SAMPLE_HASH, SAMPLE_SIZE, SAMPLE_CID);
      const [exists, size, cid, timestamp, submitter] =
        await registry.getFileTuple(SAMPLE_HASH);
      expect(exists).to.be.true;
      expect(size).to.equal(SAMPLE_SIZE);
      expect(cid).to.equal(SAMPLE_CID);
      expect(submitter).to.equal(owner.address);
    });

    it("should return false for non-existent file", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      const [exists] = await registry.getFileTuple(fakeHash);
      expect(exists).to.be.false;
    });

    it("should reject duplicate anchoring", async function () {
      await registry.anchorFile(SAMPLE_HASH, SAMPLE_SIZE, SAMPLE_CID);
      await expect(
        registry.anchorFile(SAMPLE_HASH, SAMPLE_SIZE, SAMPLE_CID)
      ).to.be.revertedWithCustomError(registry, "AlreadyAnchored");
    });

    it("should reject zero hash", async function () {
      const ZERO = ethers.ZeroHash;
      await expect(
        registry.anchorFile(ZERO, SAMPLE_SIZE, SAMPLE_CID)
      ).to.be.revertedWithCustomError(registry, "ZeroHash");
    });

    it("should reject zero size", async function () {
      await expect(
        registry.anchorFile(SAMPLE_HASH, 0, SAMPLE_CID)
      ).to.be.revertedWithCustomError(registry, "ZeroSize");
    });

    it("should reject unauthorized caller", async function () {
      await expect(
        registry.connect(bob).anchorFile(SAMPLE_HASH, SAMPLE_SIZE, SAMPLE_CID)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("should allow authorized signer to anchor", async function () {
      await registry.addSigner(alice.address);
      await expect(
        registry.connect(alice).anchorFile(SAMPLE_HASH, SAMPLE_SIZE, SAMPLE_CID)
      ).to.emit(registry, "FileAnchored");
    });
  });

  // -------------------------------------------------------------------
  // Batch Anchoring
  // -------------------------------------------------------------------

  describe("anchorBatch", function () {
    const MERKLE_ROOT = ethers.keccak256(ethers.toUtf8Bytes("merkle-root"));
    const FILE_COUNT = 10;

    it("should anchor a batch and emit event", async function () {
      const tx = await registry.anchorBatch(MERKLE_ROOT, FILE_COUNT);
      await expect(tx)
        .to.emit(registry, "BatchAnchored")
        .withArgs(
          MERKLE_ROOT,
          FILE_COUNT,
          owner.address,
          (await ethers.provider.getBlock("latest"))!.timestamp
        );
    });

    it("should store batch metadata", async function () {
      await registry.anchorBatch(MERKLE_ROOT, FILE_COUNT);
      const batch = await registry.getBatch(MERKLE_ROOT);
      expect(batch.fileCount).to.equal(FILE_COUNT);
      expect(batch.submitter).to.equal(owner.address);
    });

    it("should reject duplicate batch root", async function () {
      await registry.anchorBatch(MERKLE_ROOT, FILE_COUNT);
      await expect(
        registry.anchorBatch(MERKLE_ROOT, FILE_COUNT)
      ).to.be.revertedWithCustomError(registry, "BatchAlreadyAnchored");
    });

    it("should reject zero root", async function () {
      await expect(
        registry.anchorBatch(ethers.ZeroHash, FILE_COUNT)
      ).to.be.revertedWithCustomError(registry, "ZeroRoot");
    });

    it("should reject zero file count", async function () {
      await expect(
        registry.anchorBatch(MERKLE_ROOT, 0)
      ).to.be.revertedWithCustomError(registry, "ZeroCount");
    });

    it("should reject unauthorized batch anchor", async function () {
      await expect(
        registry.connect(bob).anchorBatch(MERKLE_ROOT, FILE_COUNT)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });
});

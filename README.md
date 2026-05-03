# 🛡️ BlockVault

**Secure. Private. Verifiable.**

BlockVault is a state-of-the-art document management vault that leverages **End-to-End Encryption (E2EE)**, **Blockchain Anchoring**, and **Zero-Knowledge (ZK) Proofs** to ensure your sensitive documents remain private, tamper-proof, and verifiable.

---

## 🚀 Problem Statement
Secure document storage and sharing often suffer from a lack of privacy, data integrity issues, and PII (Personally Identifiable Information) exposure. Centralized solutions expose sensitive data to service providers, and verifying that a document has been correctly redacted without revealing the original sensitive content is a significant cryptographic challenge.

## ✨ About
BlockVault is a privacy-first, decentralized document management system. It provides a "trustless" vault for sensitive documents, allowing organizations to store, share, and redact content while maintaining absolute proof of integrity. By integrating blockchain for anchoring and ZK-proofs for redaction, BlockVault ensures that "what you see is what was anchored," even after sensitive data is removed.

## 💡 The Solution
BlockVault leverages a multi-layered security architecture:
*   **Browser-Side E2EE:** Documents are encrypted locally before reaching the server. Your keys, your data.
*   **ZK-Redaction Engine:** Detects and redacts PII using NLP/CV and generates cryptographic proofs that the redacted version is a valid transformation of the anchored original.
*   **Blockchain Anchoring:** Immutable file registry on Ethereum/Hardhat for proof of existence and integrity.
*   **Decentralized Storage:** Encrypted blobs are stored in high-performance S3/MinIO buckets with optional IPFS pinning for permanence.

---

## 🛠️ Key Features

- 🔐 **End-to-End Encryption:** AES-GCM encryption with PBKDF2/Argon2 key derivation.
- 🛡️ **ZK-Redaction Engine:** Intelligent PII detection for PDF and DOCX with verifiable redaction proofs.
- ⛓️ **Blockchain Anchoring:** Immutable document registration on-chain for tamper-proof auditing.
- 🌐 **Hybrid Storage:** Combines S3/MinIO speed with IPFS content-addressed permanence.
- 🏢 **Workspaces & RBAC:** Collaborative environments with granular role-based access control.
- 🕵️ **Advanced Audit Logs:** Detailed, immutable logs of every document interaction.
- 💧 **Digital Watermarking:** Dynamic, traceable watermarks applied to PDFs on-the-fly.
- ⚡ **Real-time Engine:** WebSocket-driven UI for instant updates on proof generation and status.

---

## 💻 Tech Stack

| Component | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, TypeScript, TanStack Query, Socket.io, Ethers.js |
| **Backend** | Flask (Python), Celery, MongoDB, Redis |
| **Redactor** | FastAPI, PyMuPDF, python-docx, Presidio |
| **Blockchain** | Solidity, Hardhat, Ethereum |
| **ZK Tooling** | Circom, SnarkJS, Node.js |
| **Infrastructure** | Docker, MinIO, IPFS |

---

## ⚙️ Installation

### Prerequisites
- **Docker & Docker Compose**
- **Node.js** (v18+)
- **Python 3.9+**
- **Circom** (for ZK circuit compilation)

### Quick Start
1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/ChinmayyK/BlockVault.git
    cd BlockVault
    ```

2.  **Run the Full Stack:**
    BlockVault includes a smart management script to toggle the entire local stack:
    ```bash
    chmod +x start.sh
    ./start.sh
    ```
    *This will start MongoDB, Redis, MinIO, the Backend, Frontend, Redactor, and Celery Workers.*

---

## 📖 Usage
1.  **Login:** Connect your Ethereum wallet (e.g., MetaMask) to authenticate.
2.  **Upload:** Securely upload documents; they are encrypted in your browser before being stored.
3.  **Redact:** Use the built-in redactor to remove sensitive data (PII).
4.  **Verify:** Generate a ZK-proof of the redaction to prove the document's validity without revealing the redacted data.
5.  **Share:** Grant secure access to other users via public-key re-encryption.

---

## 📂 Folder Structure
- `blockvault/` - Flask API and core security logic.
- `blockvault-frontend/` - Modern React user interface.
- `blockvault-redactor/` - FastAPI microservice for document analysis.
- `contracts/` - Solidity smart contracts for the File Registry.
- `zk/redaction/` - ZK-circuits and proof generation logic.
- `tests/` - Comprehensive integration and unit tests.

---

## 🔮 Future Improvements
- **Multi-Sig Approval:** Requirement for multiple signatures for high-stakes document access.
- **Enhanced NLP:** Transformer-based models for superior PII detection.
- **Mobile Vault:** Native mobile app for secure document viewing.
- **Batch Proofs:** Recursive SNARKs for high-volume document processing.

---

## 👤 Author
**Chinmay K.**

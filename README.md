<div align="center">

# 🔐 BlockVault

```
██████╗ ██╗      ██████╗  ██████╗██╗  ██╗    ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝    ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
██████╔╝██║     ██║   ██║██║     █████╔╝     ██║   ██║███████║██║   ██║██║     ██║   
██╔══██╗██║     ██║   ██║██║     ██╔═██╗     ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   
██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗     ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝      ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   
```

### 🚀 **The Future of Secure Document Management**

> **Enterprise-grade decentralized file storage with zero-knowledge proofs and blockchain verification**

---

<div align="center">

### ⚡ **Why BlockVault?**

| 🔒 **Privacy** | ⛓️ **Verification** | 🌐 **Decentralization** | 🛡️ **Security** |
|:---:|:---:|:---:|:---:|
| End-to-end encryption | Blockchain anchoring | IPFS storage | AES-256-GCM |
| Zero-knowledge proofs | Immutable audit trails | No single point of failure | RSA-2048 keys |
| Your keys, your data | Public verification | Distributed network | Military-grade crypto |

</div>

---

### 🎯 **Key Highlights**

<div align="left">

✨ **Complete Privacy** - Your files are encrypted before upload. Even we can't see your data.  
🔐 **Blockchain Verified** - Every document is anchored on Ethereum for immutable proof of existence.  
🌍 **Truly Decentralized** - Files stored on IPFS, not on centralized servers vulnerable to breaches.  
🔑 **You Own Your Keys** - RSA key pairs generated client-side. Private keys never leave your device.  
📝 **Smart Contracts** - Automated document workflows with on-chain verification.  
🔒 **Zero-Knowledge Proofs** - Verify document properties without revealing content.  

</div>

---

### 🛠️ **Built With**

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Ethereum](https://img.shields.io/badge/Ethereum-627EEA?style=for-the-badge&logo=ethereum&logoColor=white)](https://ethereum.org/)
[![IPFS](https://img.shields.io/badge/IPFS-65C2CB?style=for-the-badge&logo=ipfs&logoColor=white)](https://ipfs.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

---

### 🔐 **Security Features**

[![AES-256](https://img.shields.io/badge/Encryption-AES--256--GCM-brightgreen?style=flat-square)]()
[![RSA-2048](https://img.shields.io/badge/Keys-RSA--2048-blue?style=flat-square)]()
[![ZK-Proofs](https://img.shields.io/badge/Zero--Knowledge-zk--SNARKs-purple?style=flat-square)]()
[![IPFS](https://img.shields.io/badge/Storage-IPFS-orange?style=flat-square)]()
[![Blockchain](https://img.shields.io/badge/Verification-Blockchain-yellow?style=flat-square)]()

---

<div align="center">

### 🚀 **Quick Start**

```bash
# Clone the repository
git clone <repository-url>
cd blockvault_final

# Start backend
python app.py

# Start frontend
cd blockvault-frontend && npm run dev
```

**[📖 Full Installation Guide](#installation)** • **[📚 API Documentation](#api-documentation)** • **[🔧 Configuration](#configuration)**

---

**Made with ❤️ in India**

[⭐ Star on GitHub](#) • [🐛 Report Bug](#) • [💡 Request Feature](#) • [📄 License](LICENSE)

</div>

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## Overview

BlockVault is a cutting-edge decentralized document management system that combines the power of blockchain technology, IPFS (InterPlanetary File System), and zero-knowledge proofs to provide unmatched security, privacy, and verifiability for sensitive documents.

### What is BlockVault?

BlockVault enables teams and individuals to store, manage, and share documents with enterprise-grade security. Unlike traditional cloud storage solutions, BlockVault ensures that:

- **Your data is truly private** - End-to-end encryption means only you can decrypt your files
- **Your files are decentralized** - Stored on IPFS, not on a single server
- **Your documents are verifiable** - Blockchain anchoring provides immutable proof of existence
- **Your privacy is protected** - Zero-knowledge proofs allow verification without revealing content

### Problem It Solves

Traditional document management systems suffer from:
- Centralized storage vulnerable to breaches
- Lack of cryptographic guarantees
- No immutable audit trails
- Privacy concerns with third-party providers
- Limited transparency in access control

BlockVault addresses these issues by leveraging decentralized technologies and advanced cryptography.

### Target Audience

BlockVault is designed for:
- **Teams** requiring secure document collaboration
- **Individuals** seeking privacy-first file storage
- **Organizations** needing verifiable document workflows
- **Compliance-focused** entities requiring audit trails

---

## Features

### 🔐 Zero-Knowledge Encryption Ecosystem
- **AES-256-GCM** local file encryption via generated File Keys
- **RSA-2048** and Passphrase for secure key-wrapping
- **Secure Key Recovery** system using 16-character recovery codes
- Files encrypted before upload - server never sees plaintext

### 🌐 IPFS Decentralized Storage
- Files stored on IPFS network (not centralized servers)
- Content-addressed storage ensures integrity
- Automatic redundancy across IPFS nodes
- Optional IPFS gateway configuration

### ⛓️ Blockchain Verification
- Ethereum smart contracts for document anchoring
- Immutable chain of custody records
- Public verification of document hashes
- Timestamped proof of existence

### 🔒 AI-Powered ZK Redaction
- **Microsoft Presidio & PaddleOCR** for intelligent PII detection and OCR
- **zk-SNARKs (Groth16)** for cryptographic proof of valid redaction
- Verify document properties without revealing content
- Privacy-preserving compliance checks

### 👥 Decentralized Access Control
- File-level cryptographic access provisioning
- RSA-enabled revocable sharing directly to recipient wallets
- No centralized permission bypass
- Immutable audit trail for all access events

### 📝 Document Notarization
- Blockchain-anchored notarization
- Immutable timestamp and proof
- Public verification of notarized documents
- Legal-grade document authentication

### ✍️ Multi-party E-Signatures
- Request signatures from multiple parties
- Track signature status in real-time
- Blockchain-verified signature records
- Complete signature workflow management

### 📁 Case Management
- Organize documents by case/matter
- Team collaboration features
- Task and deadline tracking
- Document versioning and history

### 🔍 Blockchain Explorer
- View chain of custody for documents
- Transaction history and analytics
- Contract status and verification
- Real-time blockchain data

### 🔗 Secure File Sharing
- Share files with specific users
- Time-limited access tokens
- Revocable sharing permissions
- Encrypted sharing keys

---

## Tech Stack

### Frontend
- **React 18.3.1** - Modern UI library
- **TypeScript 5.8.3** - Type-safe development
- **Vite 5.4.19** - Fast build tool and dev server
- **TailwindCSS 3.4.17** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Ethers.js 6.0.0** - Ethereum blockchain interaction
- **IPFS HTTP Client** - IPFS network integration
- **React Router 6.30.1** - Client-side routing
- **TanStack Query 5.83.0** - Server state management

### Backend
- **Flask 3.0.0** - Python web framework
- **Python 3.9+** - Backend runtime
- **MongoDB** - Document database
- **PyMongo 4.6.0** - MongoDB driver
- **JWT (PyJWT 2.8.0)** - Authentication tokens
- **Cryptography 41.0.7** - Cryptographic operations
- **Web3.py 6.11.3** - Ethereum interaction

### Blockchain & Cryptography
- **Ethereum (EVM)** - Smart contract platform
- **Solidity ^0.8.20** - Smart contract language
- **AES-256-GCM** - Symmetric encryption
- **RSA-2048** - Asymmetric encryption
- **PBKDF2** - Key derivation
- **SHA-256** - Hashing
- **zk-SNARKs (snarkjs)** - Zero-knowledge proofs

### Storage
- **IPFS (InterPlanetary File System)** - Decentralized storage
- **MongoDB** - Metadata and user data
- **Local filesystem** - Encrypted file cache (optional)

### Development Tools
- **Rust** - Crypto library implementation
- **Cargo** - Rust package manager
- **ESLint** - JavaScript linting
- **Black** - Python code formatting
- **Pytest** - Python testing framework

---

## Architecture

### High-Level System Architecture

```
┌─────────────────┐
│   React Frontend │
│   (Vite + TS)    │
└────────┬─────────┘
         │ HTTP/REST
         │ JWT Auth
         ▼
┌─────────────────┐
│  Flask Backend  │
│   (Python API)  │
└────────┬─────────┘
         │
    ┌────┴────┬──────────┬─────────────┐
    │         │          │             │
    ▼         ▼          ▼             ▼
┌────────┐ ┌──────┐ ┌─────────┐ ┌──────────┐
│ MongoDB│ │ IPFS │ │Ethereum │ │  Rust    │
│        │ │Network│ │Network  │ │  Crypto  │
└────────┘ └──────┘ └─────────┘ └──────────┘
```

### Component Breakdown

#### Frontend (React/Vite)
- **Pages**: Dashboard, Cases, Legal Documents, Blockchain Explorer, Settings
- **Components**: File upload, Document viewer, Modals, Forms
- **Contexts**: Auth, Files, Cases, RBAC, Theme
- **Utils**: Crypto operations, API clients, ZK circuits

#### Backend API (Flask)
- **Authentication**: Wallet-based login, JWT tokens, nonce management
- **File Management**: Upload, download, encryption, IPFS integration
- **Case Management**: CRUD operations, team collaboration
- **Blockchain**: Chain of custody, transaction tracking, verification
- **Users**: Profile management, RSA key registration

#### Database (MongoDB)
- **Collections**: users, files, shares, cases, nonces, chain_of_custody, transactions
- **Indexes**: Optimized queries for address, file_id, case_id
- **Schema**: Flexible document structure for extensibility

#### IPFS Network
- **Storage**: Encrypted file chunks stored on IPFS
- **CIDs**: Content identifiers for file retrieval
- **Gateways**: Public/private IPFS gateways for access

#### Blockchain (Ethereum)
- **Smart Contracts**: FileRegistry.sol, BlockVaultLegal.sol
- **Transactions**: Document anchoring, notarization records
- **Events**: Chain of custody updates, signature events

### Data Flow

1. **File Upload & Key Wrapping**:
   - User selects file → Frontend generates random AES-256-GCM File Key
   - File is encrypted locally → File Key is wrapped with Passphrase and RSA
   - Encrypted file sent to backend → Backend uploads to IPFS
   - Backend creates unique Recovery Key → Anchor hash to blockchain

2. **File Download**:
   - User requests file → Backend retrieves from IPFS
   - Encrypted file sent to frontend → Frontend decrypts with user's key
   - File displayed/downloaded to user

3. **File Sharing**:
   - Owner creates share → RSA public key of recipient used to wrap the File Key
   - Share record created in MongoDB → Recipient receives encrypted key
   - Recipient unwraps with local RSA private key → Access granted

4. **Document Verification**:
   - User requests verification → Backend queries blockchain
   - Hash comparison performed → Verification result returned
   - Chain of custody displayed → Audit trail shown

---

## Prerequisites

Before installing BlockVault, ensure you have the following installed:

### Required
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Python 3.9+** - [Download](https://www.python.org/downloads/)
- **MongoDB 6.0+** - [Download](https://www.mongodb.com/try/download/community)
- **MetaMask** or compatible Web3 wallet - [Download](https://metamask.io/)

### Optional
- **IPFS Node** - For local IPFS (or use remote service like Pinata, Infura)
- **Rust Toolchain** - For building crypto library (cargo, rustc)
- **Git** - For version control

### System Requirements
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB free space
- **Network**: Internet connection for blockchain/IPFS access

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd blockvault_final
```

### 2. Backend Setup

#### Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### Install Dependencies

```bash
pip install -r requirements.txt
```

#### Build Rust Crypto Library

```bash
cd blockvault_crypto
cargo build --release
cd ..
```

### 3. Frontend Setup

```bash
cd blockvault-frontend
npm install
cd ..
```

### 4. MongoDB Setup

#### macOS (using Homebrew)

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Linux

```bash
# Follow MongoDB installation guide for your distribution
sudo systemctl start mongod
```

#### Windows

```bash
# Install MongoDB from official installer
# Start MongoDB service from Services panel
```

### 5. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env  # If example exists
# Or create manually
```

See [Configuration](#configuration) section for required variables.

---

## Configuration

### Backend Environment Variables

Create a `.env` file in the project root:

```env
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=your-secret-key-here-change-in-production
JWT_SECRET=your-jwt-secret-here-change-in-production
JWT_EXP_MINUTES=60

# MongoDB
MONGO_URI=mongodb://localhost:27017/blockvault

# IPFS Configuration (Optional)
IPFS_ENABLED=true
IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_API_TOKEN=your-infura-token
IPFS_GATEWAY_URL=https://ipfs.infura.io/ipfs/

# Ethereum Configuration (Optional)
ETH_RPC_URL=https://sepolia.infura.io/v3/your-project-id
ETH_PRIVATE_KEY=your-private-key-for-contract-interactions

# CORS (for production)
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Frontend Environment Variables

Create a `.env` file in `blockvault-frontend/`:

```env
# API Configuration
VITE_API_URL=http://localhost:5000

# Optional: IPFS Gateway
VITE_IPFS_GATEWAY=https://ipfs.infura.io/ipfs/

# Optional: Ethereum Network
VITE_ETH_NETWORK=sepolia
VITE_ETH_RPC_URL=https://sepolia.infura.io/v3/your-project-id
```

### MongoDB Configuration

Default connection: `mongodb://localhost:27017/blockvault`

To use a remote MongoDB instance:
```env
MONGO_URI=mongodb://username:password@host:port/database
```

### IPFS Configuration Options

**Option 1: Remote IPFS Service (Recommended for Development)**
- Use Infura IPFS, Pinata, or other IPFS gateway services
- Set `IPFS_API_URL` and `IPFS_API_TOKEN` in `.env`

**Option 2: Local IPFS Node**
- Install IPFS: `ipfs init && ipfs daemon`
- Set `IPFS_API_URL=http://localhost:5001`

**Option 3: Disable IPFS**
- Set `IPFS_ENABLED=false`
- Files will be stored locally only

### Smart Contract Deployment (Optional)

If you want to deploy your own smart contracts:

1. Compile contracts:
```bash
cd contracts
solc --abi --bin FileRegistry.sol -o build/
```

2. Deploy to network (using Hardhat, Truffle, or Remix)

3. Update contract addresses in backend settings or database

---

## Getting Started

### 1. Start MongoDB

```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or run directly
mongod --dbpath /path/to/data
```

### 2. Start Backend Server

```bash
# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Run Flask app
python app.py
```

Backend will start on `http://localhost:5000`

### 3. Start Frontend Development Server

```bash
cd blockvault-frontend
npm run dev
```

Frontend will start on `http://localhost:3000`

### 4. Connect Wallet

1. Open `http://localhost:3000` in your browser
2. Click "Connect Wallet" or "Login"
3. Select MetaMask or your Web3 wallet
4. Sign the authentication message
5. You'll be automatically logged in

### 5. First File Upload

1. Navigate to Dashboard or Files section
2. Click "Upload File" or drag-and-drop a file
3. Enter an encryption passphrase (remember this!)
4. File will be encrypted, uploaded to IPFS, and anchored on blockchain
5. View your file in the file list

### 6. Explore Features

- **Cases**: Create a case and organize documents
- **Legal Documents**: Upload and notarize documents
- **Blockchain Explorer**: View chain of custody and transactions
- **Settings**: Manage RSA keys and preferences

---

## Usage Guide

### File Management

#### Upload a File

1. Go to Dashboard or Files page
2. Click "Upload File" button
3. Select file or drag-and-drop
4. Enter encryption passphrase
5. Optionally add description/tags
6. Click "Upload"

**Note**: The passphrase is used to derive the encryption key. Store it securely - without it, files cannot be decrypted.

#### Download a File

1. Find file in file list
2. Click "Download" button
3. Enter your encryption passphrase
4. File will be decrypted and downloaded

#### Delete a File

1. Find file in file list
2. Click "Delete" button
3. Confirm deletion
4. File removed from IPFS and database

#### Share a File

1. Find file in file list
2. Click "Share" button
3. Enter recipient's Ethereum address
4. Set permissions (view, download)
5. Optionally set expiration date
6. Click "Share"

**Note**: Recipient must have registered their RSA public key in Settings.

### Document Notarization

1. Go to Legal Documents page
2. Upload a document
3. Click "Notarize" on the document
4. Confirm notarization
5. Document hash will be anchored on blockchain
6. View notarization proof in Blockchain Explorer

### Redaction with Zero-Knowledge Proofs

1. Select a document
2. Click "Redact" button
3. Select text regions to redact
4. Generate zero-knowledge proof
5. Redacted document created with proof
6. Verify redaction without revealing original content

### Signature Workflows

1. Go to Legal Documents page
2. Select a document
3. Click "Request Signature"
4. Add signer addresses
5. Set signature order (if sequential)
6. Send signature request
7. Signers receive notification
8. Track signature status
9. View completed signatures

### Case Management

#### Create a Case

1. Go to Cases page
2. Click "Create Case"
3. Fill in case details:
   - Title, description
   - Client name, matter number
   - Practice area, priority
   - Lead attorney
4. Add team members
5. Set deadlines
6. Save case

#### Add Documents to Case

1. Open a case
2. Go to Documents tab
3. Click "Add Document"
4. Upload or select existing document
5. Document linked to case

#### Manage Tasks

1. Open a case
2. Go to Tasks tab
3. Click "Add Task"
4. Set task details and assignee
5. Track task completion

### Blockchain Explorer

1. Go to Blockchain Explorer page
2. View:
   - **Chain of Custody**: Document access history
   - **Transactions**: All blockchain transactions
   - **Contract Status**: Smart contract information
   - **Statistics**: Usage analytics

### RSA Key Management

1. Go to Settings page
2. Click "Manage RSA Keys"
3. Generate new key pair (if needed)
4. Public key automatically registered on login
5. Export/backup private key (keep secure!)

---

## API Documentation

### Authentication Endpoints

#### `POST /auth/get_nonce`
Get a nonce for wallet authentication.

**Request:**
```json
{
  "address": "0x..."
}
```

**Response:**
```json
{
  "address": "0x...",
  "nonce": "random-hex-string",
  "message": "BlockVault login nonce: ..."
}
```

#### `POST /auth/login`
Authenticate with signed message.

**Request:**
```json
{
  "address": "0x...",
  "signature": "0x..."
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "address": "0x..."
}
```

#### `GET /auth/me`
Get current user information.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "address": "0x...",
  "registered": true
}
```

### File Endpoints

#### `POST /files`
Upload a new file.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: File to upload
- `passphrase`: Encryption passphrase
- `description`: Optional description

**Response:**
```json
{
  "id": "file-id",
  "name": "filename.pdf",
  "size": 12345,
  "ipfs_cid": "Qm...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### `GET /files`
List all user's files.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "files": [
    {
      "id": "file-id",
      "name": "filename.pdf",
      "size": 12345,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### `GET /files/<id>`
Download a file.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `passphrase`: Decryption passphrase

**Response:** File binary data

#### `DELETE /files/<id>`
Delete a file.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### `POST /files/<id>/share`
Share a file with another user.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request:**
```json
{
  "recipient_address": "0x...",
  "permissions": ["view", "download"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### `GET /files/shared`
Get files shared with current user.

#### `GET /files/shares/outgoing`
Get files shared by current user.

#### `DELETE /files/shares/<share_id>`
Revoke a file share.

### Case Endpoints

#### `GET /cases`
Get all cases (with optional filtering).

**Query Parameters:**
- `status`: Filter by status (comma-separated)
- `priority`: Filter by priority
- `practiceArea`: Filter by practice area

#### `POST /cases`
Create a new case.

**Request:**
```json
{
  "title": "Case Title",
  "description": "Case description",
  "clientName": "Client Name",
  "priority": "high",
  "practiceArea": "corporate"
}
```

#### `GET /cases/<id>`
Get a specific case.

#### `PUT /cases/<id>`
Update a case.

#### `DELETE /cases/<id>`
Delete a case.

### Blockchain Endpoints

#### `GET /blockchain/chain-of-custody`
Get chain of custody for all documents.

#### `GET /blockchain/chain-of-custody/<document_id>`
Get chain of custody for a specific document.

#### `GET /blockchain/verify/<document_hash>`
Verify a document hash on blockchain.

#### `GET /blockchain/transactions`
Get all blockchain transactions.

#### `GET /blockchain/contract/status`
Get smart contract status.

#### `GET /blockchain/stats`
Get blockchain statistics.

### User Endpoints

#### `GET /users/profile`
Get user profile and key status.

#### `POST /users/public_key`
Register RSA public key.

**Request:**
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

#### `DELETE /users/public_key`
Remove RSA public key.

---

## Security

### Encryption Standards

- **AES-256-GCM**: Industry-standard symmetric encryption
- **RSA-2048**: Secure key exchange
- **PBKDF2**: Key derivation with 100,000+ iterations
- **SHA-256**: Cryptographic hashing

### Zero-Knowledge Architecture

- **ZKPT**: Verify redacted content without revealing original
- **ZKML**: Privacy-preserving document analysis
- **zk-SNARKs**: Efficient proof generation and verification

### Key Management

- **User-controlled keys**: Encryption keys derived from user passphrases
- **RSA key pairs**: Generated client-side, private keys never leave device
- **JWT tokens**: Short-lived authentication tokens
- **Nonce-based auth**: Prevents replay attacks

### Best Practices

1. **Store passphrases securely**: Use a password manager
2. **Backup RSA keys**: Export and store in secure location
3. **Use strong passphrases**: Minimum 12 characters, mixed case, numbers, symbols
4. **Keep wallet secure**: Protect your Ethereum private key
5. **Regular updates**: Keep dependencies updated
6. **HTTPS in production**: Always use TLS/SSL
7. **Environment variables**: Never commit secrets to git

### Security Considerations

- **IPFS**: Files on IPFS are publicly accessible by CID (but encrypted)
- **Blockchain**: Hashes are public, but content remains encrypted
- **MongoDB**: Ensure proper authentication and network security
- **Backend**: Use strong SECRET_KEY and JWT_SECRET in production
- **Frontend**: API keys in frontend are visible to users

---

## Project Structure

```
blockvault_final/
├── app.py                      # Flask application entry point
├── requirements.txt            # Python dependencies
├── pyproject.toml             # Python project configuration
├── .env                       # Environment variables (create this)
│
├── blockvault/                # Backend package
│   ├── __init__.py           # Flask app factory
│   ├── api/                  # API blueprints
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── files.py         # File management endpoints
│   │   ├── users.py         # User management endpoints
│   │   ├── settings.py      # Settings endpoints
│   │   └── blockchain.py    # Blockchain endpoints
│   ├── core/                 # Core functionality
│   │   ├── config.py        # Configuration management
│   │   ├── db.py            # MongoDB connection
│   │   ├── security.py      # JWT and auth utilities
│   │   ├── crypto_client.py # Persistent socket client for crypto daemon
│   │   ├── ipfs.py          # IPFS integration
│   │   ├── onchain.py       # Blockchain integration
│   │   ├── rbac.py          # Role-based access control
│   │   └── settings.py      # Dynamic settings
│   └── mock_cases.py        # Case management routes
│
├── blockvault-frontend/       # Frontend application
│   ├── package.json         # Node.js dependencies
│   ├── vite.config.ts       # Vite configuration
│   ├── tsconfig.json        # TypeScript configuration
│   ├── tailwind.config.js   # TailwindCSS configuration
│   ├── public/              # Static assets
│   └── src/
│       ├── main.tsx         # Application entry point
│       ├── App.tsx          # Root component
│       ├── pages/           # Page components
│       │   ├── IndexPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── CasesPage.tsx
│       │   ├── LegalPage.tsx
│       │   ├── BlockchainPage.tsx
│       │   └── SettingsPage.tsx
│       ├── components/      # Reusable components
│       │   ├── auth/       # Authentication components
│       │   ├── case/       # Case management components
│       │   ├── legal/      # Legal document components
│       │   └── ui/         # UI primitives
│       ├── contexts/       # React contexts
│       │   ├── AuthContext.tsx
│       │   ├── FileContext.tsx
│       │   ├── CaseContext.tsx
│       │   └── RBACContext.tsx
│       ├── utils/          # Utility functions
│       │   ├── api.ts      # API client
│       │   ├── crypto.ts   # Cryptographic operations
│       │   └── zkCircuits.ts # Zero-knowledge proofs
│       ├── api/            # API service layer
│       │   └── services/
│       └── types/          # TypeScript type definitions
│
├── blockvault_crypto/        # Rust crypto library
│   ├── Cargo.toml          # Rust dependencies
│   └── src/
│       └── main.rs         # Crypto implementation
│
├── contracts/               # Smart contracts
│   ├── FileRegistry.sol    # File registry contract
│   └── BlockVaultLegal.sol # Legal document contract
│
├── Dockerfile              # Docker configuration
└── docker-compose.yml      # Docker Compose setup
```

---

## Development

### Running in Development Mode

#### Backend

```bash
# Activate virtual environment
source venv/bin/activate

# Run with auto-reload
export FLASK_ENV=development
python app.py
```

#### Frontend

```bash
cd blockvault-frontend
npm run dev
```

### Building for Production

#### Backend

```bash
# Install production dependencies
pip install -r requirements.txt

# Run with Gunicorn (recommended)
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

#### Frontend

```bash
cd blockvault-frontend
npm run build
```

Output will be in `blockvault-frontend/dist/`

### Testing

#### Backend Tests

```bash
# Run all tests
pytest

# With coverage
pytest --cov=blockvault tests/
```

#### Frontend Tests

```bash
cd blockvault-frontend
npm test
```

### Code Style

#### Python

```bash
# Format code
black blockvault/

# Lint
flake8 blockvault/

# Type check
mypy blockvault/
```

#### TypeScript

```bash
cd blockvault-frontend
npm run lint
npm run type-check
```

---

## Deployment

### Docker Deployment

#### Build and Run

```bash
# Build image
docker build -t blockvault .

# Run container
docker run -p 5000:5000 --env-file .env blockvault
```

#### Docker Compose

```bash
docker-compose up -d
```

### Production Considerations

1. **Environment Variables**: Set all required variables
2. **MongoDB**: Use managed MongoDB service (Atlas, etc.)
3. **IPFS**: Use reliable IPFS gateway service
4. **HTTPS**: Use reverse proxy (Nginx, Caddy) with SSL
5. **Secrets**: Use secret management service
6. **Monitoring**: Set up logging and monitoring
7. **Backups**: Regular database backups
8. **Scaling**: Use load balancer for multiple instances

### Environment-Specific Configuration

#### Development
- `FLASK_ENV=development`
- Local MongoDB
- Local IPFS node (optional)
- Testnet blockchain

#### Production
- `FLASK_ENV=production`
- Managed MongoDB
- Production IPFS gateway
- Mainnet blockchain (or private network)
- Strong secrets
- HTTPS enabled
- CORS restricted to your domain

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Guidelines

- Follow existing code style
- Write tests for new features
- Update documentation
- Ensure all tests pass
- Keep commits atomic and well-described

### Pull Request Process

1. Update README.md if needed
2. Update CHANGELOG.md (if exists)
3. Ensure tests pass
4. Request review from maintainers
5. Address review feedback

---

## License

[Specify your license here]

---

## Support

### Getting Help

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Email**: [Your contact email]

### Common Issues

#### MongoDB Connection Error
- Ensure MongoDB is running: `brew services list` (macOS)
- Check `MONGO_URI` in `.env`
- Verify MongoDB is accessible

#### IPFS Upload Fails
- Check `IPFS_ENABLED` is `true`
- Verify `IPFS_API_URL` and `IPFS_API_TOKEN`
- Test IPFS connection manually

#### Wallet Connection Issues
- Ensure MetaMask is installed
- Check network (should match `VITE_ETH_NETWORK`)
- Clear browser cache and try again

#### Build Errors
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear Python cache: `find . -type d -name __pycache__ -exec rm -r {} +`
- Rebuild Rust library: `cd blockvault_crypto && cargo clean && cargo build --release`

---

<div align="center">

**Built with ❤️**

[Documentation](#) • [API Reference](#api-documentation) • [Support](#support)

</div>


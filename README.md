# 🛡️ Shelby OS

> **Decentralized Storage Desktop on Shelby Network (Testnet)**

Shelby OS is a browser-based Web3 desktop interface built on Shelby Network (Aptos Testnet).
Inspired by a retro-modern Windows 95 design, Shelby OS delivers a familiar desktop-like experience directly in the browser — fully integrated with blockchain technology.

Shelby OS functions as a **fully on-chain decentralized storage system**, where files, metadata, and permissions are managed directly on a decentralized network.

---

## 🖥️ Overview

Shelby OS provides a desktop-like experience inside your browser:

* File upload panel
* ShelbyVault (file manager)
* Permission system
* Wallet-based authentication
* Retro desktop UI

---

## 🌟 Core Features

### 📦 Fully On-Chain Storage

* Upload files directly to Shelby Network (Testnet)
* No reliance on centralized servers
* File metadata and status are stored on-chain

---

### 🔐 Encryption System (Active)

* AES-GCM client-side encryption
* Keys derived from wallet signatures
* Files can be encrypted before upload

> ⚠️ Decryption system is currently under development

---

### 🔌 Wallet Integration

* Aptos Wallet Adapter
* Supported wallets:

  * Petra Wallet
  * Martian Wallet
  * Google (Keyless)

---

### 📂 ShelbyVault (File Manager)

* Upload history table
* File statuses:

  * ENCRYPTED
  * STORED
* Action system:

  * Preview
  * Copy link
  * Download
  * Delete
* Pagination and filtering

---

### 🔐 On-Chain Permission System

* Public access
* Allowlist (wallet-based)
* Time lock
* Purchasable access

> All permissions are controlled through on-chain logic

---

### 📱 Responsive Desktop UI

* Desktop
* Laptop (including smaller screens)
* Mobile

---

## 📊 Current Status

> **Testnet Phase (Fully Functional Core)**

### ✅ Completed

* Wallet connection (Petra, Martian)
* Fully on-chain file upload
* File storage and status tracking
* Encryption before upload
* On-chain permission system
* ShelbyVault file management UI

### 🚧 In Progress

* Decryption system (client-side unlock)
* Advanced file preview
* Performance optimization

---

## 🛠 Tech Stack

### Frontend

* React.js + Vite
* TypeScript
* Vanilla CSS (Windows 95-style UI)
* React Hooks

### Web3

* Aptos Testnet / Shelby Network
* Aptos Wallet Adapter
* Web Crypto API (AES-GCM)

### SDK

* `@shelby-protocol/react`
* `@shelby-protocol/sdk`

---

## 🚀 Getting Started

### Prerequisites

* Node.js v18+
* npm / yarn
* Aptos Wallet (Petra / Martian)

---

### Installation

```bash id="g7m4yk"
git clone https://github.com/your-username/shelbyos-app.git
cd shelbyos-app
npm install
npm run dev
```

---

### Environment

```env id="9g8kqz"
VITE_SHELBY_API_KEY_TESTNET=your_api_key_here
VITE_SHELBY_API_KEY_SHELBYNET=your_api_key_here
```

---

### Run

```bash id="4d4z1t"
npm run dev
```

Open:

```
http://localhost:5173
```

---

## 🧩 Roadmap

* 🔓 Decryption system (unlock encrypted files)
* 🧠 Smart file preview system
* ⚡ Performance optimization
* 🌐 Mainnet deployment

---

## 👨‍💻 Author

**0xPamanSam**
🔗 https://x.com/MrSamweb3

---

## ⚠️ Disclaimer

This project is currently running on **Shelby Network (Testnet)**.
All core features are fully functional on-chain, but additional features such as decryption are still under development.

Use for testing and exploration purposes only.

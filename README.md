# 🛡️ # Shelby OS

**The Decentralized Web3 Operating System**

Shelby OS is a premium, decentralized web-based operating system built on top of the Aptos blockchain. It provides a familiar, retro-modern interface (inspired by Windows 95) designed to bridge the gap between traditional SaaS experiences and Web3 decentralized technologies. 

With a strong focus on security, privacy, and seamless user experience, Shelby OS acts as your decentralized vault, allowing you to store, manage, and encrypt files entirely on-chain.

---

## 🌟 Key Features

*   **Decentralized Vault Storage**: Upload and manage files directly on decentralized storage protocols (Irys/Arweave/IPFS) without relying on centralized servers.
*   **Military-Grade Encrypted Storage**: Advanced 2-step client-side encryption flow using AES-GCM and keys derived directly from your Aptos Wallet Signature. Your files remain completely inaccessible to anyone without your private key.
*   **Zero-Modal Architecture**: A completely frictionless, fluid UI experience with no intrusive pop-ups or modals interrupting your workflow.
*   **On-Chain Access Control**: Set file permissions to Public, Private (Allowlist), or Purchasable. Smart contract level integrations handle access rights.
*   **Mobile-First & Fully Responsive**: Impeccable UI scaling across desktop, tablet, and mobile devices without overflowing layouts or broken components. 
*   **Live On-Chain Boot Sequence**: A dynamic startup sequence that fetches real network latency (`getLedgerInfo`), block heights, and wallet adapter states asynchronously.

---

## 🛠 Tech Stack

**Frontend & Architecture**
*   **Framework**: React.js & Vite
*   **Language**: TypeScript
*   **Styling**: Vanilla CSS (Modular, Retro-Modern Themes)
*   **State Management**: React Hooks & TanStack Query

**Web3 & Decentralization**
*   **Blockchain**: Aptos Network (Mainnet, Testnet, ShelbyNet)
*   **Wallet Integration**: Aptos Wallet Adapter (Supports Martian, Petra, etc.)
*   **Indexed Data**: Aptos GraphQL Indexer
*   **Cryptography**: Web Crypto API (AES-GCM for End-to-End Encryption)
*   **SDK**: `@shelby-protocol/react`, `@shelby-protocol/sdk`

---

## 🚀 Getting Started

Follow these steps to run Shelby OS locally on your machine.

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn
*   An Aptos-compatible Wallet browser extension (e.g., Martian Wallet)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/shelbyos-app.git
    cd shelbyos-app
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add the necessary API keys or parameters for the network indexers (if required):
    ```env
    VITE_SHELBY_API_KEY_TESTNET=your_api_key_here
    VITE_SHELBY_API_KEY_SHELBYNET=your_api_key_here
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Open the application:**
    Navigate to `http://localhost:5173` in your browser.

---

## 📊 Project Status

**Status: Production-Ready (Beta)**

The core infrastructure, including wallet integration, on-chain reading/writing, and end-to-end payload encryption, is fully functional and vetted. The application is highly stable across different viewports and is currently in its final beta phase leading up to the public mainnet release.

---
*Created by [0xPamanSam](https://x.com/MrSamweb3)*


*“The future of the decentralized web, delivered in a premium interface.”*

---
© 2026 Shelby Systems Corp. All rights reserved.

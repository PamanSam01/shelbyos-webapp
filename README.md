# 🛡️ Shelby OS: The Decentralized Web3 Operating System

A premium, modern-retro Web3 interface built for the Shelby Protocol. Experience a seamless, cinematic, and secure environment for managing your decentralized vault and on-chain assets.

## ✨ Key Features
- **Cinematic 3D Boot Sequence**: A high-fidelity, interactive network-particle introduction with a parallax depth effect and background audio.
- **Glassmorphism UI**: A sleek, modern-retro aesthetic inspired by Windows XP and Cyberpunk design systems.
- **Draggable Upload Terminal**: Real-time diagnostic logs for file encryption (Erasure Coding), authentication, and on-chain synchronization.
- **Multi-Theme Support**: Personalize your workspace with Windows XP (Default), Terminal (Matrix), or Neon Web3 themes.
- **Secure File Vault**: Encrypted file storage powered by the Shelby Network and Aptos blockchain.
- **Responsive Design**: Fully optimized for Desktop, Tablet, and Mobile viewing.

## 🚀 Getting Started (Local Host)

Follow these steps to run Shelby OS on your local machine.

### 1. Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (Version 18 or higher recommended)
- [NPM](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)

### 2. Clone the Repository
```bash
git clone https://github.com/PamanSam01/shelbyos-webapp.git
cd shelbyos-webapp
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configuration
Create a `.env` file in the root directory and add your ShelbyNet API Keys:
```env
VITE_SHELBY_API_KEY_SHELBYNET=your_api_key_here
VITE_SHELBY_API_KEY_TESTNET=optional_testnet_key_here
```
> [!NOTE]
> To obtain a ShelbyNet API key, visit the [Shelby Protocol Documentation](https://shelby-protocol.gitbook.io/).

### 5. Run the Local Server
```bash
npm run dev
```
Once started, open your browser and navigate to `http://localhost:5173`.

## 🛠️ Tech Stack
- **Framework**: React 18 + TypeScript
- **Bundler**: Vite
- **Blockchain**: Aptos SDK / TS-SDK
- **Decentralized Storage**: Shelby Protocol SDK
- **Styling**: Vanilla CSS (Modern-Retro & Glassmorphism)
- **Polyfills**: `vite-plugin-node-polyfills` for Web3 compatibility.

---
**Created by: [0xPamanSam](https://x.com/MrSamweb3)**

*“The future of the decentralized web, delivered in a premium interface.”*

---
© 2026 Shelby Systems Corp. All rights reserved.

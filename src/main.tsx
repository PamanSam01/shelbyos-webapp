import { createRoot } from "react-dom/client";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";

import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <AptosWalletAdapterProvider autoConnect={false}>
    <App />
  </AptosWalletAdapterProvider>
);

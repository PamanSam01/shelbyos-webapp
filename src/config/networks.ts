import { Network } from "@aptos-labs/ts-sdk";

export interface NetworkConfig {
  label: string;
  network: Network;
  aptosRpc: string;
  shelbyRpc: string;
  indexer: string;
  contract: string;
  faucet: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  testnet: {
    label: "Testnet",
    network: Network.TESTNET,
    aptosRpc: "https://api.testnet.aptoslabs.com/v1",
    shelbyRpc: "https://api.testnet.shelby.xyz",
    indexer: "https://api.testnet.aptoslabs.com/v1/graphql",
    contract: "0xc63d6a5efb0080a6029403131715bd4971e1149f7cc099aac69bb0069b3ddbf5",
    faucet: "https://faucet.testnet.aptoslabs.com/mint",
  },
  shelbynet: {
    label: "ShelbyNet",
    network: Network.TESTNET, // Treat as Testnet for SDK purposes
    aptosRpc: "https://api.shelbynet.shelby.xyz/v1",
    shelbyRpc: "https://api.shelbynet.shelby.xyz",
    indexer: "https://api.shelbynet.shelby.xyz/v1/graphql",
    contract: "0xe5ce920ceb6d6015ee46a83dd992e666369b12bfa9a418d0742768fc1dfaf7b2",
    faucet: "https://faucet.shelbynet.shelby.xyz/mint",
  }
};

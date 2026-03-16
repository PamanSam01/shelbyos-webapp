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
    contract: "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a",
    faucet: "https://faucet.shelbynet.shelby.xyz/mint",
  }
};

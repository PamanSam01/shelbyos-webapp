import { Network } from "@aptos-labs/ts-sdk";

export interface NetworkConfig {
  label: string;
  network: Network;
  aptosRpc: string;
  shelbyRpc: string;
  /** Aptos Indexer GraphQL (for account transactions) */
  indexer: string;
  /** Shelby Blob Indexer GraphQL (for blob listing via SDK) */
  shelbyIndexer: string;
  contract: string;
  faucet: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  testnet: {
    label: "Testnet",
    network: Network.TESTNET,
    aptosRpc: "https://api.testnet.aptoslabs.com/v1",
    shelbyRpc: "https://api.testnet.shelby.xyz/shelby",
    indexer: "https://api.testnet.aptoslabs.com/nocode/v1/public/cmlfqs5wt00qrs601zt5s4kfj/v1/graphql",
    shelbyIndexer: "https://api.testnet.aptoslabs.com/nocode/v1/public/cmlfqs5wt00qrs601zt5s4kfj/v1/graphql",
    contract: "0xc63d6a5efb0080a6029403131715bd4971e1149f7cc099aac69bb0069b3ddbf5",
    faucet: "https://faucet.testnet.aptoslabs.com/mint",
  },
  shelbynet: {
    label: "ShelbyNet",
    network: Network.TESTNET, // Treat as Testnet for SDK purposes
    aptosRpc: "https://api.shelbynet.shelby.xyz/v1",
    shelbyRpc: "https://api.shelbynet.shelby.xyz/shelby",
    indexer: "https://api.testnet.aptoslabs.com/nocode/v1/public/cmforrguw0042s601fn71f9l2/v1/graphql",
    shelbyIndexer: "https://api.testnet.aptoslabs.com/nocode/v1/public/cmforrguw0042s601fn71f9l2/v1/graphql",
    contract: "0xe5ce920ceb6d6015ee46a83dd992e666369b12bfa9a418d0742768fc1dfaf7b2",
    faucet: "https://faucet.shelbynet.shelby.xyz/mint",
  }
};

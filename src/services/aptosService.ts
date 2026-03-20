/**
 * Service for interacting with the Aptos blockchain via RPC.
 */

export interface AptosAccountResource {
  type: string;
  data: any;
}

export interface AptosTransactionResp {
  success: boolean;
  vm_status: string;
  hash: string;
  timestamp: string;
  payload?: any;
}

/**
 * Fetches the current ledger information from the RPC.
 */
export async function fetchLedgerInfo(rpcUrl: string) {
  const res = await fetch(rpcUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC error: ${text}`);
  }
  return res.json();
}

/**
 * Fetches all resources for a specific account.
 */
export async function fetchAccountResources(rpcUrl: string, address: string): Promise<AptosAccountResource[]> {
  const res = await fetch(`${rpcUrl}/accounts/${address}/resources`);
  if (!res.ok) {
    if (res.status === 404) return [];
    const text = await res.text();
    throw new Error(`Failed to fetch account resources: ${text}`);
  }
  return res.json();
}

/**
 * Checks if an account exists on-chain by querying its basic info.
 */
export async function fetchAccountInfo(rpcUrl: string, address: string) {
  const res = await fetch(`${rpcUrl}/accounts/${address}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Fetches a transaction by its hash.
 */
export async function fetchTransactionByHash(rpcUrl: string, hash: string): Promise<AptosTransactionResp | null> {
  const res = await fetch(`${rpcUrl}/transactions/by_hash/${hash}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Fetches recent transactions for an account.
 */
export async function fetchAccountTransactions(rpcUrl: string, address: string): Promise<AptosTransactionResp[]> {
  const res = await fetch(`${rpcUrl}/accounts/${address}/transactions`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch account transactions: ${text}`);
  }
  return res.json();
}



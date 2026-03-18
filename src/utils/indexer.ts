/**
 * indexer.ts — Aptos GraphQL Indexer integration for Shelby OS Vault History
 *
 * Queries the on-chain user_transactions from the Aptos GraphQL Indexer,
 * filtering for RegisterBlob contract calls belonging to the connected wallet.
 */

export interface IndexerBlob {
  id: number;
  name: string;
  ext: string;
  size: number;
  date: string;
  time: string;
  uploader: string;
  status: 'stored';
  vis: 'public';
  network: string;
  cid: string;
  txHash: string;
}

/**
 * Fetch blob history for a wallet address from the Aptos GraphQL Indexer.
 * Uses `user_transactions` (the correct Aptos Indexer root field).
 * Returns an array of IndexerBlob or throws on failure.
 */
export async function fetchBlobsFromIndexer(
  indexerUrl: string,
  walletAddress: string,
  contract: string,
  networkLabel: string,
  limit = 50
): Promise<IndexerBlob[]> {
  // Correct Aptos Indexer GraphQL schema — use user_transactions root field
  const query = `
    query ShelbyBlobHistory($addr: String!, $contract: String!, $limit: Int!) {
      user_transactions(
        where: {
          sender: { _eq: $addr }
          entry_function_id_str: { _like: $contract }
        }
        order_by: { timestamp: desc }
        limit: $limit
      ) {
        version
        hash
        timestamp
        entry_function_id_str
        sender
        payload
      }
    }
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          addr: walletAddress.toLowerCase(),
          contract: `${contract}::%`, // Match any function in the contract module
          limit,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Indexer HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();

    // Surface any GraphQL errors
    if (json.errors && json.errors.length > 0) {
      console.warn('[Indexer] GraphQL errors:', json.errors);
      throw new Error(json.errors[0]?.message || 'GraphQL error');
    }

    const allRows: any[] = json?.data?.user_transactions ?? [];
    
    // 1. Identify all deletions first to filter later
    const deletedBlobNames = new Set<string>();
    for (const tx of allRows) {
      const fn = tx.entry_function_id_str || '';
      const payload = tx.payload || {};
      const args = payload.function?.arguments || payload.arguments || [];

      if (fn.includes('delete_blob')) {
        if (args[0]) deletedBlobNames.add(String(args[0]));
      } else if (fn.includes('delete_multiple_blobs')) {
        if (Array.isArray(args[0])) {
          args[0].forEach((name: string) => deletedBlobNames.add(name));
        }
      }
    }

    // 2. Process registrations
    const history: IndexerBlob[] = [];
    for (const tx of allRows) {
      const fn = tx.entry_function_id_str || '';
      if (!fn.includes('register_')) continue;

      const payload = tx.payload || {};
      const args = payload.function?.arguments || payload.arguments || [];
      const tsMicro = parseInt(tx.timestamp);
      const d = new Date(isNaN(tsMicro) ? Date.now() : tsMicro / 1000);
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = d.toTimeString().slice(0, 5);

      if (fn.includes('register_multiple_blobs')) {
        const names: string[] = args[0] || [];
        const sizes: any[] = args[4] || args[3] || []; // different versions of the contract might have different indices
        
        names.forEach((name, i) => {
          if (deletedBlobNames.has(name)) return;
          const size = parseInt(sizes[i]) || 0;
          const ext = name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'BIN';
          history.push({
            id: Number(tx.version) + (i * 0.001),
            name,
            ext,
            size,
            date: dateStr,
            time: timeStr,
            uploader: tx.sender || walletAddress,
            status: 'stored',
            vis: 'public',
            network: networkLabel,
            cid: name,
            txHash: tx.hash || '',
          });
        });
      } else if (fn.includes('register_blob')) {
        const name = args[0] || 'Vault Asset';
        if (deletedBlobNames.has(name)) continue;

        const size = parseInt(args[4] || args[3]) || 0;
        const ext = name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'BIN';
        history.push({
          id: parseInt(tx.version) || Date.now(),
          name,
          ext,
          size,
          date: dateStr,
          time: timeStr,
          uploader: tx.sender || walletAddress,
          status: 'stored',
          vis: 'public',
          network: networkLabel,
          cid: name,
          txHash: tx.hash || '',
        });
      }
    }

    console.log(`[Indexer] Processed ${history.length} active blobs after filtering deletions.`);
    return history;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Indexer request timed out after 10s');
    }
    throw err;
  }
}

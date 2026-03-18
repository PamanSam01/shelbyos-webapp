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
    query ShelbyBlobHistory($addr: String!, $func: String!, $limit: Int!) {
      user_transactions(
        where: {
          sender: { _eq: $addr }
          entry_function_id_str: { _ilike: $func }
        }
        order_by: { timestamp: desc }
        limit: $limit
      ) {
        version
        hash
        timestamp
        entry_function_id_str
        sender
        arguments
      }
    }
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const funcPattern = `%${contract}%register_blob%`;

  try {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          addr: walletAddress.toLowerCase(),
          func: funcPattern,
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

    const txns: any[] = json?.data?.user_transactions ?? [];
    console.log(`[Indexer] GraphQL returned ${txns.length} user_transactions`);

    return txns
      .map((tx: any): IndexerBlob | null => {
        const args: string[] = tx.arguments ?? [];
        let name = 'Vault Asset';
        let size = 0;

        // Argument 0 is the blob name (hex-encoded or plain)
        if (args.length > 0) {
          const rawName = args[0];
          if (typeof rawName === 'string' && rawName.startsWith('0x')) {
            try {
              const hex = rawName.slice(2);
              const decoded = new TextDecoder().decode(
                new Uint8Array((hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)))
              );
              if (decoded && decoded.trim().length > 0) name = decoded.trim();
            } catch {
              name = rawName;
            }
          } else if (typeof rawName === 'string' && rawName.length > 0) {
            name = rawName;
          }
        }

        // Argument 3 is usually size in bytes
        if (args.length >= 4) {
          size = parseInt(args[3]) || 0;
        }

        // Timestamp from indexer is in microseconds
        const tsMicro = parseInt(tx.timestamp);
        const tsMs = isNaN(tsMicro) ? Date.now() : tsMicro / 1000;
        const d = new Date(tsMs);
        const ext = name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'BIN';

        return {
          id: parseInt(tx.version) || Date.now(),
          name,
          ext,
          size,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5),
          uploader: tx.sender || walletAddress,
          status: 'stored',
          vis: 'public',
          network: networkLabel,
          cid: name,
          txHash: tx.hash || '',
        };
      })
      .filter((b): b is IndexerBlob => b !== null);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Indexer request timed out after 10s');
    }
    throw err;
  }
}

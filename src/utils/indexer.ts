/**
 * indexer.ts \u2014 Aptos GraphQL Indexer integration for Shelby OS Vault History
 *
 * Queries the on-chain RegisterBlob transactions directly from the Aptos GraphQL
 * Indexer, bypassing the Shelby REST API when it is unavailable.
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

const REGISTER_BLOB_FUNC = 'register_blob';

/**
 * Fetch blob history for a wallet address from the Aptos GraphQL Indexer.
 * Returns an array of IndexerBlob or throws on failure.
 */
export async function fetchBlobsFromIndexer(
  indexerUrl: string,
  walletAddress: string,
  contract: string,
  networkLabel: string,
  limit = 50
): Promise<IndexerBlob[]> {
  // Targets RegisterBlob entry function transactions
  const querySimple = `
    query BlobTxns($addr: String!, $contract: String!, $limit: Int!) {
      transactions(
        where: {
          _and: [
            { user_transactions: { sender: { _eq: $addr } } }
            { user_transactions: { entry_function_id_str: { _ilike: $contract } } }
          ]
        }
        order_by: { version: desc }
        limit: $limit
      ) {
        version
        hash
        user_transactions {
          entry_function_id_str
          sender
          timestamp
          arguments
        }
      }
    }
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: querySimple,
        variables: {
          addr: walletAddress.toLowerCase(),
          contract: `%${contract}%::${REGISTER_BLOB_FUNC}%`,
          limit,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Indexer HTTP ${res.status}`);
    }

    const json = await res.json();
    const txns: any[] = json?.data?.transactions ?? [];

    return txns
      .map((tx: any): IndexerBlob | null => {
        const userTx = tx?.user_transactions?.[0];
        if (!userTx) return null;

        const args: string[] = userTx.arguments ?? [];
        let name = 'Vault Asset';
        let size = 0;

        // Argument 0 is often the blob name (hex or plain string)
        if (args.length > 0) {
          const rawName = args[0];
          if (typeof rawName === 'string' && rawName.startsWith('0x')) {
            try {
              const hex = rawName.slice(2);
              name = new TextDecoder().decode(
                new Uint8Array((hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)))
              );
            } catch {
              name = rawName;
            }
          } else if (typeof rawName === 'string' && rawName.length > 0) {
            name = rawName;
          }
        }
        if (args.length >= 4) {
          size = parseInt(args[3]) || 0;
        }

        const ts = parseInt(userTx.timestamp) || Date.now() * 1000;
        const d = new Date(ts / 1000);
        const ext = name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'BIN';

        return {
          id: tx.version,
          name,
          ext,
          size,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5),
          uploader: userTx.sender || walletAddress,
          status: 'stored',
          vis: 'public',
          network: networkLabel,
          cid: name,
          txHash: tx.hash,
        };
      })
      .filter((b): b is IndexerBlob => b !== null);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Indexer request timed out');
    }
    throw err;
  }
}

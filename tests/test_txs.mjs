const addr = "0xef6c0132291f1b662ac729c21798cfc7285e080315c4eff3651e9cdbb2aaffe9";
const aptosRpc = "https://fullnode.testnet.aptoslabs.com/v1";

async function main() {
  const allBlobTxs = [];
  let start = undefined;

  for (let page = 0; page < 10; page++) {
    const url = start !== undefined
      ? `${aptosRpc}/accounts/${addr}/transactions?limit=100&start=${start}`
      : `${aptosRpc}/accounts/${addr}/transactions?limit=100`;

    const res = await fetch(url);
    if (!res.ok) break;

    const txns = await res.json();
    if (!Array.isArray(txns) || txns.length === 0) break;

    const blobTxs = txns.filter(tx => {
      if (tx.type !== 'user_transaction') return false;
      const fn = tx.payload?.function ?? '';
      return fn.includes('register_blob') || fn.includes('register_multiple_blobs') || 
             fn.includes('delete_blob') || fn.includes('delete_multiple_blobs') || 
             fn.includes('::storage::');
    });
    allBlobTxs.push(...blobTxs);

    const versions = txns.map(t => parseInt(t.version)).filter(v => !isNaN(v));
    if (versions.length === 0 || versions.length < 100) break;
    start = Math.min(...versions);
  }

  // Sort newest first
  allBlobTxs.sort((a, b) => (parseInt(b.timestamp) || 0) - (parseInt(a.timestamp) || 0));

  const activeBlobs = [];
  const deletedNames = new Set();
  const logs = [];

  for (const tx of allBlobTxs) {
    const fn = tx.payload?.function ?? '';
    const args = tx.payload?.arguments ?? [];

    if (fn.includes('delete_multiple_blobs')) {
      if (args.length >= 1 && Array.isArray(args[0])) {
        args[0].forEach(n => {
          if (typeof n === 'string') {
            deletedNames.add(n);
            logs.push(`DELETE_MULTI: [${n}] at ${tx.timestamp}`);
          }
        });
      }
      continue;
    }

    if (fn.includes('register_multiple_blobs')) {
      if (args.length >= 1 && Array.isArray(args[0])) {
        args[0].forEach((n, idx) => {
          if (typeof n === 'string') {
            if (!deletedNames.has(n)) {
              activeBlobs.push(n);
              deletedNames.add(n);
              logs.push(`ACTIVE_MULTI: [${n}] at ${tx.timestamp}`);
            } else {
              logs.push(`IGNORED_MULTI: [${n}] at ${tx.timestamp} (Already deleted)`);
            }
          }
        });
      }
      continue;
    }

    let name = '';
    if (args.length >= 1 && typeof args[0] === 'string' && args[0].length > 0) {
      name = args[0];
    }

    if (fn.includes('delete_blob')) {
      if (name) {
        deletedNames.add(name);
        logs.push(`DELETE_SINGLE: [${name}] at ${tx.timestamp}`);
      }
    } else {
      if (name && !deletedNames.has(name)) {
        activeBlobs.push(name);
        deletedNames.add(name);
        logs.push(`ACTIVE_SINGLE: [${name}] at ${tx.timestamp}`);
      } else if (name && deletedNames.has(name)) {
        logs.push(`IGNORED_SINGLE: [${name}] at ${tx.timestamp} (Already deleted)`);
      }
    }
  }

  console.log("=== LOGS ===");
  for (const tx of allBlobTxs) {
    const fn = tx.payload?.function ?? '';
    const args = tx.payload?.arguments ?? [];
    let hasVerified = false;
    
    if (args.length > 0) {
      if (Array.isArray(args[0])) {
        if (args[0].some(a => typeof a === 'string' && a.includes('Verified'))) {
          hasVerified = true;
        }
      } else if (typeof args[0] === 'string' && args[0].includes('Verified')) {
        hasVerified = true;
      }
    }

    if (hasVerified) {
      console.log(`\nFound Verified in fn: ${fn}`);
      console.log(`Args[0]:`, args[0]);
      console.log(`Args[1] (expiration):`, args[1]);
      console.log(`Version: ${tx.version}, Time: ${tx.timestamp}`);
    }
    
    // Log any function that has "storage" and "delete"
    if (fn.includes('storage') && fn.includes('delete')) {
      console.log(`\nFound storage delete fn: ${fn}`);
      console.log(`Args:`, args);
    }
  }
}

main();

import { debugLog, debugWarn, debugError } from "../utils/logger";

/**
 * Service for interacting with the Shelby protocol APIs and Indexer.
 */

/**
 * Robust fetcher for Shelby GraphQL Indexer.
 * Handles safe response parsing and production-safe authenticated public access.
 */
export async function shelbyIndexerFetch(indexerUrl: string, apiKey: string, query: string, variables: any = {}) {
  debugLog("GRAPHQL ENDPOINT:", indexerUrl);
  try {
    const res = await fetch(indexerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ query, variables }),
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      debugError("[Shelby Indexer] Failed to parse JSON response:", parseErr);
      const text = await res.text().catch(() => "Could not read response text");
      debugError("[Shelby Indexer] Raw response:", text);
      return null;
    }

    if (!res.ok) {
      debugError("[Shelby Indexer ERROR]", res.status, data);
      return null;
    }

    debugLog("GRAPHQL RESPONSE:", data);
    return data;
  } catch (err) {
    debugError("[Shelby Indexer] Fetch failed:", err);
    return null;
  }
}

/**
 * High-level function to fetch blobs from the Shelby GraphQL indexer for a specific owner.
 */
export async function fetchBlobsFromGraphQL(indexerUrl: string, apiKey: string, owner: string) {
  const query = `
    query GetBlobs($owner: String!) {
      blobs(
        where: { 
          owner: { _eq: $owner },
          is_deleted: { _eq: 0 },
          is_written: { _eq: 1 }
        },
        order_by: { created_at: desc }
      ) {
        blob_name
        size
        created_at
        owner
      }
    }
  `;
  const variables = { owner: owner.toLowerCase() };
  const data = await shelbyIndexerFetch(indexerUrl, apiKey, query, variables);
  
  if (data?.data?.blobs) {
    debugLog(`[Vault] Found ${data.data.blobs.length} active blobs via GraphQL Indexer`);
  } else {
    debugWarn("[Vault] GraphQL returned empty data");
  }
  
  return data;
}

/**
 * Function to fetch recent system activities (blobs) from the Shelby indexer.
 */
export async function fetchRecentActivitiesFromGraphQL(indexerUrl: string, apiKey: string, limit: number = 5) {
  const query = `
    query GetRecentBlobs($limit: Int!) {
      blobs(
        where: {
          is_deleted: { _eq: 0 },
          is_written: { _eq: 1 }
        },
        limit: $limit, 
        order_by: { created_at: desc }
      ) {
        blob_name
        created_at
      }
    }
  `;
  const variables = { limit };
  return shelbyIndexerFetch(indexerUrl, apiKey, query, variables);
}

/**
 * Placeholder for Shelby Storage API calls (e.g., multipart upload preparation).
 */
export async function prepareStorageUpload(files: File[]) {
  // Logic for manual storage interactions can be added here
  debugLog("[Shelby] Preparing storage for", files.length, "files");
  return { success: true };
}

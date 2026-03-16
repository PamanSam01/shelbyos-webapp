/**
 * Service for interacting with the Shelby storage API.
 */

export interface ShelbyBlob {
  id: number;
  blobName: string;
  size: number;
  createdAt: string;
  blobId: string;
  txHash: string;
}

export interface MultipartInitResponse {
  uploadId: string;
  presignedUrls: string[];
}

export interface MultipartCompleteResponse {
  blobId: string;
}

/**
 * Fetches user's blobs from Shelby storage.
 */
export async function fetchBlobs(walletAddress: string, apiKey: string, storageApi: string): Promise<ShelbyBlob[]> {
  const res = await fetch(`${storageApi}/shelby/v1/blobs/${walletAddress}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch blobs: ${text}`);
  }

  return res.json();
}

/**
 * Initializes a multipart upload session.
 */
export async function initMultipartUpload(
  account: string,
  fileName: string,
  partSize: number,
  apiKey: string,
  storageApi: string
): Promise<MultipartInitResponse> {
  const res = await fetch(`${storageApi}/shelby/v1/multipart-uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      rawAccount: account,
      rawBlobName: fileName,
      rawPartSize: partSize
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Multipart initialization failed: ${text}`);
  }

  return res.json();
}

/**
 * Uploads a single file chunk to a presigned URL.
 */
export async function uploadPart(url: string, data: ArrayBuffer): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: data
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Part upload failed: ${text}`);
  }
}

/**
 * Finalizes a multipart upload session.
 */
export async function completeMultipartUpload(
  uploadId: string,
  account: string,
  fileName: string,
  apiKey: string,
  storageApi: string
): Promise<MultipartCompleteResponse> {
  const res = await fetch(`${storageApi}/shelby/v1/multipart-uploads/${uploadId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      rawAccount: account,
      rawBlobName: fileName
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Multipart completion failed: ${text}`);
  }

  return res.json();
}

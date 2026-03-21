/**
 * ShelbyOS Crypto Utilities
 * Client-side file encryption using AES-GCM and wallet signatures.
 */

/**
 * Encrypts a file using a key derived from a wallet signature.
 * Uses AES-GCM for authenticated encryption.
 * The output file format is: [12 bytes IV] + [encrypted data].
 */
export async function encryptFileWithSignature(file: File, signature: any): Promise<File> {
  const fileBuffer = await file.arrayBuffer();
  
  // Derivation strategy: Use the signature as raw key material for PBKDF2
  const encoder = new TextEncoder();
  // Ensure signature is a consistent seed (handle strings or objects from different wallets)
  const sigSeed = typeof signature === 'string' ? signature : JSON.stringify(signature);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sigSeed),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // Static salt for deterministic key derivation from signature
  const salt = encoder.encode("shelbyos-encryption-salt-v1");
  
  // Derive a 256-bit AES-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  // Generate a random 12-byte IV for GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the file data
  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    fileBuffer
  );
  
  // Prepend the IV to the encrypted data for storage
  const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedContent), iv.length);
  
  // Create a Blob first to ensure memory stability and correct MIME enforcement
  const encryptedBlob = new Blob([combined], { type: "application/octet-stream" });
  
  // Return a new File object with the .enc suffix
  const encryptedFile = new File([encryptedBlob], `${file.name}.enc`, { 
    type: "application/octet-stream",
    lastModified: Date.now()
  });
  
  return encryptedFile;
}

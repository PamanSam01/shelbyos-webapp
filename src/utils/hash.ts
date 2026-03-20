import { debugError } from "./logger";

/**
 * Generates a SHA-256 hash commitment of a file.
 * Returns the hash as a byte array (vector<u8>).
 */
export async function getCommitment(file: File): Promise<number[]> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer));
  } catch (err) {
    debugError("Commitment generation failed:", err);
    throw new Error("commitment_generation_failed");
  }
}

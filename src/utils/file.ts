/**
 * Formats a raw token balance into a human-readable string.
 */
export function formatTokenBalance(value: number | string, decimals = 4): string {
  if (!value || value === 0 || value === "0") return "0";
  return Number(value)
    .toFixed(decimals)
    .replace(/\.?0+$/, "");
}

/**
 * Extracts the file extension and converts it to uppercase.
 */
export function getFileExtension(filename: string): string {
  return (filename.split('.').pop() || 'BIN').toUpperCase().slice(0, 4);
}

/**
 * Formats raw bytes into human-readable sizes (B, KB, MB, GB).
 * Automatically parses strings to numbers to avoid scientific notation bugs.
 */
export function formatFileSize(bytes: number | string): string {
  const size = Number(bytes) || 0;
  if (size === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  // Ensure we don't go out of bounds on massive numbers
  const i = Math.min(Math.floor(Math.log(size) / Math.log(k)), sizes.length - 1);
  
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

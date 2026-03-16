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
 * Formats bytes into a human-readable MB string.
 */
export function formatToMB(bytes: number): string {
  return (bytes / 1048576).toFixed(2) + ' MB';
}

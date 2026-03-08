/**
 * Resolves after a random delay between minMs and maxMs.
 * Used to avoid rate-limiting when submitting multiple applications.
 */
export function sleep(minMs = 3000, maxMs = 5000): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

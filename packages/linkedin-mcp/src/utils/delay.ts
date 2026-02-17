/**
 * Returns a random integer between min and max (inclusive).
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Waits for a randomized delay to simulate human-like behavior.
 * @param minMs - Minimum wait time in milliseconds.
 * @param maxMs - Maximum wait time in milliseconds.
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = randomBetween(minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** Standard delay between job search scrolls (3-5 seconds) */
export const SCROLL_DELAY = () => randomDelay(3_000, 5_000);

/** Standard delay between Easy Apply submissions (8-12 seconds) */
export const APPLY_DELAY = () => randomDelay(8_000, 12_000);

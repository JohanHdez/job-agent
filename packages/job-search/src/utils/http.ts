/**
 * Shared HTTP fetch utilities for platform searchers.
 * All requests use a browser-like User-Agent to avoid bot rejection.
 */

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Fetches a URL as text with standard browser headers.
 * @param url - The URL to fetch.
 * @param extraHeaders - Optional additional headers.
 * @param timeoutMs - Request timeout in milliseconds (default 20s).
 */
export async function fetchText(
  url: string,
  extraHeaders: Record<string, string> = {},
  timeoutMs = 20_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { ...DEFAULT_HEADERS, ...extraHeaders },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches a URL and parses the response as JSON.
 */
export async function fetchJson<T>(
  url: string,
  extraHeaders: Record<string, string> = {},
  timeoutMs = 20_000
): Promise<T> {
  const text = await fetchText(url, { ...extraHeaders, 'Accept': 'application/json' }, timeoutMs);
  return JSON.parse(text) as T;
}

/**
 * Adds a human-like delay between requests to avoid rate limiting.
 * @param minMs - Minimum delay in ms (default 1500).
 * @param maxMs - Maximum delay in ms (default 3000).
 */
export function sleep(minMs = 1500, maxMs = 3000): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

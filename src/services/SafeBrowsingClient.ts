/**
 * ScamGuardian — SafeBrowsingClient
 *
 * Wraps the Google Safe Browsing Lookup API v4 (`POST /v4/threatMatches:find`).
 * Used as a fallback by URLChecker when a domain is not found in the local
 * SQLite blocklist cache.
 *
 * On a positive result the matched domain is added to the local blocklist via
 * `urlChecker.addToBlocklist()` so that subsequent checks are served from
 * cache without a network round-trip.
 *
 * Retry policy: up to 3 retries on HTTP 429 or 5xx responses, with
 * exponential back-off delays of 1 s → 2 s → 4 s.
 *
 * Requirements: 2.1
 */

import {URLChecker} from './URLChecker';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Replace with a real key from the Google Cloud Console.
 * https://developers.google.com/safe-browsing/v4/get-started
 */
export const SAFE_BROWSING_API_KEY = 'YOUR_SAFE_BROWSING_API_KEY';

const SAFE_BROWSING_ENDPOINT =
  'https://safebrowsing.googleapis.com/v4/threatMatches:find';

/** Maximum number of retry attempts after the initial request. */
const MAX_RETRIES = 3;

/** Base delay in milliseconds for the first retry (doubles each attempt). */
const BASE_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SafeBrowsingRequestBody {
  client: {
    clientId: string;
    clientVersion: string;
  };
  threatInfo: {
    threatTypes: string[];
    platformTypes: string[];
    threatEntryTypes: string[];
    threatEntries: Array<{url: string}>;
  };
}

interface SafeBrowsingMatch {
  threatType: string;
  threat: {url: string};
}

interface SafeBrowsingResponse {
  matches?: SafeBrowsingMatch[];
}

// ---------------------------------------------------------------------------
// SafeBrowsingClient
// ---------------------------------------------------------------------------

export class SafeBrowsingClient {
  private readonly urlChecker: URLChecker;
  private readonly apiKey: string;

  /**
   * @param urlChecker - The URLChecker instance used to cache positive results.
   * @param apiKey     - Google Safe Browsing API key (defaults to the
   *                     placeholder constant).
   */
  constructor(
    urlChecker: URLChecker,
    apiKey: string = SAFE_BROWSING_API_KEY,
  ) {
    this.urlChecker = urlChecker;
    this.apiKey = apiKey;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check whether a URL is flagged as malicious by the Google Safe Browsing
   * Lookup API v4.
   *
   * - Returns `true`  if the API reports a threat match.
   * - Returns `false` if the URL is clean or the API is unreachable after all
   *   retries (fail-open to avoid blocking legitimate content).
   *
   * On a positive result, the domain is added to the local blocklist cache via
   * `urlChecker.addToBlocklist()`.
   *
   * Requirement 2.1
   *
   * @param url - The full URL to check (e.g. "https://evil-bank.com/login").
   */
  async checkUrl(url: string): Promise<boolean> {
    const body: SafeBrowsingRequestBody = {
      client: {
        clientId: 'scam-guardian',
        clientVersion: '1.0.0',
      },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{url}],
      },
    };

    const endpoint = `${SAFE_BROWSING_ENDPOINT}?key=${this.apiKey}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Exponential back-off before each retry (not before the first attempt)
      if (attempt > 0) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await this.sleep(delayMs);
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        });

        // Retry on rate-limit or server errors
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(
            `Safe Browsing API returned HTTP ${response.status}`,
          );
          continue;
        }

        // Any other non-2xx response is treated as a non-retryable failure
        if (!response.ok) {
          return false;
        }

        const data: SafeBrowsingResponse = await response.json();

        if (data.matches && data.matches.length > 0) {
          // Cache the positive result so future checks are served locally
          await this.cacheDomain(url);
          return true;
        }

        return false;
      } catch (err) {
        // Network error — retry if attempts remain
        lastError = err;
      }
    }

    // All retries exhausted — fail open (treat as clean) to avoid blocking
    // legitimate content when the API is temporarily unavailable.
    console.warn(
      '[SafeBrowsingClient] All retries exhausted for URL:',
      url,
      lastError,
    );
    return false;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract the domain from a URL and add it to the local blocklist cache.
   * Falls back gracefully if domain extraction fails.
   */
  private async cacheDomain(url: string): Promise<void> {
    const domain = this.extractDomain(url);
    if (domain) {
      await this.urlChecker.addToBlocklist(domain);
    }
  }

  /**
   * Extract the bare domain (host) from a URL string, stripping protocol,
   * www prefix, path, query string, and fragment.
   * Returns null if the URL cannot be parsed.
   */
  private extractDomain(url: string): string | null {
    try {
      const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const parsed = new URL(withProtocol);
      const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      return hostname.includes('.') ? hostname : null;
    } catch {
      return null;
    }
  }

  /**
   * Return a Promise that resolves after `ms` milliseconds.
   * Extracted as a method so tests can spy on it.
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

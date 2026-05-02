/**
 * ScamGuardian — URLChecker
 *
 * Extracts all URLs from a message body and checks each domain against a
 * local SQLite blocklist cache. Returns a ThreatIndicator of type
 * 'phishing_url' for every matched domain.
 *
 * On first open(), the url_blocklist table is created and seeded with a
 * sample set of known phishing domains.
 *
 * The isBlocklisted() method is intentionally public so that the Safe
 * Browsing API fallback (SafeBrowsingClient) can call it to check whether a
 * domain is already cached before making a remote API call.
 *
 * When a URL is NOT found in the local cache, check() delegates to
 * SafeBrowsingClient.checkUrl() as a fallback. Positive results from the
 * remote API are automatically cached in the local blocklist.
 *
 * Requirements: 2.1
 */

import SQLite, {SQLiteDatabase, Transaction} from 'react-native-sqlite-storage';
import {ThreatIndicator} from '../models/types';
import {SafeBrowsingClient} from './SafeBrowsingClient';

SQLite.enablePromise(true);

const DB_NAME = 'scam_guardian.db';
const TABLE_NAME = 'url_blocklist';

/**
 * Sample phishing domains used to seed the blocklist on first run.
 * These are fictional examples for demonstration purposes.
 */
const SEED_DOMAINS: string[] = [
  'evil-bank.com',
  'phishing-site.net',
  'secure-login-verify.com',
  'account-suspended-alert.com',
  'free-prize-winner.net',
  'urgent-bank-update.com',
  'paypal-security-check.net',
  'amazon-account-verify.com',
  'irs-tax-refund-claim.com',
  'crypto-investment-returns.net',
  'gov-stimulus-payment.com',
  'bank-of-america-alert.net',
];

/**
 * Regex that matches URLs with an explicit protocol (http:// or https://)
 * as well as bare domain-like patterns (e.g. "evil-bank.com/path").
 *
 * Capture group 1: the full URL string (used for evidence snippet).
 * Domain extraction is done separately via extractDomain().
 */
const URL_REGEX =
  /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+)(?:\/[^\s]*)?/gi;

export class URLChecker {
  private db: SQLiteDatabase | null = null;

  /**
   * Optional Safe Browsing API client used as a fallback when a domain is not
   * found in the local blocklist cache. Injected via setSafeBrowsingClient()
   * to keep the constructor simple and allow easy mocking in tests.
   */
  private safeBrowsingClient: SafeBrowsingClient | null = null;

  /**
   * Inject the Safe Browsing API client. Call this after open() to enable
   * remote fallback lookups on cache misses.
   *
   * @param client - A SafeBrowsingClient instance.
   */
  setSafeBrowsingClient(client: SafeBrowsingClient): void {
    this.safeBrowsingClient = client;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Open (or reuse) the shared SQLite database, create the url_blocklist
   * table if it does not exist, and seed it with sample domains.
   * Must be called before check() or isBlocklisted().
   */
  async open(): Promise<void> {
    this.db = await SQLite.openDatabase({name: DB_NAME, location: 'default'});
    await this.createTable();
    await this.seedBlocklist();
  }

  /** Close the database connection. */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Schema
  // ---------------------------------------------------------------------------

  /**
   * Create the url_blocklist table if it does not already exist.
   * Idempotent — safe to call on every app start.
   */
  async createTable(): Promise<void> {
    const db = this.requireDb();
    await db.transaction((tx: Transaction) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          domain    TEXT    PRIMARY KEY NOT NULL,
          added_at  INTEGER NOT NULL
        );`,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Seeding
  // ---------------------------------------------------------------------------

  /**
   * Insert the sample phishing domains into the blocklist.
   * Uses INSERT OR IGNORE so that re-running on subsequent app starts is safe.
   */
  async seedBlocklist(): Promise<void> {
    const db = this.requireDb();
    const now = Date.now();
    await db.transaction((tx: Transaction) => {
      for (const domain of SEED_DOMAINS) {
        tx.executeSql(
          `INSERT OR IGNORE INTO ${TABLE_NAME} (domain, added_at) VALUES (?, ?);`,
          [domain, now],
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Extract all URLs from the message body, resolve each to a bare domain,
   * and check every domain against the local blocklist.
   *
   * On a cache miss, delegates to SafeBrowsingClient.checkUrl() if one has
   * been injected via setSafeBrowsingClient(). Positive results from the
   * remote API are automatically cached in the local blocklist by the client.
   *
   * Returns one ThreatIndicator per matched domain (confidence = 1.0).
   *
   * Requirement 2.1
   */
  async check(body: string): Promise<ThreatIndicator[]> {
    // Ensure the database is open before proceeding
    this.requireDb();

    const urls = this.extractUrls(body);
    if (urls.length === 0) {
      return [];
    }

    const indicators: ThreatIndicator[] = [];
    // Deduplicate domains so we don't emit duplicate indicators for the same
    // domain appearing multiple times in the same message.
    const seenDomains = new Set<string>();

    for (const url of urls) {
      const domain = this.extractDomain(url);
      if (!domain || seenDomains.has(domain)) {
        continue;
      }
      seenDomains.add(domain);

      // 1. Check local blocklist cache first
      const blocked = await this.isBlocklisted(domain);
      if (blocked) {
        indicators.push({
          type: 'phishing_url',
          confidence: 1.0,
          evidence: `Blocklisted domain detected: ${url}`,
        });
        continue;
      }

      // 2. Cache miss — fall back to Safe Browsing API if available
      if (this.safeBrowsingClient) {
        const flagged = await this.safeBrowsingClient.checkUrl(url);
        if (flagged) {
          // The client has already cached the domain via addToBlocklist()
          indicators.push({
            type: 'phishing_url',
            confidence: 1.0,
            evidence: `Safe Browsing flagged domain: ${url}`,
          });
        }
      }
    }

    return indicators;
  }

  /**
   * Check whether a single domain is present in the local blocklist.
   * Exposed publicly so that the Safe Browsing fallback (Task 3.2) can
   * query the cache before making a remote API call.
   *
   * @param domain - Bare domain name, e.g. "evil-bank.com"
   */
  async isBlocklisted(domain: string): Promise<boolean> {
    const db = this.requireDb();
    const normalised = domain.toLowerCase().trim();
    const [results] = await db.executeSql(
      `SELECT 1 FROM ${TABLE_NAME} WHERE domain = ? LIMIT 1;`,
      [normalised],
    );
    return results.rows.length > 0;
  }

  /**
   * Add a domain to the local blocklist (used by the Safe Browsing fallback
   * to cache positive results).
   *
   * @param domain - Bare domain name to add.
   */
  async addToBlocklist(domain: string): Promise<void> {
    const db = this.requireDb();
    const normalised = domain.toLowerCase().trim();
    await db.transaction((tx: Transaction) => {
      tx.executeSql(
        `INSERT OR IGNORE INTO ${TABLE_NAME} (domain, added_at) VALUES (?, ?);`,
        [normalised, Date.now()],
      );
    });
  }

  // ---------------------------------------------------------------------------
  // URL / Domain Extraction Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract all URL-like strings from a text body.
   * Matches both explicit protocol URLs (http://, https://) and bare domains.
   */
  extractUrls(body: string): string[] {
    const matches: string[] = [];
    // Reset lastIndex since the regex has the global flag
    URL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_REGEX.exec(body)) !== null) {
      matches.push(match[0]);
    }
    return matches;
  }

  /**
   * Extract the bare domain (host) from a URL string.
   * Strips protocol, www prefix, path, query string, and fragment.
   * Returns null if the string does not contain a valid domain (i.e. no TLD dot).
   *
   * Examples:
   *   "https://www.evil-bank.com/login?id=1" → "evil-bank.com"
   *   "http://phishing-site.net"             → "phishing-site.net"
   *   "evil-bank.com/path"                   → "evil-bank.com"
   */
  extractDomain(url: string): string | null {
    try {
      // Normalise: add a protocol if missing so URL constructor can parse it
      const withProtocol = /^https?:\/\//i.test(url)
        ? url
        : `https://${url}`;
      const parsed = new URL(withProtocol);
      const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      // Require at least one dot to ensure it's a real domain (has a TLD)
      if (!hostname.includes('.')) {
        return null;
      }
      return hostname;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private requireDb(): SQLiteDatabase {
    if (!this.db) {
      throw new Error(
        'URLChecker: database is not open. Call open() first.',
      );
    }
    return this.db;
  }
}

/** Singleton instance for use throughout the app. */
export const urlChecker = new URLChecker();

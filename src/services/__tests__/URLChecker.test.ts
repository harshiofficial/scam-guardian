/**
 * Unit tests for URLChecker
 *
 * Covers:
 *  - URL extraction from message bodies
 *  - Domain extraction from various URL formats
 *  - Blocklist seeding on open()
 *  - check() returning phishing_url indicators for blocked domains
 *  - check() returning empty array for clean URLs
 *  - isBlocklisted() for direct domain queries
 *  - addToBlocklist() for caching new domains
 *  - Deduplication of repeated domains in a single message
 *
 * Requirements: 2.1
 */

import {URLChecker} from '../URLChecker';

describe('URLChecker', () => {
  let checker: URLChecker;

  beforeEach(async () => {
    checker = new URLChecker();
    await checker.open();
  });

  afterEach(async () => {
    await checker.close();
  });

  // -------------------------------------------------------------------------
  // Lifecycle guard
  // -------------------------------------------------------------------------

  describe('requireDb guard', () => {
    it('throws if check() is called before open()', async () => {
      const uninitialised = new URLChecker();
      await expect(uninitialised.check('hello')).rejects.toThrow(
        'URLChecker: database is not open',
      );
    });

    it('throws if isBlocklisted() is called before open()', async () => {
      const uninitialised = new URLChecker();
      await expect(uninitialised.isBlocklisted('evil-bank.com')).rejects.toThrow(
        'URLChecker: database is not open',
      );
    });
  });

  // -------------------------------------------------------------------------
  // extractUrls()
  // -------------------------------------------------------------------------

  describe('extractUrls()', () => {
    it('extracts an https URL', () => {
      const urls = checker.extractUrls('Visit https://evil-bank.com/login now');
      expect(urls.length).toBeGreaterThanOrEqual(1);
      expect(urls.some(u => u.includes('evil-bank.com'))).toBe(true);
    });

    it('extracts an http URL', () => {
      const urls = checker.extractUrls('Go to http://phishing-site.net/page');
      expect(urls.length).toBeGreaterThanOrEqual(1);
      expect(urls.some(u => u.includes('phishing-site.net'))).toBe(true);
    });

    it('extracts a bare domain URL', () => {
      const urls = checker.extractUrls('Check out evil-bank.com for details');
      expect(urls.length).toBeGreaterThanOrEqual(1);
      expect(urls.some(u => u.includes('evil-bank.com'))).toBe(true);
    });

    it('extracts multiple URLs from a single message', () => {
      const urls = checker.extractUrls(
        'Visit https://evil-bank.com and also http://phishing-site.net',
      );
      expect(urls.length).toBeGreaterThanOrEqual(2);
    });

    it('returns an empty array for a message with no URLs', () => {
      const urls = checker.extractUrls('Hello, how are you today?');
      expect(urls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // extractDomain()
  // -------------------------------------------------------------------------

  describe('extractDomain()', () => {
    it('strips https:// protocol', () => {
      expect(checker.extractDomain('https://evil-bank.com')).toBe('evil-bank.com');
    });

    it('strips http:// protocol', () => {
      expect(checker.extractDomain('http://phishing-site.net')).toBe(
        'phishing-site.net',
      );
    });

    it('strips www. prefix', () => {
      expect(checker.extractDomain('https://www.evil-bank.com')).toBe(
        'evil-bank.com',
      );
    });

    it('strips path and query string', () => {
      expect(
        checker.extractDomain('https://evil-bank.com/login?user=foo&token=bar'),
      ).toBe('evil-bank.com');
    });

    it('handles bare domain with path', () => {
      expect(checker.extractDomain('evil-bank.com/some/path')).toBe(
        'evil-bank.com',
      );
    });

    it('lowercases the domain', () => {
      expect(checker.extractDomain('https://EVIL-BANK.COM')).toBe('evil-bank.com');
    });

    it('returns null for an unparseable string', () => {
      // A string with no TLD-like structure that URL constructor cannot parse
      expect(checker.extractDomain('not-a-url')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // isBlocklisted()
  // -------------------------------------------------------------------------

  describe('isBlocklisted()', () => {
    it('returns true for a seeded phishing domain', async () => {
      await expect(checker.isBlocklisted('evil-bank.com')).resolves.toBe(true);
    });

    it('returns true for another seeded domain', async () => {
      await expect(checker.isBlocklisted('phishing-site.net')).resolves.toBe(true);
    });

    it('returns false for a clean domain not in the blocklist', async () => {
      await expect(checker.isBlocklisted('google.com')).resolves.toBe(false);
    });

    it('is case-insensitive', async () => {
      await expect(checker.isBlocklisted('EVIL-BANK.COM')).resolves.toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // addToBlocklist()
  // -------------------------------------------------------------------------

  describe('addToBlocklist()', () => {
    it('adds a new domain and isBlocklisted() returns true afterwards', async () => {
      const newDomain = 'new-phishing-domain.com';
      await expect(checker.isBlocklisted(newDomain)).resolves.toBe(false);
      await checker.addToBlocklist(newDomain);
      await expect(checker.isBlocklisted(newDomain)).resolves.toBe(true);
    });

    it('is idempotent — adding the same domain twice does not throw', async () => {
      const domain = 'duplicate-domain.com';
      await checker.addToBlocklist(domain);
      await expect(checker.addToBlocklist(domain)).resolves.not.toThrow();
      await expect(checker.isBlocklisted(domain)).resolves.toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // check()
  // -------------------------------------------------------------------------

  describe('check()', () => {
    it('returns a phishing_url indicator for a message containing a blocklisted URL', async () => {
      const indicators = await checker.check(
        'Click here: https://evil-bank.com/login to verify your account',
      );
      expect(indicators).toHaveLength(1);
      expect(indicators[0].type).toBe('phishing_url');
      expect(indicators[0].confidence).toBe(1.0);
      expect(indicators[0].evidence).toContain('evil-bank.com');
    });

    it('returns an empty array for a message with no URLs', async () => {
      const indicators = await checker.check('Hello, how are you today?');
      expect(indicators).toHaveLength(0);
    });

    it('returns an empty array for a message with only clean URLs', async () => {
      const indicators = await checker.check(
        'Check out https://google.com and https://example.com',
      );
      expect(indicators).toHaveLength(0);
    });

    it('returns multiple indicators when multiple distinct blocklisted domains appear', async () => {
      const indicators = await checker.check(
        'Visit https://evil-bank.com and also http://phishing-site.net',
      );
      expect(indicators).toHaveLength(2);
      expect(indicators.every(i => i.type === 'phishing_url')).toBe(true);
      expect(indicators.every(i => i.confidence === 1.0)).toBe(true);
    });

    it('deduplicates repeated occurrences of the same domain', async () => {
      const indicators = await checker.check(
        'https://evil-bank.com/page1 and https://evil-bank.com/page2',
      );
      // Same domain twice → only one indicator
      expect(indicators).toHaveLength(1);
    });

    it('detects a blocklisted bare domain (no protocol)', async () => {
      const indicators = await checker.check(
        'Go to evil-bank.com right now to claim your reward',
      );
      expect(indicators).toHaveLength(1);
      expect(indicators[0].type).toBe('phishing_url');
    });

    it('detects a blocklisted domain with www. prefix', async () => {
      const indicators = await checker.check(
        'Visit https://www.evil-bank.com/login',
      );
      expect(indicators).toHaveLength(1);
      expect(indicators[0].type).toBe('phishing_url');
    });

    it('includes the original URL in the evidence string', async () => {
      const indicators = await checker.check(
        'https://evil-bank.com/steal-credentials',
      );
      expect(indicators[0].evidence).toContain('evil-bank.com');
    });

    it('detects a domain added via addToBlocklist()', async () => {
      const domain = 'runtime-added-phishing.com';
      await checker.addToBlocklist(domain);
      const indicators = await checker.check(
        `Visit https://${domain}/login now`,
      );
      expect(indicators).toHaveLength(1);
      expect(indicators[0].type).toBe('phishing_url');
    });
  });
});

/**
 * Unit tests for SafeBrowsingClient
 *
 * Covers:
 *  - checkUrl() returns true when the API reports a threat match
 *  - checkUrl() returns false when the API reports no matches
 *  - checkUrl() caches positive results via urlChecker.addToBlocklist()
 *  - Exponential back-off: retries on HTTP 429 and 5xx responses
 *  - Fail-open: returns false after all retries are exhausted
 *  - Non-retryable 4xx errors (e.g. 400) are not retried
 *  - Cache miss in URLChecker.check() triggers SafeBrowsingClient.checkUrl()
 *  - Cache hit in URLChecker.check() skips SafeBrowsingClient.checkUrl()
 *
 * Requirements: 2.1
 */

import {SafeBrowsingClient, SAFE_BROWSING_API_KEY} from '../SafeBrowsingClient';
import {URLChecker} from '../URLChecker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock URLChecker with jest.fn() stubs. */
function makeMockUrlChecker(isBlocklistedResult = false): URLChecker {
  const checker = {
    isBlocklisted: jest.fn().mockResolvedValue(isBlocklistedResult),
    addToBlocklist: jest.fn().mockResolvedValue(undefined),
    check: jest.fn().mockResolvedValue([]),
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    extractUrls: jest.fn().mockReturnValue([]),
    extractDomain: jest.fn().mockReturnValue(null),
    setSafeBrowsingClient: jest.fn(),
    createTable: jest.fn().mockResolvedValue(undefined),
    seedBlocklist: jest.fn().mockResolvedValue(undefined),
  } as unknown as URLChecker;
  return checker;
}

/** Build a Response-like object for jest.spyOn(global, 'fetch'). */
function makeResponse(
  status: number,
  body: object,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// SafeBrowsingClient unit tests
// ---------------------------------------------------------------------------

describe('SafeBrowsingClient', () => {
  let fetchSpy: jest.SpyInstance;
  let mockChecker: URLChecker;
  let client: SafeBrowsingClient;

  beforeEach(() => {
    mockChecker = makeMockUrlChecker();
    // Use a no-op sleep so tests run instantly
    client = new SafeBrowsingClient(mockChecker);
    jest.spyOn(client, 'sleep').mockResolvedValue(undefined);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Positive match
  // -------------------------------------------------------------------------

  describe('when the API returns a threat match', () => {
    it('returns true', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(200, {
          matches: [{threatType: 'MALWARE', threat: {url: 'https://evil.com'}}],
        }),
      );

      const result = await client.checkUrl('https://evil.com');
      expect(result).toBe(true);
    });

    it('calls addToBlocklist() with the domain', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(200, {
          matches: [{threatType: 'MALWARE', threat: {url: 'https://evil.com'}}],
        }),
      );

      await client.checkUrl('https://evil.com');
      expect(mockChecker.addToBlocklist).toHaveBeenCalledWith('evil.com');
    });

    it('calls addToBlocklist() stripping www. prefix', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(200, {
          matches: [
            {
              threatType: 'SOCIAL_ENGINEERING',
              threat: {url: 'https://www.phishing.net/login'},
            },
          ],
        }),
      );

      await client.checkUrl('https://www.phishing.net/login');
      expect(mockChecker.addToBlocklist).toHaveBeenCalledWith('phishing.net');
    });
  });

  // -------------------------------------------------------------------------
  // Clean URL
  // -------------------------------------------------------------------------

  describe('when the API returns no matches', () => {
    it('returns false for an empty matches array', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, {matches: []}));
      const result = await client.checkUrl('https://google.com');
      expect(result).toBe(false);
    });

    it('returns false when the response body has no matches key', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, {}));
      const result = await client.checkUrl('https://google.com');
      expect(result).toBe(false);
    });

    it('does NOT call addToBlocklist()', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, {}));
      await client.checkUrl('https://google.com');
      expect(mockChecker.addToBlocklist).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Exponential back-off on 429 / 5xx
  // -------------------------------------------------------------------------

  describe('exponential back-off', () => {
    it('retries on HTTP 429 and succeeds on the next attempt', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeResponse(429, {}))
        .mockResolvedValueOnce(makeResponse(200, {}));

      const result = await client.checkUrl('https://example.com');
      expect(result).toBe(false); // clean on second attempt
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('retries on HTTP 500 and succeeds on the next attempt', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeResponse(500, {}))
        .mockResolvedValueOnce(
          makeResponse(200, {
            matches: [{threatType: 'MALWARE', threat: {url: 'https://evil.com'}}],
          }),
        );

      const result = await client.checkUrl('https://evil.com');
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('applies exponential back-off delays between retries', async () => {
      const sleepSpy = jest.spyOn(client, 'sleep').mockResolvedValue(undefined);

      fetchSpy
        .mockResolvedValueOnce(makeResponse(429, {}))
        .mockResolvedValueOnce(makeResponse(503, {}))
        .mockResolvedValueOnce(makeResponse(200, {}));

      await client.checkUrl('https://example.com');

      // First retry: 1 s, second retry: 2 s
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
    });

    it('retries up to MAX_RETRIES (3) times then fails open', async () => {
      // All 4 attempts (initial + 3 retries) return 429
      fetchSpy.mockResolvedValue(makeResponse(429, {}));

      const result = await client.checkUrl('https://example.com');
      expect(result).toBe(false); // fail-open
      expect(fetchSpy).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('retries on network errors and fails open after all retries', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const result = await client.checkUrl('https://example.com');
      expect(result).toBe(false); // fail-open
      expect(fetchSpy).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  // -------------------------------------------------------------------------
  // Non-retryable errors
  // -------------------------------------------------------------------------

  describe('non-retryable HTTP errors', () => {
    it('returns false immediately on HTTP 400 without retrying', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(400, {}));

      const result = await client.checkUrl('https://example.com');
      expect(result).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // no retries
    });

    it('returns false immediately on HTTP 403 without retrying', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(403, {}));

      const result = await client.checkUrl('https://example.com');
      expect(result).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Request format
  // -------------------------------------------------------------------------

  describe('request format', () => {
    it('sends a POST request to the correct endpoint with the API key', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, {}));

      await client.checkUrl('https://example.com');

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('safebrowsing.googleapis.com/v4/threatMatches:find');
      expect(url).toContain(`key=${SAFE_BROWSING_API_KEY}`);
      expect(options.method).toBe('POST');
    });

    it('includes the URL in the request body threatEntries', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, {}));

      await client.checkUrl('https://example.com/path');

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.threatInfo.threatEntries).toEqual([
        {url: 'https://example.com/path'},
      ]);
    });

    it('requests MALWARE, SOCIAL_ENGINEERING, and UNWANTED_SOFTWARE threat types', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, {}));

      await client.checkUrl('https://example.com');

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.threatInfo.threatTypes).toEqual(
        expect.arrayContaining([
          'MALWARE',
          'SOCIAL_ENGINEERING',
          'UNWANTED_SOFTWARE',
        ]),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// URLChecker integration: Safe Browsing fallback wiring
// ---------------------------------------------------------------------------

describe('URLChecker — Safe Browsing fallback integration', () => {
  let checker: URLChecker;
  let safeBrowsingClient: SafeBrowsingClient;
  let checkUrlSpy: jest.SpyInstance;

  beforeEach(async () => {
    checker = new URLChecker();
    await checker.open();

    safeBrowsingClient = new SafeBrowsingClient(checker);
    jest.spyOn(safeBrowsingClient, 'sleep').mockResolvedValue(undefined);
    checker.setSafeBrowsingClient(safeBrowsingClient);

    checkUrlSpy = jest.spyOn(safeBrowsingClient, 'checkUrl');
  });

  afterEach(async () => {
    await checker.close();
    jest.restoreAllMocks();
  });

  it('calls SafeBrowsingClient.checkUrl() on a cache miss', async () => {
    checkUrlSpy.mockResolvedValue(false);

    await checker.check('Visit https://unknown-clean-domain.com');

    expect(checkUrlSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown-clean-domain.com'),
    );
  });

  it('does NOT call SafeBrowsingClient.checkUrl() on a cache hit', async () => {
    // 'evil-bank.com' is seeded in the local blocklist
    await checker.check('Visit https://evil-bank.com/login');

    expect(checkUrlSpy).not.toHaveBeenCalled();
  });

  it('returns a phishing_url indicator when Safe Browsing flags the URL', async () => {
    checkUrlSpy.mockResolvedValue(true);

    const indicators = await checker.check(
      'Visit https://new-phishing-site.com/steal',
    );

    expect(indicators).toHaveLength(1);
    expect(indicators[0].type).toBe('phishing_url');
    expect(indicators[0].confidence).toBe(1.0);
    expect(indicators[0].evidence).toContain('new-phishing-site.com');
  });

  it('returns no indicator when Safe Browsing reports the URL as clean', async () => {
    checkUrlSpy.mockResolvedValue(false);

    const indicators = await checker.check('Visit https://safe-site.com');

    expect(indicators).toHaveLength(0);
  });

  it('returns no indicator when no SafeBrowsingClient is injected (cache miss only)', async () => {
    // Create a checker without a Safe Browsing client
    const bareChecker = new URLChecker();
    await bareChecker.open();

    const indicators = await bareChecker.check(
      'Visit https://unknown-domain.com',
    );

    expect(indicators).toHaveLength(0);
    await bareChecker.close();
  });
});

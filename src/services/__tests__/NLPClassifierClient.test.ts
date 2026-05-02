/**
 * Unit tests for NLPClassifierClient
 *
 * Covers:
 *  - Successful API call returns mapped ThreatIndicator array
 *  - Non-2xx HTTP response returns empty array (graceful degradation)
 *  - Network error / fetch rejection returns empty array
 *  - Malformed JSON response returns empty array
 *  - Response with missing or invalid predictions field returns empty array
 *  - Predictions with invalid shape are filtered out
 *  - Configurable API URL
 *
 * Requirements: 2.2, 2.3, 2.4
 */

import { NLPClassifierClient, NLP_CLASSIFIER_API_URL } from '../NLPClassifierClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchMock(
  status: number,
  body: unknown,
  rejectWith?: Error,
): jest.Mock {
  if (rejectWith) {
    return jest.fn().mockRejectedValue(rejectWith);
  }
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NLPClassifierClient', () => {
  let client: NLPClassifierClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    client = new NLPClassifierClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Default API URL
  // -------------------------------------------------------------------------

  describe('default API URL', () => {
    it('exports the expected default API URL constant', () => {
      expect(NLP_CLASSIFIER_API_URL).toBe(
        'https://api.scam-nlp-classifier.example.com/v1/classify',
      );
    });

    it('uses the default URL when no argument is passed to the constructor', async () => {
      const fetchMock = makeFetchMock(200, { predictions: [] });
      global.fetch = fetchMock;

      await client.classify('hello');

      expect(fetchMock).toHaveBeenCalledWith(
        NLP_CLASSIFIER_API_URL,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('uses a custom URL when one is passed to the constructor', async () => {
      const customUrl = 'https://custom.example.com/classify';
      const customClient = new NLPClassifierClient(customUrl);
      const fetchMock = makeFetchMock(200, { predictions: [] });
      global.fetch = fetchMock;

      await customClient.classify('hello');

      expect(fetchMock).toHaveBeenCalledWith(
        customUrl,
        expect.any(Object),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Request shape
  // -------------------------------------------------------------------------

  describe('request shape', () => {
    it('sends a POST request with Content-Type application/json', async () => {
      const fetchMock = makeFetchMock(200, { predictions: [] });
      global.fetch = fetchMock;

      await client.classify('test message');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('sends the text in the request body as JSON', async () => {
      const fetchMock = makeFetchMock(200, { predictions: [] });
      global.fetch = fetchMock;

      const text = 'Act now or your account will be closed!';
      await client.classify(text);

      const callArgs = fetchMock.mock.calls[0][1];
      expect(JSON.parse(callArgs.body)).toEqual({ text });
    });
  });

  // -------------------------------------------------------------------------
  // Successful responses
  // -------------------------------------------------------------------------

  describe('successful responses', () => {
    it('returns an empty array when predictions is an empty array', async () => {
      global.fetch = makeFetchMock(200, { predictions: [] });

      const result = await client.classify('hello');

      expect(result).toEqual([]);
    });

    it('maps a single prediction to a ThreatIndicator', async () => {
      global.fetch = makeFetchMock(200, {
        predictions: [
          { type: 'urgency_language', confidence: 0.92, evidence: 'act now' },
        ],
      });

      const result = await client.classify('Act now!');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'urgency_language',
        confidence: 0.92,
        evidence: 'act now',
      });
    });

    it('maps multiple predictions to ThreatIndicator objects', async () => {
      global.fetch = makeFetchMock(200, {
        predictions: [
          { type: 'urgency_language', confidence: 0.88, evidence: 'urgent' },
          { type: 'impersonation', confidence: 0.95, evidence: 'irs' },
          { type: 'investment_scam', confidence: 0.76, evidence: 'guaranteed returns' },
        ],
      });

      const result = await client.classify('Urgent IRS notice — guaranteed returns!');

      expect(result).toHaveLength(3);
      const types = result.map(r => r.type);
      expect(types).toContain('urgency_language');
      expect(types).toContain('impersonation');
      expect(types).toContain('investment_scam');
    });

    it('preserves confidence and evidence from the API response', async () => {
      global.fetch = makeFetchMock(200, {
        predictions: [
          { type: 'impersonation', confidence: 0.97, evidence: 'bank of america' },
        ],
      });

      const result = await client.classify('Bank of America alert');

      expect(result[0].confidence).toBe(0.97);
      expect(result[0].evidence).toBe('bank of america');
    });
  });

  // -------------------------------------------------------------------------
  // Graceful degradation — HTTP errors
  // -------------------------------------------------------------------------

  describe('graceful degradation — HTTP errors', () => {
    it('returns an empty array for a 500 Internal Server Error', async () => {
      global.fetch = makeFetchMock(500, { error: 'server error' });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });

    it('returns an empty array for a 404 Not Found', async () => {
      global.fetch = makeFetchMock(404, { error: 'not found' });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });

    it('returns an empty array for a 429 Too Many Requests', async () => {
      global.fetch = makeFetchMock(429, { error: 'rate limited' });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });

    it('returns an empty array for a 401 Unauthorized', async () => {
      global.fetch = makeFetchMock(401, { error: 'unauthorized' });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Graceful degradation — network / parse errors
  // -------------------------------------------------------------------------

  describe('graceful degradation — network and parse errors', () => {
    it('returns an empty array when fetch rejects (network error)', async () => {
      global.fetch = makeFetchMock(0, null, new Error('Network request failed'));

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });

    it('returns an empty array when the response body is not valid JSON', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });

    it('returns an empty array when predictions field is missing', async () => {
      global.fetch = makeFetchMock(200, { result: 'ok' });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });

    it('returns an empty array when predictions is null', async () => {
      global.fetch = makeFetchMock(200, { predictions: null });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });

    it('returns an empty array when predictions is a string instead of array', async () => {
      global.fetch = makeFetchMock(200, { predictions: 'urgency_language' });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Malformed predictions filtering
  // -------------------------------------------------------------------------

  describe('malformed predictions filtering', () => {
    it('filters out predictions missing the type field', async () => {
      global.fetch = makeFetchMock(200, {
        predictions: [
          { confidence: 0.9, evidence: 'act now' }, // missing type
          { type: 'impersonation', confidence: 0.8, evidence: 'irs' },
        ],
      });

      const result = await client.classify('test');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('impersonation');
    });

    it('filters out predictions missing the confidence field', async () => {
      global.fetch = makeFetchMock(200, {
        predictions: [
          { type: 'urgency_language', evidence: 'act now' }, // missing confidence
          { type: 'investment_scam', confidence: 0.75, evidence: 'guaranteed returns' },
        ],
      });

      const result = await client.classify('test');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('investment_scam');
    });

    it('filters out predictions missing the evidence field', async () => {
      global.fetch = makeFetchMock(200, {
        predictions: [
          { type: 'urgency_language', confidence: 0.9 }, // missing evidence
          { type: 'impersonation', confidence: 0.85, evidence: 'bank of america' },
        ],
      });

      const result = await client.classify('test');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('impersonation');
    });

    it('returns an empty array when all predictions are malformed', async () => {
      global.fetch = makeFetchMock(200, {
        predictions: [
          { confidence: 0.9 },
          { type: 'urgency_language' },
          {},
        ],
      });

      const result = await client.classify('test');

      expect(result).toEqual([]);
    });
  });
});

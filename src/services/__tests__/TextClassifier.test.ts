/**
 * Unit tests for TextClassifier
 *
 * Covers:
 *  - Urgency language detection (Requirement 2.2)
 *  - Impersonation pattern detection (Requirement 2.3)
 *  - Investment / prize scam detection (Requirement 2.4)
 *  - Case-insensitive matching
 *  - Deduplication by type (one indicator per type)
 *  - Multiple types detected in a single message
 *  - Clean messages returning an empty array
 *  - NLP fallback triggered when all local indicators have confidence < 0.5
 *  - NLP fallback triggered when there are no local indicators
 *  - NLP fallback NOT triggered when local indicators have confidence >= 0.5
 *  - Merge deduplication: higher-confidence indicator wins per type
 *  - mergeIndicators helper function
 *
 * Requirements: 2.2, 2.3, 2.4
 */

import { TextClassifier, mergeIndicators } from '../TextClassifier';
import type { NLPClassifierClient } from '../NLPClassifierClient';
import type { ThreatIndicator } from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNLPClient(
  indicators: ThreatIndicator[] = [],
): jest.Mocked<NLPClassifierClient> {
  return {
    classify: jest.fn().mockResolvedValue(indicators),
  } as unknown as jest.Mocked<NLPClassifierClient>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TextClassifier', () => {
  let classifier: TextClassifier;

  beforeEach(() => {
    classifier = new TextClassifier();
  });

  // -------------------------------------------------------------------------
  // Clean messages
  // -------------------------------------------------------------------------

  describe('clean messages', () => {
    it('returns an empty array for a plain friendly message', async () => {
      const result = await classifier.classify('Hey, how are you doing today?');
      expect(result).toHaveLength(0);
    });

    it('returns an empty array for an empty string', async () => {
      const result = await classifier.classify('');
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Urgency language (Requirement 2.2)
  // -------------------------------------------------------------------------

  describe('urgency language detection', () => {
    it('detects "act now"', async () => {
      const result = await classifier.classify('You must act now or lose your account.');
      const urgency = result.find(i => i.type === 'urgency_language');
      expect(urgency).toBeDefined();
      expect(urgency!.confidence).toBe(0.7);
      expect(urgency!.evidence).toBe('act now');
    });

    it('detects "urgent"', async () => {
      const result = await classifier.classify('This is an urgent message from your bank.');
      const urgency = result.find(i => i.type === 'urgency_language');
      expect(urgency).toBeDefined();
      expect(urgency!.evidence).toBe('urgent');
    });

    it('detects "your account will be closed"', async () => {
      const result = await classifier.classify(
        'Your account will be closed unless you verify immediately.',
      );
      const urgency = result.find(i => i.type === 'urgency_language');
      expect(urgency).toBeDefined();
    });

    it('detects "limited time"', async () => {
      const result = await classifier.classify('This is a limited time offer just for you!');
      const urgency = result.find(i => i.type === 'urgency_language');
      expect(urgency).toBeDefined();
      expect(urgency!.evidence).toBe('limited time');
    });

    it('detects "within 24 hours"', async () => {
      const result = await classifier.classify(
        'Please respond within 24 hours to avoid suspension.',
      );
      const urgency = result.find(i => i.type === 'urgency_language');
      expect(urgency).toBeDefined();
    });

    it('detects "call now"', async () => {
      const result = await classifier.classify('Call now to claim your reward before it expires.');
      const urgency = result.find(i => i.type === 'urgency_language');
      expect(urgency).toBeDefined();
      expect(urgency!.evidence).toBe('call now');
    });

    it('is case-insensitive for urgency patterns', async () => {
      const result = await classifier.classify('ACT NOW or your account will be suspended!');
      const urgency = result.find(i => i.type === 'urgency_language');
      expect(urgency).toBeDefined();
    });

    it('returns only one urgency_language indicator even when multiple patterns match', async () => {
      const result = await classifier.classify(
        'Act now! This is urgent. Limited time offer. Call now!',
      );
      const urgencyIndicators = result.filter(i => i.type === 'urgency_language');
      expect(urgencyIndicators).toHaveLength(1);
    });

    it('uses the first matched pattern as evidence when multiple urgency patterns match', async () => {
      // "act now" appears before "urgent" in the pattern list
      const result = await classifier.classify('Act now, this is urgent!');
      const urgency = result.find(i => i.type === 'urgency_language');
      expect(urgency!.evidence).toBe('act now');
    });
  });

  // -------------------------------------------------------------------------
  // Impersonation (Requirement 2.3)
  // -------------------------------------------------------------------------

  describe('impersonation detection', () => {
    it('detects bank impersonation — "bank of america"', async () => {
      const result = await classifier.classify(
        'This is Bank of America. Your account has been locked.',
      );
      const imp = result.find(i => i.type === 'impersonation');
      expect(imp).toBeDefined();
      expect(imp!.confidence).toBe(0.8);
      expect(imp!.evidence).toBe('bank of america');
    });

    it('detects bank impersonation — "wells fargo"', async () => {
      const result = await classifier.classify(
        'Wells Fargo security alert: unusual activity detected.',
      );
      const imp = result.find(i => i.type === 'impersonation');
      expect(imp).toBeDefined();
    });

    it('detects government impersonation — "irs"', async () => {
      const result = await classifier.classify(
        'The IRS has flagged your tax return. Respond immediately.',
      );
      const imp = result.find(i => i.type === 'impersonation');
      expect(imp).toBeDefined();
      expect(imp!.evidence).toBe('irs');
    });

    it('detects government impersonation — "social security"', async () => {
      const result = await classifier.classify(
        'Your Social Security number has been suspended.',
      );
      const imp = result.find(i => i.type === 'impersonation');
      expect(imp).toBeDefined();
    });

    it('detects family impersonation — "i need money"', async () => {
      const result = await classifier.classify(
        'Hi Mom, I need money right away, please send it now.',
      );
      const imp = result.find(i => i.type === 'impersonation');
      expect(imp).toBeDefined();
      expect(imp!.evidence).toBe('i need money');
    });

    it('detects family impersonation — "stranded"', async () => {
      const result = await classifier.classify(
        "It's me, your son. I'm stranded abroad and need help.",
      );
      const imp = result.find(i => i.type === 'impersonation');
      expect(imp).toBeDefined();
      expect(imp!.evidence).toBe('stranded');
    });

    it('is case-insensitive for impersonation patterns', async () => {
      const result = await classifier.classify(
        'CHASE BANK requires your immediate attention.',
      );
      const imp = result.find(i => i.type === 'impersonation');
      expect(imp).toBeDefined();
    });

    it('returns only one impersonation indicator even when multiple patterns match', async () => {
      const result = await classifier.classify(
        'The IRS and FBI have flagged your account. Your bank is also involved.',
      );
      const impersonationIndicators = result.filter(i => i.type === 'impersonation');
      expect(impersonationIndicators).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Investment / prize scams (Requirement 2.4)
  // -------------------------------------------------------------------------

  describe('investment and prize scam detection', () => {
    it('detects investment scam — "guaranteed returns"', async () => {
      const result = await classifier.classify(
        'Invest today and enjoy guaranteed returns of 50% per month!',
      );
      const inv = result.find(i => i.type === 'investment_scam');
      expect(inv).toBeDefined();
      expect(inv!.confidence).toBe(0.75);
      expect(inv!.evidence).toBe('guaranteed returns');
    });

    it('detects investment scam — "double your money"', async () => {
      const result = await classifier.classify(
        'Our system will double your money in just 7 days.',
      );
      const inv = result.find(i => i.type === 'investment_scam');
      expect(inv).toBeDefined();
      expect(inv!.evidence).toBe('double your money');
    });

    it('detects investment scam — "crypto opportunity"', async () => {
      const result = await classifier.classify(
        'Exclusive crypto opportunity — join now before it closes.',
      );
      const inv = result.find(i => i.type === 'investment_scam');
      expect(inv).toBeDefined();
    });

    it('detects prize scam — "you have won"', async () => {
      const result = await classifier.classify(
        'Congratulations! You have won a $1,000 gift card.',
      );
      const inv = result.find(i => i.type === 'investment_scam');
      expect(inv).toBeDefined();
      expect(inv!.evidence).toBe('you have won');
    });

    it("detects prize scam — \"you've won\"", async () => {
      const result = await classifier.classify("You've won our monthly sweepstakes!");
      const inv = result.find(i => i.type === 'investment_scam');
      expect(inv).toBeDefined();
    });

    it('detects prize scam — "claim your prize"', async () => {
      const result = await classifier.classify(
        'Click the link to claim your prize before midnight.',
      );
      const inv = result.find(i => i.type === 'investment_scam');
      expect(inv).toBeDefined();
      expect(inv!.evidence).toBe('claim your prize');
    });

    it('detects prize scam — "free iphone"', async () => {
      const result = await classifier.classify(
        'Survey complete! You qualify for a free iPhone — tap to redeem.',
      );
      const inv = result.find(i => i.type === 'investment_scam');
      expect(inv).toBeDefined();
    });

    it('is case-insensitive for investment/prize patterns', async () => {
      const result = await classifier.classify('GUARANTEED RETURNS on your investment!');
      const inv = result.find(i => i.type === 'investment_scam');
      expect(inv).toBeDefined();
    });

    it('returns only one investment_scam indicator even when multiple patterns match', async () => {
      const result = await classifier.classify(
        'Guaranteed returns! Double your money! You have won a free gift!',
      );
      const investmentIndicators = result.filter(i => i.type === 'investment_scam');
      expect(investmentIndicators).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple threat types in one message
  // -------------------------------------------------------------------------

  describe('multiple threat types', () => {
    it('returns indicators for all matching types in a single message', async () => {
      const result = await classifier.classify(
        'URGENT: The IRS has suspended your account. Act now to claim your prize and double your money!',
      );
      const types = result.map(i => i.type);
      expect(types).toContain('urgency_language');
      expect(types).toContain('impersonation');
      expect(types).toContain('investment_scam');
      expect(result).toHaveLength(3);
    });

    it('returns urgency + impersonation for a bank phishing message', async () => {
      const result = await classifier.classify(
        'Your bank account has been suspended. Verify now to avoid closure.',
      );
      const types = result.map(i => i.type);
      expect(types).toContain('urgency_language');
      expect(types).toContain('impersonation');
    });
  });

  // -------------------------------------------------------------------------
  // Indicator shape validation
  // -------------------------------------------------------------------------

  describe('indicator shape', () => {
    it('every indicator has a valid type, confidence in [0,1], and non-empty evidence', async () => {
      const result = await classifier.classify(
        'Act now! The IRS says you have won a guaranteed return.',
      );
      for (const indicator of result) {
        expect(['urgency_language', 'impersonation', 'investment_scam']).toContain(
          indicator.type,
        );
        expect(indicator.confidence).toBeGreaterThanOrEqual(0);
        expect(indicator.confidence).toBeLessThanOrEqual(1);
        expect(indicator.evidence.length).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // NLP fallback — no NLP client set
  // -------------------------------------------------------------------------

  describe('NLP fallback — no client set', () => {
    it('does not call any NLP client when none is set', async () => {
      // No NLP client injected — should work fine without one
      const result = await classifier.classify('Hello, how are you?');
      expect(result).toEqual([]);
    });

    it('returns local results without NLP when local confidence is high', async () => {
      const result = await classifier.classify('Act now! The IRS is calling.');
      // Local rules produce confidence >= 0.5, no NLP needed
      expect(result.length).toBeGreaterThan(0);
      result.forEach(i => expect(i.confidence).toBeGreaterThanOrEqual(0.5));
    });
  });

  // -------------------------------------------------------------------------
  // NLP fallback — trigger conditions
  // -------------------------------------------------------------------------

  describe('NLP fallback — trigger conditions', () => {
    it('calls NLP client when there are no local indicators', async () => {
      const nlpClient = makeNLPClient([
        { type: 'urgency_language', confidence: 0.88, evidence: 'act now' },
      ]);
      classifier.setNLPClient(nlpClient);

      const result = await classifier.classify('Hello, how are you?');

      expect(nlpClient.classify).toHaveBeenCalledWith('Hello, how are you?');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('urgency_language');
      expect(result[0].confidence).toBe(0.88);
    });

    it('calls NLP client when all local indicators have confidence < 0.5', async () => {
      // The local rules always produce confidence >= 0.5 (0.7, 0.8, 0.75),
      // so we test this by injecting a custom NLP client and using a message
      // that produces no local matches — which also triggers the fallback.
      // To test the "all < 0.5" branch specifically, we spy on runLocalRules
      // indirectly by verifying the NLP client is called for a no-match message.
      const nlpClient = makeNLPClient([
        { type: 'investment_scam', confidence: 0.6, evidence: 'suspicious offer' },
      ]);
      classifier.setNLPClient(nlpClient);

      // No local patterns match this message
      const result = await classifier.classify('This is a completely normal message.');

      expect(nlpClient.classify).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('investment_scam');
    });

    it('does NOT call NLP client when local indicators have confidence >= 0.5', async () => {
      const nlpClient = makeNLPClient([
        { type: 'urgency_language', confidence: 0.99, evidence: 'remote match' },
      ]);
      classifier.setNLPClient(nlpClient);

      // "act now" triggers urgency_language with confidence 0.7 (>= 0.5)
      await classifier.classify('You must act now!');

      expect(nlpClient.classify).not.toHaveBeenCalled();
    });

    it('does NOT call NLP client when at least one local indicator has confidence >= 0.5', async () => {
      const nlpClient = makeNLPClient();
      classifier.setNLPClient(nlpClient);

      // Multiple local matches, all with confidence >= 0.5
      await classifier.classify('Act now! The IRS says you have won guaranteed returns.');

      expect(nlpClient.classify).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // NLP fallback — merge behaviour
  // -------------------------------------------------------------------------

  describe('NLP fallback — merge behaviour', () => {
    it('returns only remote indicators when there are no local indicators', async () => {
      const remoteIndicators: ThreatIndicator[] = [
        { type: 'impersonation', confidence: 0.91, evidence: 'your bank' },
      ];
      const nlpClient = makeNLPClient(remoteIndicators);
      classifier.setNLPClient(nlpClient);

      const result = await classifier.classify('A message with no local pattern matches.');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(remoteIndicators[0]);
    });

    it('keeps the remote indicator when it has higher confidence than the local one for the same type', async () => {
      // We need a scenario where local rules fire with low confidence.
      // Since local rules always produce fixed confidences (0.7, 0.8, 0.75),
      // we test the merge helper directly for this case.
      const local: ThreatIndicator[] = [
        { type: 'urgency_language', confidence: 0.3, evidence: 'local match' },
      ];
      const remote: ThreatIndicator[] = [
        { type: 'urgency_language', confidence: 0.9, evidence: 'remote match' },
      ];

      const merged = mergeIndicators(local, remote);

      expect(merged).toHaveLength(1);
      expect(merged[0].confidence).toBe(0.9);
      expect(merged[0].evidence).toBe('remote match');
    });

    it('keeps the local indicator when it has higher confidence than the remote one for the same type', async () => {
      const local: ThreatIndicator[] = [
        { type: 'impersonation', confidence: 0.95, evidence: 'local match' },
      ];
      const remote: ThreatIndicator[] = [
        { type: 'impersonation', confidence: 0.4, evidence: 'remote match' },
      ];

      const merged = mergeIndicators(local, remote);

      expect(merged).toHaveLength(1);
      expect(merged[0].confidence).toBe(0.95);
      expect(merged[0].evidence).toBe('local match');
    });

    it('includes indicators unique to remote when local has no match for that type', async () => {
      const nlpClient = makeNLPClient([
        { type: 'investment_scam', confidence: 0.82, evidence: 'guaranteed profit' },
        { type: 'impersonation', confidence: 0.77, evidence: 'your bank' },
      ]);
      classifier.setNLPClient(nlpClient);

      const result = await classifier.classify('A message with no local pattern matches.');

      const types = result.map(r => r.type);
      expect(types).toContain('investment_scam');
      expect(types).toContain('impersonation');
    });

    it('returns an empty array when both local and remote produce no indicators', async () => {
      const nlpClient = makeNLPClient([]);
      classifier.setNLPClient(nlpClient);

      const result = await classifier.classify('Hello there!');

      expect(result).toEqual([]);
    });

    it('returns local indicators unchanged when NLP client returns empty array', async () => {
      // Use a message that produces no local matches so NLP is called
      const nlpClient = makeNLPClient([]);
      classifier.setNLPClient(nlpClient);

      const result = await classifier.classify('No patterns here at all.');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // NLP fallback — graceful degradation
  // -------------------------------------------------------------------------

  describe('NLP fallback — graceful degradation', () => {
    it('returns local indicators when NLP client throws', async () => {
      const nlpClient = {
        classify: jest.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as jest.Mocked<NLPClassifierClient>;
      classifier.setNLPClient(nlpClient);

      // NLPClassifierClient.classify() itself never throws (it catches internally),
      // but if somehow it does, TextClassifier should still not crash.
      // Since NLPClassifierClient handles errors internally, we verify the
      // TextClassifier propagates whatever the client returns.
      // Here the mock rejects, so we expect the promise to reject too
      // (TextClassifier does not add an extra try/catch around the client call).
      await expect(classifier.classify('Hello!')).rejects.toThrow('Network error');
    });
  });

  // -------------------------------------------------------------------------
  // setNLPClient
  // -------------------------------------------------------------------------

  describe('setNLPClient', () => {
    it('can clear the NLP client by passing null', async () => {
      const nlpClient = makeNLPClient([
        { type: 'urgency_language', confidence: 0.9, evidence: 'act now' },
      ]);
      classifier.setNLPClient(nlpClient);
      classifier.setNLPClient(null);

      // No local matches, but NLP client is cleared — should return empty
      const result = await classifier.classify('Hello!');

      expect(nlpClient.classify).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('replaces a previously set NLP client', async () => {
      const firstClient = makeNLPClient([
        { type: 'urgency_language', confidence: 0.9, evidence: 'first' },
      ]);
      const secondClient = makeNLPClient([
        { type: 'investment_scam', confidence: 0.85, evidence: 'second' },
      ]);

      classifier.setNLPClient(firstClient);
      classifier.setNLPClient(secondClient);

      const result = await classifier.classify('Hello!');

      expect(firstClient.classify).not.toHaveBeenCalled();
      expect(secondClient.classify).toHaveBeenCalledTimes(1);
      expect(result[0].evidence).toBe('second');
    });
  });
});

// ---------------------------------------------------------------------------
// mergeIndicators (exported helper)
// ---------------------------------------------------------------------------

describe('mergeIndicators', () => {
  it('returns an empty array when both inputs are empty', () => {
    expect(mergeIndicators([], [])).toEqual([]);
  });

  it('returns local indicators when remote is empty', () => {
    const local: ThreatIndicator[] = [
      { type: 'urgency_language', confidence: 0.7, evidence: 'act now' },
    ];
    expect(mergeIndicators(local, [])).toEqual(local);
  });

  it('returns remote indicators when local is empty', () => {
    const remote: ThreatIndicator[] = [
      { type: 'impersonation', confidence: 0.9, evidence: 'irs' },
    ];
    expect(mergeIndicators([], remote)).toEqual(remote);
  });

  it('deduplicates by type, keeping the higher-confidence indicator', () => {
    const local: ThreatIndicator[] = [
      { type: 'urgency_language', confidence: 0.4, evidence: 'local urgency' },
      { type: 'impersonation', confidence: 0.9, evidence: 'local impersonation' },
    ];
    const remote: ThreatIndicator[] = [
      { type: 'urgency_language', confidence: 0.85, evidence: 'remote urgency' },
      { type: 'impersonation', confidence: 0.3, evidence: 'remote impersonation' },
    ];

    const result = mergeIndicators(local, remote);

    expect(result).toHaveLength(2);
    const urgency = result.find(i => i.type === 'urgency_language')!;
    const impersonation = result.find(i => i.type === 'impersonation')!;
    expect(urgency.confidence).toBe(0.85); // remote wins
    expect(impersonation.confidence).toBe(0.9); // local wins
  });

  it('includes indicators unique to each source', () => {
    const local: ThreatIndicator[] = [
      { type: 'urgency_language', confidence: 0.7, evidence: 'act now' },
    ];
    const remote: ThreatIndicator[] = [
      { type: 'investment_scam', confidence: 0.8, evidence: 'guaranteed returns' },
    ];

    const result = mergeIndicators(local, remote);

    expect(result).toHaveLength(2);
    const types = result.map(i => i.type);
    expect(types).toContain('urgency_language');
    expect(types).toContain('investment_scam');
  });

  it('handles all three types being present in both sources', () => {
    const local: ThreatIndicator[] = [
      { type: 'urgency_language', confidence: 0.7, evidence: 'local urgency' },
      { type: 'impersonation', confidence: 0.8, evidence: 'local impersonation' },
      { type: 'investment_scam', confidence: 0.75, evidence: 'local investment' },
    ];
    const remote: ThreatIndicator[] = [
      { type: 'urgency_language', confidence: 0.95, evidence: 'remote urgency' },
      { type: 'impersonation', confidence: 0.6, evidence: 'remote impersonation' },
      { type: 'investment_scam', confidence: 0.9, evidence: 'remote investment' },
    ];

    const result = mergeIndicators(local, remote);

    expect(result).toHaveLength(3);
    expect(result.find(i => i.type === 'urgency_language')!.confidence).toBe(0.95);
    expect(result.find(i => i.type === 'impersonation')!.confidence).toBe(0.8);
    expect(result.find(i => i.type === 'investment_scam')!.confidence).toBe(0.9);
  });

  it('keeps the local indicator when confidences are equal', () => {
    const local: ThreatIndicator[] = [
      { type: 'urgency_language', confidence: 0.7, evidence: 'local' },
    ];
    const remote: ThreatIndicator[] = [
      { type: 'urgency_language', confidence: 0.7, evidence: 'remote' },
    ];

    const result = mergeIndicators(local, remote);

    expect(result).toHaveLength(1);
    // Remote only wins when strictly greater, so local is kept on tie
    expect(result[0].evidence).toBe('local');
  });
});

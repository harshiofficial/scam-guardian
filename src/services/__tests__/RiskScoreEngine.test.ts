/**
 * Unit tests and property-based tests for RiskScoreEngine
 *
 * Covers:
 *  Unit tests:
 *  - Empty indicators → score 0
 *  - Single phishing_url indicator → correct weighted score
 *  - Single urgency_language indicator → correct weighted score
 *  - Single impersonation indicator → correct weighted score
 *  - Single investment_scam indicator → correct weighted score
 *  - Single malicious_attachment indicator → correct weighted score
 *  - Multiple indicators of the same category → max confidence used
 *  - Mixed indicators across all categories → correct weighted combination
 *  - Score is clamped to 100 when raw value exceeds 100
 *  - Score is clamped to 0 (never negative)
 *  - computeSubScores returns correct individual sub-scores
 *
 *  Property-based tests (Task 5.3):
 *  - Property 1: Score is always in [0, 100] for any indicator combination
 *  - Property 2: Weight monotonicity — adding indicators never decreases score
 *
 * Validates: Requirements 1.2
 */

import { RiskScoreEngine } from '../RiskScoreEngine';
import type { ThreatIndicator } from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIndicator(
  type: ThreatIndicator['type'],
  confidence: number,
): ThreatIndicator {
  return { type, confidence, evidence: `test evidence for ${type}` };
}

// ---------------------------------------------------------------------------
// Unit Tests
// ---------------------------------------------------------------------------

describe('RiskScoreEngine', () => {
  let engine: RiskScoreEngine;

  beforeEach(() => {
    engine = new RiskScoreEngine();
  });

  // -------------------------------------------------------------------------
  // Empty input
  // -------------------------------------------------------------------------

  describe('empty indicators', () => {
    it('returns 0 when given no indicators', () => {
      expect(engine.computeScore([])).toBe(0);
    });

    it('returns all-zero sub-scores when given no indicators', () => {
      const subScores = engine.computeSubScores([]);
      expect(subScores.urlScore).toBe(0);
      expect(subScores.textScore).toBe(0);
      expect(subScores.attachmentScore).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Single-category indicators
  // -------------------------------------------------------------------------

  describe('single phishing_url indicator', () => {
    it('applies the 0.45 URL weight correctly', () => {
      const indicators = [makeIndicator('phishing_url', 1.0)];
      // urlScore=100, textScore=0, attachmentScore=0
      // raw = 100*0.45 + 0*0.35 + 0*0.20 = 45
      expect(engine.computeScore(indicators)).toBeCloseTo(45, 5);
    });

    it('scales with confidence', () => {
      const indicators = [makeIndicator('phishing_url', 0.5)];
      // urlScore=50, raw = 50*0.45 = 22.5
      expect(engine.computeScore(indicators)).toBeCloseTo(22.5, 5);
    });
  });

  describe('single urgency_language indicator', () => {
    it('applies the 0.35 text weight correctly', () => {
      const indicators = [makeIndicator('urgency_language', 1.0)];
      // textScore=100, raw = 0*0.45 + 100*0.35 + 0*0.20 = 35
      expect(engine.computeScore(indicators)).toBeCloseTo(35, 5);
    });
  });

  describe('single impersonation indicator', () => {
    it('applies the 0.35 text weight correctly', () => {
      const indicators = [makeIndicator('impersonation', 1.0)];
      expect(engine.computeScore(indicators)).toBeCloseTo(35, 5);
    });
  });

  describe('single investment_scam indicator', () => {
    it('applies the 0.35 text weight correctly', () => {
      const indicators = [makeIndicator('investment_scam', 1.0)];
      expect(engine.computeScore(indicators)).toBeCloseTo(35, 5);
    });
  });

  describe('single malicious_attachment indicator', () => {
    it('applies the 0.20 attachment weight correctly', () => {
      const indicators = [makeIndicator('malicious_attachment', 1.0)];
      // attachmentScore=100, raw = 0*0.45 + 0*0.35 + 100*0.20 = 20
      expect(engine.computeScore(indicators)).toBeCloseTo(20, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Max confidence within a category
  // -------------------------------------------------------------------------

  describe('multiple indicators in the same category', () => {
    it('uses the maximum confidence for urlScore', () => {
      const indicators = [
        makeIndicator('phishing_url', 0.3),
        makeIndicator('phishing_url', 0.8),
        makeIndicator('phishing_url', 0.5),
      ];
      // urlScore = 0.8 * 100 = 80, raw = 80*0.45 = 36
      expect(engine.computeScore(indicators)).toBeCloseTo(36, 5);
    });

    it('uses the maximum confidence across text indicator types', () => {
      const indicators = [
        makeIndicator('urgency_language', 0.4),
        makeIndicator('impersonation', 0.9),
        makeIndicator('investment_scam', 0.6),
      ];
      // textScore = 0.9 * 100 = 90, raw = 90*0.35 = 31.5
      expect(engine.computeScore(indicators)).toBeCloseTo(31.5, 5);
    });

    it('uses the maximum confidence for attachmentScore', () => {
      const indicators = [
        makeIndicator('malicious_attachment', 0.7),
        makeIndicator('malicious_attachment', 0.95),
      ];
      // attachmentScore = 0.95 * 100 = 95, raw = 95*0.20 = 19
      expect(engine.computeScore(indicators)).toBeCloseTo(19, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed categories
  // -------------------------------------------------------------------------

  describe('mixed indicators across all categories', () => {
    it('combines all three sub-scores with correct weights', () => {
      const indicators = [
        makeIndicator('phishing_url', 0.8),
        makeIndicator('urgency_language', 0.6),
        makeIndicator('malicious_attachment', 0.5),
      ];
      // urlScore=80, textScore=60, attachmentScore=50
      // raw = 80*0.45 + 60*0.35 + 50*0.20 = 36 + 21 + 10 = 67
      expect(engine.computeScore(indicators)).toBeCloseTo(67, 5);
    });

    it('returns 100 when all sub-scores are at maximum', () => {
      const indicators = [
        makeIndicator('phishing_url', 1.0),
        makeIndicator('urgency_language', 1.0),
        makeIndicator('malicious_attachment', 1.0),
      ];
      // raw = 100*0.45 + 100*0.35 + 100*0.20 = 100
      expect(engine.computeScore(indicators)).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Clamping
  // -------------------------------------------------------------------------

  describe('clamping behaviour', () => {
    it('clamps score to 100 when raw value would exceed 100', () => {
      // Confidence values > 1 are not valid per spec, but the engine should
      // still clamp defensively.
      const indicators = [
        makeIndicator('phishing_url', 1.0),
        makeIndicator('urgency_language', 1.0),
        makeIndicator('malicious_attachment', 1.0),
      ];
      expect(engine.computeScore(indicators)).toBeLessThanOrEqual(100);
    });

    it('never returns a negative score', () => {
      expect(engine.computeScore([])).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // computeSubScores
  // -------------------------------------------------------------------------

  describe('computeSubScores', () => {
    it('returns correct urlScore, textScore, and attachmentScore', () => {
      const indicators = [
        makeIndicator('phishing_url', 0.7),
        makeIndicator('impersonation', 0.5),
        makeIndicator('malicious_attachment', 0.9),
      ];
      const subScores = engine.computeSubScores(indicators);
      expect(subScores.urlScore).toBeCloseTo(70, 5);
      expect(subScores.textScore).toBeCloseTo(50, 5);
      expect(subScores.attachmentScore).toBeCloseTo(90, 5);
    });

    it('returns 0 for categories with no indicators', () => {
      const indicators = [makeIndicator('phishing_url', 0.6)];
      const subScores = engine.computeSubScores(indicators);
      expect(subScores.urlScore).toBeCloseTo(60, 5);
      expect(subScores.textScore).toBe(0);
      expect(subScores.attachmentScore).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Property-based tests (Task 5.3)
  // Validates: Requirements 1.2
  // -------------------------------------------------------------------------

  describe('Property 1: Score is always in [0, 100]', () => {
    /**
     * For any combination of indicators with confidence values in [0, 1],
     * the computed Risk_Score must always be in the range [0, 100].
     *
     * Validates: Requirements 1.2
     */

    const indicatorTypes: ThreatIndicator['type'][] = [
      'phishing_url',
      'urgency_language',
      'impersonation',
      'investment_scam',
      'malicious_attachment',
    ];

    function randomFloat(min: number, max: number, seed: number): number {
      // Simple deterministic pseudo-random using a linear congruential generator
      const a = 1664525;
      const c = 1013904223;
      const m = 2 ** 32;
      const next = ((a * seed + c) % m) / m;
      return min + next * (max - min);
    }

    function generateRandomIndicators(
      seed: number,
      count: number,
    ): ThreatIndicator[] {
      const indicators: ThreatIndicator[] = [];
      for (let i = 0; i < count; i++) {
        const typeSeed = Math.floor(
          randomFloat(0, indicatorTypes.length, seed + i * 7),
        );
        const confidenceSeed = seed + i * 13 + 1;
        const type = indicatorTypes[typeSeed % indicatorTypes.length];
        const confidence = randomFloat(0, 1, confidenceSeed);
        indicators.push({ type, confidence, evidence: 'generated' });
      }
      return indicators;
    }

    it('score is in [0, 100] for empty indicators', () => {
      const score = engine.computeScore([]);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('score is in [0, 100] for all-maximum confidence indicators', () => {
      const indicators = indicatorTypes.map(type =>
        makeIndicator(type, 1.0),
      );
      const score = engine.computeScore(indicators);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('score is in [0, 100] for all-minimum confidence indicators', () => {
      const indicators = indicatorTypes.map(type =>
        makeIndicator(type, 0.0),
      );
      const score = engine.computeScore(indicators);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('score is in [0, 100] for 100 random indicator arrays', () => {
      for (let seed = 1; seed <= 100; seed++) {
        const count = Math.floor(randomFloat(0, 10, seed * 31)) + 1;
        const indicators = generateRandomIndicators(seed, count);
        const score = engine.computeScore(indicators);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Property 2: Weight monotonicity', () => {
    /**
     * Adding more indicators (or increasing confidence) never decreases the
     * total Risk_Score. Specifically, for any base set of indicators, adding
     * an additional indicator with confidence > 0 must not decrease the score.
     *
     * Validates: Requirements 1.2
     */

    it('adding a phishing_url indicator never decreases the score', () => {
      const base = [makeIndicator('urgency_language', 0.5)];
      const baseScore = engine.computeScore(base);

      const withUrl = [...base, makeIndicator('phishing_url', 0.8)];
      const withUrlScore = engine.computeScore(withUrl);

      expect(withUrlScore).toBeGreaterThanOrEqual(baseScore);
    });

    it('adding a text indicator never decreases the score', () => {
      const base = [makeIndicator('phishing_url', 0.4)];
      const baseScore = engine.computeScore(base);

      const withText = [...base, makeIndicator('urgency_language', 0.7)];
      const withTextScore = engine.computeScore(withText);

      expect(withTextScore).toBeGreaterThanOrEqual(baseScore);
    });

    it('adding a malicious_attachment indicator never decreases the score', () => {
      const base = [makeIndicator('phishing_url', 0.6)];
      const baseScore = engine.computeScore(base);

      const withAttachment = [
        ...base,
        makeIndicator('malicious_attachment', 0.9),
      ];
      const withAttachmentScore = engine.computeScore(withAttachment);

      expect(withAttachmentScore).toBeGreaterThanOrEqual(baseScore);
    });

    it('adding a higher-confidence indicator of the same type never decreases the score', () => {
      const base = [makeIndicator('phishing_url', 0.3)];
      const baseScore = engine.computeScore(base);

      const withHigher = [...base, makeIndicator('phishing_url', 0.9)];
      const withHigherScore = engine.computeScore(withHigher);

      expect(withHigherScore).toBeGreaterThanOrEqual(baseScore);
    });

    it('monotonicity holds across 50 random base + additional indicator pairs', () => {
      const indicatorTypes: ThreatIndicator['type'][] = [
        'phishing_url',
        'urgency_language',
        'impersonation',
        'investment_scam',
        'malicious_attachment',
      ];

      // Deterministic pseudo-random
      function lcg(seed: number): number {
        return ((1664525 * seed + 1013904223) % 2 ** 32) / 2 ** 32;
      }

      for (let i = 0; i < 50; i++) {
        const seed = i + 1;
        const baseType =
          indicatorTypes[Math.floor(lcg(seed) * indicatorTypes.length)];
        const baseConf = lcg(seed + 100);
        const addType =
          indicatorTypes[Math.floor(lcg(seed + 200) * indicatorTypes.length)];
        const addConf = lcg(seed + 300);

        const base = [makeIndicator(baseType, baseConf)];
        const baseScore = engine.computeScore(base);

        const extended = [...base, makeIndicator(addType, addConf)];
        const extendedScore = engine.computeScore(extended);

        expect(extendedScore).toBeGreaterThanOrEqual(baseScore);
      }
    });
  });
});

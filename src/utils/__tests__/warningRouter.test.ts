/**
 * Unit tests for warningRouter
 *
 * Verifies that the correct Warning UI component is selected based on the
 * riskScore of a ThreatAnalysis.
 *
 * Requirements: 1.3, 1.4, 1.5
 */

import {
  getWarningLevel,
  shouldShowFullScreenWarning,
  shouldShowCautionBanner,
} from '../warningRouter';
import type { ThreatAnalysis } from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeThreatAnalysis(riskScore: number): ThreatAnalysis {
  return {
    messageId: 'msg-test',
    riskScore,
    indicators: [],
    analyzedAt: new Date('2024-06-01T12:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// getWarningLevel
// ---------------------------------------------------------------------------

describe('getWarningLevel()', () => {
  // -------------------------------------------------------------------------
  // Requirement 1.3 — riskScore ≥ 70 → FullScreenWarning
  // -------------------------------------------------------------------------

  describe('riskScore ≥ 70 → full-screen (Requirement 1.3)', () => {
    it('returns "full-screen" for riskScore 70 (exact boundary)', () => {
      expect(getWarningLevel(makeThreatAnalysis(70))).toBe('full-screen');
    });

    it('returns "full-screen" for riskScore 85', () => {
      expect(getWarningLevel(makeThreatAnalysis(85))).toBe('full-screen');
    });

    it('returns "full-screen" for riskScore 100 (maximum)', () => {
      expect(getWarningLevel(makeThreatAnalysis(100))).toBe('full-screen');
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.4 — 40 ≤ riskScore < 70 → CautionBanner
  // -------------------------------------------------------------------------

  describe('40 ≤ riskScore < 70 → caution-banner (Requirement 1.4)', () => {
    it('returns "caution-banner" for riskScore 55', () => {
      expect(getWarningLevel(makeThreatAnalysis(55))).toBe('caution-banner');
    });

    it('returns "caution-banner" for riskScore 40 (lower boundary)', () => {
      expect(getWarningLevel(makeThreatAnalysis(40))).toBe('caution-banner');
    });

    it('returns "caution-banner" for riskScore 69 (upper boundary, just below full-screen)', () => {
      expect(getWarningLevel(makeThreatAnalysis(69))).toBe('caution-banner');
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.5 — riskScore < 40 → no warning
  // -------------------------------------------------------------------------

  describe('riskScore < 40 → none (Requirement 1.5)', () => {
    it('returns "none" for riskScore 30', () => {
      expect(getWarningLevel(makeThreatAnalysis(30))).toBe('none');
    });

    it('returns "none" for riskScore 0 (minimum)', () => {
      expect(getWarningLevel(makeThreatAnalysis(0))).toBe('none');
    });

    it('returns "none" for riskScore 39 (just below caution-banner threshold)', () => {
      expect(getWarningLevel(makeThreatAnalysis(39))).toBe('none');
    });
  });
});

// ---------------------------------------------------------------------------
// shouldShowFullScreenWarning — convenience wrapper
// ---------------------------------------------------------------------------

describe('shouldShowFullScreenWarning()', () => {
  it('returns true for riskScore 70 (Requirement 1.3)', () => {
    expect(shouldShowFullScreenWarning(makeThreatAnalysis(70))).toBe(true);
  });

  it('returns true for riskScore 85', () => {
    expect(shouldShowFullScreenWarning(makeThreatAnalysis(85))).toBe(true);
  });

  it('returns false for riskScore 55 (caution-banner range)', () => {
    expect(shouldShowFullScreenWarning(makeThreatAnalysis(55))).toBe(false);
  });

  it('returns false for riskScore 30 (no warning range)', () => {
    expect(shouldShowFullScreenWarning(makeThreatAnalysis(30))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldShowCautionBanner — convenience wrapper
// ---------------------------------------------------------------------------

describe('shouldShowCautionBanner()', () => {
  it('returns true for riskScore 55 (Requirement 1.4)', () => {
    expect(shouldShowCautionBanner(makeThreatAnalysis(55))).toBe(true);
  });

  it('returns true for riskScore 40 (lower boundary)', () => {
    expect(shouldShowCautionBanner(makeThreatAnalysis(40))).toBe(true);
  });

  it('returns false for riskScore 70 (full-screen range)', () => {
    expect(shouldShowCautionBanner(makeThreatAnalysis(70))).toBe(false);
  });

  it('returns false for riskScore 30 (no warning range)', () => {
    expect(shouldShowCautionBanner(makeThreatAnalysis(30))).toBe(false);
  });
});

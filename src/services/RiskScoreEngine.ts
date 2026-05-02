/**
 * RiskScoreEngine
 *
 * Aggregates threat signals from all Threat_Analyzer sub-modules into a
 * single Risk_Score in the range [0, 100].
 *
 * Weighted formula (from design doc):
 *   riskScore = clamp(
 *     urlScore        * 0.45 +
 *     textScore       * 0.35 +
 *     attachmentScore * 0.20,
 *     0, 100
 *   )
 *
 * Sub-score derivation:
 *   urlScore        = max confidence of all `phishing_url` indicators × 100
 *   textScore       = max confidence of all `urgency_language` | `impersonation` | `investment_scam` indicators × 100
 *   attachmentScore = max confidence of all `malicious_attachment` indicators × 100
 *
 * If no indicators of a given category are present the sub-score is 0.
 *
 * Requirements: 1.2
 */

import type { ThreatIndicator } from '../models/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubScores {
  urlScore: number;
  textScore: number;
  attachmentScore: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a numeric value to the inclusive range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns the maximum confidence value (0–1) from a filtered subset of
 * indicators, or 0 if the subset is empty.
 */
function maxConfidence(indicators: ThreatIndicator[]): number {
  if (indicators.length === 0) {
    return 0;
  }
  return Math.max(...indicators.map(i => i.confidence));
}

// ---------------------------------------------------------------------------
// RiskScoreEngine
// ---------------------------------------------------------------------------

export class RiskScoreEngine {
  /**
   * Derives the three weighted sub-scores from an array of ThreatIndicators.
   *
   * Each sub-score is in the range [0, 100].
   *
   * @param indicators - Array of ThreatIndicator objects produced by the
   *   URLChecker, TextClassifier, and AttachmentScanner sub-modules.
   * @returns An object containing urlScore, textScore, and attachmentScore.
   */
  computeSubScores(indicators: ThreatIndicator[]): SubScores {
    const urlIndicators = indicators.filter(i => i.type === 'phishing_url');
    const textIndicators = indicators.filter(
      i =>
        i.type === 'urgency_language' ||
        i.type === 'impersonation' ||
        i.type === 'investment_scam',
    );
    const attachmentIndicators = indicators.filter(
      i => i.type === 'malicious_attachment',
    );

    return {
      urlScore: maxConfidence(urlIndicators) * 100,
      textScore: maxConfidence(textIndicators) * 100,
      attachmentScore: maxConfidence(attachmentIndicators) * 100,
    };
  }

  /**
   * Computes the overall Risk_Score for a message given its ThreatIndicators.
   *
   * The score is clamped to [0, 100].
   *
   * @param indicators - Array of ThreatIndicator objects.
   * @returns A numeric Risk_Score in the range [0, 100].
   */
  computeScore(indicators: ThreatIndicator[]): number {
    const { urlScore, textScore, attachmentScore } =
      this.computeSubScores(indicators);

    const raw =
      urlScore * 0.45 + textScore * 0.35 + attachmentScore * 0.20;

    return clamp(raw, 0, 100);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const riskScoreEngine = new RiskScoreEngine();

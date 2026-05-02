/**
 * warningRouter
 *
 * Determines which Warning UI component (if any) should be rendered for a
 * given ThreatAnalysis based on its riskScore.
 *
 * Routing rules (Requirements 1.3, 1.4, 1.5):
 *   riskScore ≥ 70          → FullScreenWarning
 *   40 ≤ riskScore < 70     → CautionBanner
 *   riskScore < 40          → no warning (null)
 */

import type { ThreatAnalysis } from '../models/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three possible warning states for a given riskScore. */
export type WarningLevel = 'full-screen' | 'caution-banner' | 'none';

// ---------------------------------------------------------------------------
// Core routing function
// ---------------------------------------------------------------------------

/**
 * Returns the WarningLevel that should be displayed for the given
 * ThreatAnalysis.
 *
 * @param analysis - The ThreatAnalysis produced for a scanned message.
 * @returns The appropriate WarningLevel.
 *
 * Requirements: 1.3, 1.4, 1.5
 */
export function getWarningLevel(analysis: ThreatAnalysis): WarningLevel {
  const { riskScore } = analysis;

  if (riskScore >= 70) {
    return 'full-screen';
  }

  if (riskScore >= 40) {
    return 'caution-banner';
  }

  return 'none';
}

/**
 * Returns true when the given ThreatAnalysis should trigger a FullScreenWarning.
 * Convenience wrapper around getWarningLevel.
 *
 * Requirement 1.3
 */
export function shouldShowFullScreenWarning(analysis: ThreatAnalysis): boolean {
  return getWarningLevel(analysis) === 'full-screen';
}

/**
 * Returns true when the given ThreatAnalysis should trigger a CautionBanner.
 * Convenience wrapper around getWarningLevel.
 *
 * Requirement 1.4
 */
export function shouldShowCautionBanner(analysis: ThreatAnalysis): boolean {
  return getWarningLevel(analysis) === 'caution-banner';
}

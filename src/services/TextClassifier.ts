/**
 * TextClassifier
 *
 * Analyzes message text for scam patterns using local regex rule sets.
 * Detects urgency language, impersonation patterns, and investment/prize offers.
 *
 * When ALL local indicators have confidence < 0.5 (or there are no local
 * indicators), the remote NLP Scam Classifier API is called as a fallback.
 * Results from both sources are merged and deduplicated by type, keeping the
 * indicator with the higher confidence for each type.
 *
 * Requirements: 2.2, 2.3, 2.4
 */

import type { ThreatIndicator } from '../models/types';
import type { NLPClassifierClient } from './NLPClassifierClient';

// ---------------------------------------------------------------------------
// Rule sets
// ---------------------------------------------------------------------------

/**
 * Urgency language patterns — phrases that pressure the recipient to act fast.
 * Requirement 2.2
 */
const URGENCY_PATTERNS: string[] = [
  'act now',
  'act immediately',
  'urgent',
  'immediately',
  'your account will be closed',
  'account suspended',
  'limited time',
  'expires today',
  'expires in',
  'last chance',
  'final notice',
  'respond within',
  'within 24 hours',
  'within 48 hours',
  'time sensitive',
  'time-sensitive',
  "don't delay",
  'do not delay',
  'verify now',
  'confirm now',
  'click now',
  'call now',
  'contact us immediately',
];

/**
 * Impersonation patterns — phrases that mimic trusted institutions or people.
 * Requirement 2.3
 */
const IMPERSONATION_PATTERNS: string[] = [
  // Bank impersonation
  'bank of america',
  'chase bank',
  'wells fargo',
  'citibank',
  'barclays',
  'hsbc',
  'lloyds',
  'natwest',
  'your bank',
  'your financial institution',
  // Government impersonation
  'irs',
  'hmrc',
  'social security',
  'medicare',
  'government grant',
  'federal bureau',
  'fbi',
  'police department',
  'court notice',
  'tax authority',
  // Family impersonation
  "i'm in trouble",
  'i am in trouble',
  'i need money',
  'send money urgently',
  'stranded',
  'help me',
  "don't tell mom",
  "don't tell dad",
  "don't tell anyone",
];

/**
 * Investment and prize scam patterns.
 * Requirement 2.4
 */
const INVESTMENT_SCAM_PATTERNS: string[] = [
  // Investment scams
  'guaranteed returns',
  'guaranteed profit',
  'risk-free investment',
  'double your money',
  'triple your money',
  'crypto opportunity',
  'bitcoin opportunity',
  'forex trading',
  'passive income',
  'financial freedom',
  'get rich',
  // Prize scams
  'you have won',
  "you've won",
  'congratulations you',
  'winner selected',
  'claim your prize',
  'claim your reward',
  'lottery winner',
  'sweepstakes winner',
  'free gift',
  'free iphone',
  'free vacation',
];

// ---------------------------------------------------------------------------
// TextClassifier
// ---------------------------------------------------------------------------

export class TextClassifier {
  private nlpClient: NLPClassifierClient | null = null;

  /**
   * Injects an optional NLP classifier client used as a fallback when local
   * rules return low-confidence results.
   *
   * @param client - An NLPClassifierClient instance (or null to clear).
   */
  setNLPClient(client: NLPClassifierClient | null): void {
    this.nlpClient = client;
  }

  /**
   * Analyzes the given text for scam patterns and returns an array of
   * ThreatIndicator objects.
   *
   * Local regex rules run first. If ALL local indicators have confidence < 0.5
   * (or there are no local indicators) AND an NLP client has been injected,
   * the remote NLP API is called as a fallback. Results are merged and
   * deduplicated by type — when both sources produce an indicator of the same
   * type, the one with the higher confidence is kept.
   *
   * @param text - The message body to analyze.
   * @returns A promise resolving to an array of ThreatIndicator objects.
   */
  async classify(text: string): Promise<ThreatIndicator[]> {
    const localIndicators = this.runLocalRules(text);

    const shouldCallNLP =
      this.nlpClient !== null &&
      (localIndicators.length === 0 ||
        localIndicators.every(indicator => indicator.confidence < 0.5));

    if (!shouldCallNLP) {
      return localIndicators;
    }

    const remoteIndicators = await this.nlpClient!.classify(text);
    return mergeIndicators(localIndicators, remoteIndicators);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Runs all local regex rule sets against the text and returns the resulting
   * indicators. At most one indicator is returned per threat type.
   */
  private runLocalRules(text: string): ThreatIndicator[] {
    const lower = text.toLowerCase();
    const indicators: ThreatIndicator[] = [];

    // --- Urgency language (Requirement 2.2) ---
    const urgencyMatch = this.findFirstMatch(lower, URGENCY_PATTERNS);
    if (urgencyMatch !== null) {
      indicators.push({
        type: 'urgency_language',
        confidence: 0.7,
        evidence: urgencyMatch,
      });
    }

    // --- Impersonation (Requirement 2.3) ---
    const impersonationMatch = this.findFirstMatch(lower, IMPERSONATION_PATTERNS);
    if (impersonationMatch !== null) {
      indicators.push({
        type: 'impersonation',
        confidence: 0.8,
        evidence: impersonationMatch,
      });
    }

    // --- Investment / prize scams (Requirement 2.4) ---
    const investmentMatch = this.findFirstMatch(lower, INVESTMENT_SCAM_PATTERNS);
    if (investmentMatch !== null) {
      indicators.push({
        type: 'investment_scam',
        confidence: 0.75,
        evidence: investmentMatch,
      });
    }

    return indicators;
  }

  /**
   * Returns the first pattern from `patterns` that appears in `lowerText`,
   * or null if none match.
   *
   * Matching is done on an already-lowercased string so all comparisons are
   * effectively case-insensitive without the overhead of re-lowercasing on
   * every call.
   */
  private findFirstMatch(lowerText: string, patterns: string[]): string | null {
    for (const pattern of patterns) {
      // Escape special regex characters in the pattern string
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      if (regex.test(lowerText)) {
        return pattern;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Merge helper (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Merges two arrays of ThreatIndicator objects, deduplicating by type.
 * When both arrays contain an indicator of the same type, the one with the
 * higher confidence is kept. Indicators unique to either array are included
 * as-is.
 *
 * @param local  - Indicators produced by local regex rules.
 * @param remote - Indicators produced by the remote NLP classifier.
 * @returns A merged, deduplicated array of ThreatIndicator objects.
 */
export function mergeIndicators(
  local: ThreatIndicator[],
  remote: ThreatIndicator[],
): ThreatIndicator[] {
  const byType = new Map<ThreatIndicator['type'], ThreatIndicator>();

  for (const indicator of local) {
    byType.set(indicator.type, indicator);
  }

  for (const indicator of remote) {
    const existing = byType.get(indicator.type);
    if (existing === undefined || indicator.confidence > existing.confidence) {
      byType.set(indicator.type, indicator);
    }
  }

  return Array.from(byType.values());
}

/**
 * ThreatAnalyzerService
 *
 * Orchestrates all Threat_Analyzer sub-modules (URLChecker, TextClassifier,
 * AttachmentScanner) in parallel and feeds their combined indicators into the
 * RiskScoreEngine to produce a final ThreatAnalysis.
 *
 * Lifecycle:
 *   URLChecker requires open()/close() around its SQLite database. This
 *   service initialises URLChecker lazily on the first call to analyze() so
 *   that callers do not need to manage the lifecycle themselves.
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import type { MessageEvent, ThreatAnalysis, ThreatIndicator } from '../models/types';
import { urlChecker } from './URLChecker';
import { TextClassifier } from './TextClassifier';
import { attachmentScanner } from './AttachmentScanner';
import { riskScoreEngine } from './RiskScoreEngine';

// ---------------------------------------------------------------------------
// Singleton TextClassifier
// ---------------------------------------------------------------------------

/** Singleton TextClassifier instance (no NLP client injected by default). */
const textClassifier = new TextClassifier();

// ---------------------------------------------------------------------------
// ThreatAnalyzerService
// ---------------------------------------------------------------------------

class ThreatAnalyzerServiceClass {
  /**
   * Whether URLChecker.open() has already been called.
   * Used to implement lazy initialisation.
   */
  private initialized = false;

  /**
   * Ensures URLChecker is open before the first analysis.
   * Subsequent calls are no-ops.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await urlChecker.open();
      this.initialized = true;
    }
  }

  /**
   * Analyzes a captured MessageEvent and returns a ThreatAnalysis.
   *
   * The three sub-modules run in parallel via Promise.all:
   *   1. URLChecker.check(message.body)       — phishing URL detection
   *   2. TextClassifier.classify(message.body) — urgency / impersonation / investment scam
   *   3. AttachmentScanner.scan(message.attachments) — malicious file extensions
   *
   * All indicators are merged and passed to RiskScoreEngine.computeScore()
   * to derive the final riskScore.
   *
   * @param message - The captured message to analyze.
   * @returns A Promise that resolves to a ThreatAnalysis.
   *
   * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5
   */
  async analyze(message: MessageEvent): Promise<ThreatAnalysis> {
    // Lazy-initialise URLChecker on first use
    await this.ensureInitialized();

    // Run all sub-modules in parallel for minimum latency (Requirement 1.1)
    const [urlIndicators, textIndicators, attachmentIndicators] =
      await Promise.all([
        urlChecker.check(message.body),
        textClassifier.classify(message.body),
        Promise.resolve(attachmentScanner.scan(message.attachments)),
      ]);

    // Merge all indicators from the three sub-modules
    const allIndicators: ThreatIndicator[] = [
      ...urlIndicators,
      ...textIndicators,
      ...attachmentIndicators,
    ];

    // Compute the weighted Risk_Score (Requirement 1.2)
    const riskScore = riskScoreEngine.computeScore(allIndicators);

    return {
      messageId: message.id,
      riskScore,
      indicators: allIndicators,
      analyzedAt: new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const ThreatAnalyzerService = new ThreatAnalyzerServiceClass();
export { ThreatAnalyzerServiceClass };

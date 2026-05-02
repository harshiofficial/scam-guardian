/**
 * NLPClassifierClient
 *
 * HTTP client for the remote NLP Scam Classifier API.
 * Used as a fallback when local regex rules return low-confidence results.
 *
 * Requirements: 2.2, 2.3, 2.4
 */

import type { ThreatIndicator } from '../models/types';

// ---------------------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------------------

/**
 * Base URL for the NLP Scam Classifier API.
 * Override this constant to point at a different environment.
 */
export const NLP_CLASSIFIER_API_URL =
  'https://api.scam-nlp-classifier.example.com/v1/classify';

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

interface NLPPrediction {
  type: 'urgency_language' | 'impersonation' | 'investment_scam';
  confidence: number;
  evidence: string;
}

interface NLPClassifyResponse {
  predictions: NLPPrediction[];
}

// ---------------------------------------------------------------------------
// NLPClassifierClient
// ---------------------------------------------------------------------------

export class NLPClassifierClient {
  private readonly apiUrl: string;

  constructor(apiUrl: string = NLP_CLASSIFIER_API_URL) {
    this.apiUrl = apiUrl;
  }

  /**
   * Sends the message text to the remote NLP classifier and returns an array
   * of ThreatIndicator objects derived from the API predictions.
   *
   * Fails gracefully: if the API is unreachable, times out, or returns a
   * non-2xx status, an empty array is returned instead of throwing.
   *
   * @param text - The message body to classify.
   * @returns A promise that resolves to an array of ThreatIndicator objects.
   */
  async classify(text: string): Promise<ThreatIndicator[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        // Non-2xx response — degrade gracefully
        return [];
      }

      const data: NLPClassifyResponse = await response.json();

      if (!Array.isArray(data.predictions)) {
        return [];
      }

      return data.predictions
        .filter(
          (p): p is NLPPrediction =>
            typeof p.type === 'string' &&
            typeof p.confidence === 'number' &&
            typeof p.evidence === 'string',
        )
        .map(
          (p): ThreatIndicator => ({
            type: p.type,
            confidence: p.confidence,
            evidence: p.evidence,
          }),
        );
    } catch {
      // Network error, timeout, JSON parse failure — degrade gracefully
      return [];
    }
  }
}

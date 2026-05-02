/**
 * MessageListenerService
 *
 * Orchestrates the message-capture pipeline:
 *   1. Subscribes to MessageEvent emissions from both MessageListenerBridge
 *      (Android Accessibility Service) and AppGroupBridgeModule (iOS Share
 *      Extension).
 *   2. For each event, calls ThreatAnalyzerService.analyze() with a 5-second
 *      deadline enforced via Promise.race.
 *   3. Dispatches the resulting ThreatAnalysis to all registered downstream
 *      consumers (Warning UI, AuditLog, AlertServiceClient, etc.).
 *   4. On timeout, logs a warning and falls back to a safe default
 *      ThreatAnalysis (riskScore=0, empty indicators) so the user is never
 *      blocked by a slow analysis.
 *
 * Requirements: 1.1, 1.2
 */

import { v4 as uuid } from 'uuid';
import type { MessageEvent, ThreatAnalysis } from '../models/types';
import { MessageListenerBridge } from './MessageListenerBridge';
import { AppGroupBridgeModule } from './AppGroupBridgeModule';
import { ThreatAnalyzerService } from './ThreatAnalyzerService';
import { auditLogRepository } from './AuditLogRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum time (ms) allowed for a single ThreatAnalyzerService.analyze() call. */
const ANALYSIS_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Callback invoked with a completed ThreatAnalysis for each processed message. */
export type ThreatAnalysisCallback = (analysis: ThreatAnalysis) => void;

// ---------------------------------------------------------------------------
// MessageListenerService
// ---------------------------------------------------------------------------

class MessageListenerServiceClass {
  private subscribers: ThreatAnalysisCallback[] = [];
  private unsubscribeBridge: (() => void) | null = null;
  private unsubscribeAppGroup: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Starts the service by subscribing to both native message sources.
   * Safe to call multiple times — subsequent calls are no-ops if already started.
   */
  start(): void {
    if (this.unsubscribeBridge !== null) {
      // Already started.
      return;
    }

    this.unsubscribeBridge = MessageListenerBridge.subscribe(event =>
      this._processEvent(event),
    );

    this.unsubscribeAppGroup = AppGroupBridgeModule.subscribe(event =>
      this._processEvent(event),
    );
  }

  /**
   * Stops the service by removing all native subscriptions.
   * Downstream subscribers registered via `subscribe()` are preserved so
   * that the service can be restarted without requiring re-registration.
   */
  stop(): void {
    this.unsubscribeBridge?.();
    this.unsubscribeBridge = null;

    this.unsubscribeAppGroup?.();
    this.unsubscribeAppGroup = null;
  }

  // ---------------------------------------------------------------------------
  // Downstream subscription API
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback that is invoked with a ThreatAnalysis for every
   * processed MessageEvent.
   *
   * @param callback - Invoked with the ThreatAnalysis result (or the safe
   *                   default on timeout).
   * @returns An unsubscribe function.
   */
  subscribe(callback: ThreatAnalysisCallback): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  // ---------------------------------------------------------------------------
  // Event processing
  // ---------------------------------------------------------------------------

  /**
   * Processes a single MessageEvent:
   *   1. Races ThreatAnalyzerService.analyze() against a 5-second timeout.
   *   2. On success, dispatches the ThreatAnalysis to all subscribers.
   *   3. On timeout, logs a warning and dispatches a safe default analysis.
   *
   * Exposed as a public method (prefixed with `_` by convention) to allow
   * direct invocation in unit tests without needing a live native bridge.
   *
   * @param event - The captured MessageEvent to process.
   */
  async _processEvent(event: MessageEvent): Promise<void> {
    const analyzePromise = ThreatAnalyzerService.analyze(event);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Analysis timed out after ${ANALYSIS_TIMEOUT_MS}ms`)),
        ANALYSIS_TIMEOUT_MS,
      ),
    );

    let analysis: ThreatAnalysis;

    try {
      analysis = await Promise.race([analyzePromise, timeoutPromise]);
    } catch (err) {
      console.warn(
        `[MessageListenerService] Analysis timed out or failed for message ${event.id}:`,
        err,
      );
      // Fail-safe: use a default ThreatAnalysis so the user is never blocked.
      analysis = this._buildDefaultAnalysis(event);
    }

    // Requirement 7.1: write an audit log entry for all messages with riskScore ≥ 40.
    if (analysis.riskScore >= 40) {
      try {
        await auditLogRepository.insert({
          id: uuid(),
          timestamp: new Date(),
          sender: event.sender,
          riskScore: analysis.riskScore,
          threatTypes: analysis.indicators.map(i => i.type),
          outcome: 'pending',
          messagePreview: event.body.slice(0, 200),
        });
      } catch (err) {
        console.warn('[MessageListenerService] Failed to write audit log entry:', err);
      }
    }

    this._dispatch(analysis);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds a safe default ThreatAnalysis used when analysis times out or
   * throws an unexpected error.
   */
  private _buildDefaultAnalysis(event: MessageEvent): ThreatAnalysis {
    return {
      messageId: event.id,
      riskScore: 0,
      indicators: [],
      analyzedAt: new Date(),
    };
  }

  /**
   * Dispatches a ThreatAnalysis to all registered downstream subscribers.
   */
  private _dispatch(analysis: ThreatAnalysis): void {
    for (const cb of this.subscribers) {
      try {
        cb(analysis);
      } catch (err) {
        console.warn('[MessageListenerService] subscriber threw:', err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const MessageListenerService = new MessageListenerServiceClass();
export { MessageListenerServiceClass };

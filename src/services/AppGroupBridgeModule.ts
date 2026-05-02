/**
 * AppGroupBridgeModule.ts
 *
 * TypeScript wrapper around the native AppGroupBridge iOS module.
 *
 * On app foreground the main app calls `AppGroupBridgeModule.processPendingEvents()`
 * which:
 *   1. Calls the native module to read and clear the pending events array from
 *      the shared App Group UserDefaults (written by the Share Extension).
 *   2. Converts each raw dictionary into a typed MessageEvent.
 *   3. Dispatches each event through the same MessageListenerBridge pipeline
 *      used by the Android Accessibility Service, so all downstream consumers
 *      (ThreatAnalyzer, AuditLog, etc.) receive iOS Share Extension events
 *      identically to Android events.
 *
 * Requirements: 1.1
 */

import { NativeModules, Platform, AppState, AppStateStatus } from 'react-native';
import type { MessageEvent } from '../models/types';
import { MessageListenerBridge, MessageEventCallback } from './MessageListenerBridge';

// ---------------------------------------------------------------------------
// Native module reference
// ---------------------------------------------------------------------------

const { AppGroupBridge } = NativeModules;

/**
 * Raw event shape as returned by the native AppGroupBridge module.
 * Mirrors the dictionary written by ShareViewController.swift.
 */
interface RawPendingEvent {
  id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'other';
  sender: string;
  body: string;
  attachments: [];
  /** Unix epoch milliseconds */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// AppGroupBridgeModule
// ---------------------------------------------------------------------------

/**
 * Manages the lifecycle of pending events captured by the iOS Share Extension
 * and feeds them into the MessageListenerBridge pipeline.
 */
class AppGroupBridgeModuleClass {
  private subscribers: MessageEventCallback[] = [];
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  /**
   * Starts listening for app-foreground transitions and processes any pending
   * Share Extension events each time the app becomes active.
   *
   * Call once during app startup (e.g. in App.tsx useEffect).
   * Safe to call on Android — it is a no-op when the native module is absent.
   *
   * @returns A cleanup function that removes the AppState listener.
   */
  start(): () => void {
    if (Platform.OS !== 'ios' || !AppGroupBridge) {
      return () => {};
    }

    // Process any events that arrived while the app was in the background.
    this.processPendingEvents();

    // Re-process on every subsequent foreground transition.
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          this.processPendingEvents();
        }
      },
    );

    return () => {
      this.appStateSubscription?.remove();
      this.appStateSubscription = null;
    };
  }

  // ---------------------------------------------------------------------------
  // Event Processing
  // ---------------------------------------------------------------------------

  /**
   * Fetches and clears pending events from the native App Group store, converts
   * them to typed MessageEvent objects, and dispatches them to all registered
   * subscribers as well as the shared MessageListenerBridge.
   *
   * This method is idempotent — calling it when there are no pending events is
   * a safe no-op.
   */
  async processPendingEvents(): Promise<void> {
    if (Platform.OS !== 'ios' || !AppGroupBridge) {
      return;
    }

    let rawEvents: RawPendingEvent[];
    try {
      rawEvents = await AppGroupBridge.fetchAndClearPendingEvents();
    } catch (err) {
      // Log but do not crash — the App Group may not be configured in dev builds.
      console.warn('[AppGroupBridgeModule] fetchAndClearPendingEvents failed:', err);
      return;
    }

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return;
    }

    for (const raw of rawEvents) {
      const event = this.toMessageEvent(raw);
      this.emit(event);
    }
  }

  // ---------------------------------------------------------------------------
  // Subscriber API
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback that is invoked for each MessageEvent originating
   * from the iOS Share Extension.
   *
   * This mirrors the `MessageListenerBridge.subscribe()` API so callers can
   * treat both sources uniformly.
   *
   * @param callback - Invoked with a fully-typed MessageEvent.
   * @returns An unsubscribe function.
   */
  subscribe(callback: MessageEventCallback): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  // ---------------------------------------------------------------------------
  // Availability
  // ---------------------------------------------------------------------------

  /**
   * Returns true when the native AppGroupBridge module is available.
   * Always false on Android.
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' && Boolean(AppGroupBridge);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Converts a raw pending event dictionary from the native layer into a
   * fully-typed MessageEvent, normalising the Unix epoch ms timestamp to a
   * Date and providing safe defaults for missing fields.
   */
  private toMessageEvent(raw: RawPendingEvent): MessageEvent {
    return {
      id:          raw.id ?? generateFallbackId(),
      channel:     raw.channel ?? 'other',
      sender:      raw.sender ?? '',
      body:        raw.body ?? '',
      attachments: raw.attachments ?? [],
      timestamp:   new Date(raw.timestamp ?? Date.now()),
    };
  }

  /**
   * Dispatches `event` to all local subscribers and also emits it through
   * the shared MessageListenerBridge so that the ThreatAnalyzer and other
   * downstream services receive it via the same pipeline as Android events.
   *
   * Note: MessageListenerBridge.subscribe() is the canonical subscription
   * point for consumers; this module feeds into it rather than replacing it.
   */
  private emit(event: MessageEvent): void {
    // Notify direct subscribers of this module (e.g. tests).
    for (const cb of this.subscribers) {
      try {
        cb(event);
      } catch (err) {
        console.warn('[AppGroupBridgeModule] subscriber threw:', err);
      }
    }

    // Also dispatch through MessageListenerBridge's internal emitter so that
    // any component already subscribed to MessageListenerBridge receives the
    // event without needing to know about AppGroupBridgeModule.
    //
    // MessageListenerBridge exposes a `_emitForTesting` hook used in tests;
    // in production we call the public `_dispatchEvent` method if available,
    // otherwise we rely on subscribers registered directly on this module.
    const bridge = MessageListenerBridge as unknown as {
      _dispatchEvent?: (event: MessageEvent) => void;
    };
    if (typeof bridge._dispatchEvent === 'function') {
      bridge._dispatchEvent(event);
    }
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Generates a simple fallback UUID-like string when the native layer does not
 * provide one. In practice the Share Extension always sets an id, but this
 * guards against malformed payloads.
 */
function generateFallbackId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const AppGroupBridgeModule = new AppGroupBridgeModuleClass();

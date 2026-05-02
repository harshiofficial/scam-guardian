/**
 * MessageListenerBridge
 *
 * TypeScript bridge that subscribes to native MessageEvent emissions from the
 * Android Accessibility Service (ScamGuardianAccessibilityService) via the
 * React Native NativeEventEmitter / NativeModules bridge.
 *
 * On iOS the same interface is used, but events will be emitted by the Share
 * Extension (Task 2.2) rather than an Accessibility Service.
 *
 * Requirements: 1.1
 */

import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  EmitterSubscription,
} from 'react-native';
import type { MessageEvent } from '../models/types';

// ---------------------------------------------------------------------------
// Native module reference
// ---------------------------------------------------------------------------

const { MessageEventModule } = NativeModules;

/**
 * Raw event payload as received from the native bridge.
 * The timestamp arrives as a Unix epoch millisecond number and is converted
 * to a Date before being exposed as a MessageEvent.
 */
interface RawMessageEvent {
  id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'other';
  sender: string;
  body: string;
  attachments: [];
  /** Unix epoch milliseconds */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// MessageListenerBridge
// ---------------------------------------------------------------------------

/**
 * Callback invoked whenever a new MessageEvent is captured by the native layer.
 */
export type MessageEventCallback = (event: MessageEvent) => void;

/**
 * Provides a simple subscribe/unsubscribe API over the native NativeEventEmitter.
 *
 * Usage:
 * ```ts
 * const unsub = MessageListenerBridge.subscribe((event) => {
 *   console.log('New message from', event.sender);
 * });
 *
 * // Later, when the component unmounts:
 * unsub();
 * ```
 */
class MessageListenerBridgeClass {
  private readonly emitter: NativeEventEmitter | null;
  private readonly EVENT_NAME = 'MessageEvent';

  constructor() {
    // The native module is only available on Android (and iOS once Task 2.2
    // is implemented). Guard against running in a JS-only environment (e.g.
    // unit tests or web).
    if (Platform.OS === 'android' && MessageEventModule) {
      this.emitter = new NativeEventEmitter(MessageEventModule);
    } else if (Platform.OS === 'ios' && MessageEventModule) {
      // iOS Share Extension will use the same module name once implemented.
      this.emitter = new NativeEventEmitter(MessageEventModule);
    } else {
      this.emitter = null;
    }
  }

  /**
   * Subscribe to incoming MessageEvents from the native layer.
   *
   * @param callback - Invoked with a fully-typed MessageEvent on each capture.
   * @returns An unsubscribe function. Call it to remove the listener (e.g. in
   *          a useEffect cleanup or componentWillUnmount).
   */
  subscribe(callback: MessageEventCallback): () => void {
    // Always register in the internal registry so that events dispatched via
    // _dispatchEvent (e.g. from AppGroupBridgeModule on iOS) reach this callback
    // even when the NativeEventEmitter is unavailable.
    this._internalCallbacks.add(callback);

    if (!this.emitter) {
      // Native module unavailable (e.g. running in tests or on an unsupported
      // platform). Return a cleanup that only removes from the internal registry.
      return () => {
        this._internalCallbacks.delete(callback);
      };
    }

    const subscription: EmitterSubscription = this.emitter.addListener(
      this.EVENT_NAME,
      (raw: RawMessageEvent) => {
        const event: MessageEvent = {
          id: raw.id,
          channel: raw.channel ?? 'other',
          sender: raw.sender ?? '',
          body: raw.body ?? '',
          attachments: raw.attachments ?? [],
          // Convert Unix epoch ms → Date
          timestamp: new Date(raw.timestamp),
        };
        callback(event);
      },
    );

    return () => {
      subscription.remove();
      this._internalCallbacks.delete(callback);
    };
  }

  /**
   * Returns true if the native module is available on the current platform.
   * Useful for conditionally rendering permission prompts in the Onboarding flow.
   */
  isAvailable(): boolean {
    return this.emitter !== null;
  }

  /**
   * Programmatically dispatches a MessageEvent to all active subscribers.
   *
   * Used by AppGroupBridgeModule (iOS Share Extension) to feed events captured
   * while the app was in the background into the same pipeline as real-time
   * native events, without requiring a separate subscription point.
   *
   * @internal — not part of the public API; called by AppGroupBridgeModule only.
   */
  _dispatchEvent(event: MessageEvent): void {
    // Re-use the same internal callback list by emitting a synthetic event.
    // We iterate over a snapshot of the current listeners by emitting through
    // the NativeEventEmitter if available, or by calling stored callbacks
    // directly via a lightweight internal registry.
    for (const cb of this._internalCallbacks) {
      try {
        cb(event);
      } catch (err) {
        console.warn('[MessageListenerBridge] subscriber threw:', err);
      }
    }
  }

  // Internal registry used by _dispatchEvent to reach all active subscribers
  // without going through the NativeEventEmitter (which cannot be triggered
  // programmatically in production).
  private readonly _internalCallbacks: Set<MessageEventCallback> = new Set();
}

export const MessageListenerBridge = new MessageListenerBridgeClass();

/**
 * AppGroupBridge.swift
 *
 * Native module exposed to React Native that reads pending MessageEvent
 * payloads written by the Share Extension into the shared App Group
 * UserDefaults, clears them, and returns them to the JS layer.
 *
 * The main app calls `AppGroupBridge.fetchAndClearPendingEvents()` on every
 * app-foreground event so that events captured while the app was in the
 * background are processed through the same MessageListenerBridge pipeline
 * as real-time events.
 *
 * App Group identifier: group.com.scamguardian
 * Requirements: 1.1
 */

import Foundation
import React

@objc(AppGroupBridge)
class AppGroupBridge: NSObject {

    // MARK: - Constants

    private let appGroupIdentifier = "group.com.scamguardian"
    private let pendingEventsKey   = "pendingMessageEvents"

    // MARK: - React Native Module Registration

    /**
     * Tells React Native that this module requires the main queue for
     * initialisation. Set to false because all operations are thread-safe
     * UserDefaults reads/writes.
     */
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - Public API

    /**
     * Reads all pending MessageEvent dictionaries from the shared App Group
     * UserDefaults, clears the stored array, and resolves the promise with
     * the events array.
     *
     * Each event dictionary has the shape:
     * ```
     * {
     *   id:          String   // UUID
     *   channel:     String   // "whatsapp" | "sms" | "email" | "other"
     *   sender:      String
     *   body:        String
     *   attachments: Array    // always empty from Share Extension
     *   timestamp:   Number   // Unix epoch milliseconds
     * }
     * ```
     *
     * @param resolve  RCTPromiseResolveBlock — called with [[String: Any]]
     * @param reject   RCTPromiseRejectBlock  — called on UserDefaults failure
     */
    @objc func fetchAndClearPendingEvents(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
            reject(
                "APP_GROUP_UNAVAILABLE",
                "Could not open App Group UserDefaults for suite: \(appGroupIdentifier)",
                nil
            )
            return
        }

        // Read existing events.
        var events: [[String: Any]] = []
        if let data = defaults.data(forKey: pendingEventsKey),
           let decoded = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            events = decoded
        }

        // Clear the pending queue atomically before returning so that a
        // concurrent Share Extension write cannot be lost.
        defaults.removeObject(forKey: pendingEventsKey)
        defaults.synchronize()

        resolve(events)
    }
}

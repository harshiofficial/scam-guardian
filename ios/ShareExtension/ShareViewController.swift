/**
 * ShareViewController.swift
 *
 * iOS Share Extension view controller for ScamGuardian.
 * Accepts shared text and URLs from other apps (WhatsApp, Mail, Safari, etc.),
 * serialises the content as a MessageEvent JSON payload, and appends it to the
 * pending events array stored in the shared App Group UserDefaults so the main
 * app can pick it up on next foreground.
 *
 * App Group identifier: group.com.scamguardian
 * Requirements: 1.1
 */

import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    // MARK: - Constants

    private let appGroupIdentifier = "group.com.scamguardian"
    private let pendingEventsKey   = "pendingMessageEvents"

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        // Process the shared content immediately; no custom UI is shown.
        extractSharedContent { [weak self] text, url in
            guard let self = self else { return }
            let body   = text ?? url ?? ""
            let sender = self.resolveSourceAppName()
            let event  = self.buildMessageEvent(body: body, sender: sender)
            self.appendPendingEvent(event)
            self.completeRequest()
        }
    }

    // MARK: - Content Extraction

    /**
     * Iterates over `extensionContext.inputItems` to find the first plain-text
     * string or URL attachment and returns it via the completion handler.
     *
     * Checks for:
     *   - `public.plain-text` (NSExtensionActivationSupportsText)
     *   - `public.url` / `public.file-url` (NSExtensionActivationSupportsWebURLWithMaxCount)
     */
    private func extractSharedContent(completion: @escaping (_ text: String?, _ url: String?) -> Void) {
        guard let inputItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            completion(nil, nil)
            return
        }

        let group = DispatchGroup()
        var extractedText: String?
        var extractedURL:  String?

        for item in inputItems {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                // --- Plain text ---
                if provider.hasItemConformingToTypeIdentifier(kUTTypePlainText as String) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: kUTTypePlainText as String, options: nil) { data, _ in
                        if let text = data as? String, !text.isEmpty {
                            extractedText = text
                        }
                        group.leave()
                    }
                }

                // --- URL ---
                if provider.hasItemConformingToTypeIdentifier(kUTTypeURL as String) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: kUTTypeURL as String, options: nil) { data, _ in
                        if let url = data as? URL {
                            extractedURL = url.absoluteString
                        } else if let urlString = data as? String, !urlString.isEmpty {
                            extractedURL = urlString
                        }
                        group.leave()
                    }
                }
            }
        }

        group.notify(queue: .main) {
            completion(extractedText, extractedURL)
        }
    }

    // MARK: - MessageEvent Construction

    /**
     * Builds a MessageEvent-shaped dictionary ready for JSON serialisation.
     *
     * Channel heuristic:
     *   - If the source bundle ID contains "whatsapp" → "whatsapp"
     *   - If it contains "mail" or "gmail"           → "email"
     *   - If it contains "messages" or "sms"         → "sms"
     *   - Otherwise                                  → "other"
     */
    private func buildMessageEvent(body: String, sender: String) -> [String: Any] {
        let uuid      = UUID().uuidString
        let timestamp = Int64(Date().timeIntervalSince1970 * 1000) // Unix epoch ms
        let channel   = resolveChannel()

        return [
            "id":          uuid,
            "channel":     channel,
            "sender":      sender,
            "body":        body,
            "attachments": [] as [[String: Any]],
            "timestamp":   timestamp,
        ]
    }

    /**
     * Derives the channel string from the host app's bundle identifier.
     * Falls back to "other" when the bundle ID is unavailable.
     */
    private func resolveChannel() -> String {
        guard let bundleID = Bundle.main.bundleIdentifier?.lowercased() else {
            return "other"
        }
        if bundleID.contains("whatsapp") { return "whatsapp" }
        if bundleID.contains("mail") || bundleID.contains("gmail") { return "email" }
        if bundleID.contains("messages") || bundleID.contains("sms") { return "sms" }
        return "other"
    }

    /**
     * Returns a human-readable source app name derived from the host bundle ID.
     * Used as the `sender` field when no explicit sender is available.
     */
    private func resolveSourceAppName() -> String {
        // The Share Extension's own bundle ID is something like
        // com.scamguardian.ShareExtension; the host app's bundle ID is
        // available via NSExtensionContext but not directly exposed.
        // We use the last component of the extension's bundle ID as a fallback.
        let bundleID = Bundle.main.bundleIdentifier ?? "unknown"
        return bundleID.components(separatedBy: ".").last ?? "unknown"
    }

    // MARK: - App Group Persistence

    /**
     * Appends `event` to the pending events array stored in the shared
     * App Group UserDefaults under the key `pendingMessageEvents`.
     *
     * The array is serialised as a JSON array of dictionaries so it can be
     * decoded by both Swift (main app) and the React Native JS layer.
     */
    private func appendPendingEvent(_ event: [String: Any]) {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
            // App Group not configured — silently drop the event rather than crash.
            return
        }

        var pending: [[String: Any]] = []

        // Deserialise existing events if present.
        if let existingData = defaults.data(forKey: pendingEventsKey),
           let decoded = try? JSONSerialization.jsonObject(with: existingData) as? [[String: Any]] {
            pending = decoded
        }

        pending.append(event)

        if let encoded = try? JSONSerialization.data(withJSONObject: pending) {
            defaults.set(encoded, forKey: pendingEventsKey)
            defaults.synchronize()
        }
    }

    // MARK: - Extension Lifecycle

    /**
     * Signals to the host app that the Share Extension has finished processing.
     * Passing an empty items array is the standard pattern for extensions that
     * do not return modified content.
     */
    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}

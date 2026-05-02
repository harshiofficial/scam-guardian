package com.scamguardian

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.UUID

/**
 * ScamGuardianAccessibilityService
 *
 * Listens for TYPE_NOTIFICATION_STATE_CHANGED events from monitored messaging apps
 * (WhatsApp, SMS, and email), parses the notification content into a MessageEvent,
 * and forwards it to the React Native bridge via MessageEventModule.
 *
 * Requirements: 1.1
 */
class ScamGuardianAccessibilityService : AccessibilityService() {

    companion object {
        /** Package names mapped to their MessageEvent channel value */
        private val MONITORED_PACKAGES: Map<String, String> = mapOf(
            // WhatsApp
            "com.whatsapp"                          to "whatsapp",
            "com.whatsapp.w4b"                      to "whatsapp",
            // SMS / MMS
            "com.android.mms"                       to "sms",
            "com.google.android.apps.messaging"     to "sms",
            "com.samsung.android.messaging"         to "sms",
            // Email
            "com.google.android.gm"                 to "email",
            "com.microsoft.office.outlook"          to "email",
        )
    }

    // -------------------------------------------------------------------------
    // AccessibilityService lifecycle
    // -------------------------------------------------------------------------

    override fun onServiceConnected() {
        super.onServiceConnected()
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 100
            packageNames = MONITORED_PACKAGES.keys.toTypedArray()
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return
        val channel = MONITORED_PACKAGES[packageName] ?: return

        val (sender, body) = extractSenderAndBody(event)

        // Skip empty notifications
        if (sender.isBlank() && body.isBlank()) return

        val messageEvent = buildMessageEventMap(
            id        = UUID.randomUUID().toString(),
            channel   = channel,
            sender    = sender,
            body      = body,
            timestamp = System.currentTimeMillis()
        )

        MessageEventModule.emitMessageEvent(messageEvent)
    }

    override fun onInterrupt() {
        // No-op: required override
    }

    // -------------------------------------------------------------------------
    // Notification parsing helpers
    // -------------------------------------------------------------------------

    /**
     * Extracts the sender (title) and body (text) from an AccessibilityEvent.
     *
     * Notification extras are the most reliable source. The event's text list
     * is used as a fallback for older API levels.
     */
    private fun extractSenderAndBody(event: AccessibilityEvent): Pair<String, String> {
        // Try Parcelable extras first (API 18+)
        val parcelable = event.parcelableData
        if (parcelable is android.app.Notification) {
            val extras: Bundle? = parcelable.extras
            if (extras != null) {
                val title = extras.getCharSequence("android.title")?.toString() ?: ""
                val text  = extras.getCharSequence("android.text")?.toString()
                    ?: extras.getCharSequence("android.bigText")?.toString()
                    ?: ""
                return Pair(title, text)
            }
        }

        // Fallback: use the event's text list
        val texts = event.text
        return when {
            texts.size >= 2 -> Pair(texts[0].toString(), texts[1].toString())
            texts.size == 1 -> Pair("", texts[0].toString())
            else            -> Pair("", "")
        }
    }

    /**
     * Builds a plain Map that mirrors the TypeScript MessageEvent interface.
     * Attachments are always an empty list at capture time; the Threat_Analyzer
     * layer is responsible for attachment detection.
     */
    private fun buildMessageEventMap(
        id: String,
        channel: String,
        sender: String,
        body: String,
        timestamp: Long
    ): Map<String, Any> = mapOf(
        "id"          to id,
        "channel"     to channel,
        "sender"      to sender,
        "body"        to body,
        "attachments" to emptyList<Any>(),
        "timestamp"   to timestamp
    )
}

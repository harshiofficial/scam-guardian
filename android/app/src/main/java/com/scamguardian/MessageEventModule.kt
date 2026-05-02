package com.scamguardian

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * MessageEventModule
 *
 * A React Native NativeModule that acts as the bridge between the Android
 * Accessibility Service and the JavaScript layer.
 *
 * The JS side subscribes to the "MessageEvent" event via NativeEventEmitter.
 * The Accessibility Service calls the static [emitMessageEvent] method to
 * push events through the bridge.
 *
 * Requirements: 1.1
 */
class MessageEventModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        /** The name exposed to JavaScript via NativeModules.MessageEventModule */
        const val MODULE_NAME = "MessageEventModule"

        /** The event name that JS listeners subscribe to */
        const val EVENT_NAME = "MessageEvent"

        /**
         * Singleton reference to the active module instance.
         * Set when the module is initialised by the React Native bridge.
         */
        @Volatile
        private var instance: MessageEventModule? = null

        /**
         * Called by [ScamGuardianAccessibilityService] to forward a parsed
         * MessageEvent to the JavaScript layer.
         *
         * @param eventData A Map whose keys match the TypeScript MessageEvent interface:
         *   id, channel, sender, body, attachments, timestamp
         */
        fun emitMessageEvent(eventData: Map<String, Any>) {
            instance?.sendEvent(eventData)
        }
    }

    // -------------------------------------------------------------------------
    // ReactContextBaseJavaModule
    // -------------------------------------------------------------------------

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        instance = this
    }

    override fun invalidate() {
        instance = null
        super.invalidate()
    }

    // -------------------------------------------------------------------------
    // React Methods
    // -------------------------------------------------------------------------

    /**
     * Required by NativeEventEmitter on the JS side.
     * Called when the first JS listener is added.
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // No-op: required by NativeEventEmitter contract
    }

    /**
     * Required by NativeEventEmitter on the JS side.
     * Called when JS listeners are removed.
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op: required by NativeEventEmitter contract
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Converts the raw Map from the Accessibility Service into a [WritableMap]
     * and emits it over the React Native bridge.
     */
    private fun sendEvent(eventData: Map<String, Any>) {
        val params: WritableMap = Arguments.createMap().apply {
            putString("id",        eventData["id"] as? String ?: "")
            putString("channel",   eventData["channel"] as? String ?: "other")
            putString("sender",    eventData["sender"] as? String ?: "")
            putString("body",      eventData["body"] as? String ?: "")
            putDouble("timestamp", (eventData["timestamp"] as? Long)?.toDouble() ?: 0.0)
            // attachments is always an empty array at capture time
            putArray("attachments", Arguments.createArray())
        }

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, params)
    }
}

package com.scamguardian

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * MessageEventPackage
 *
 * Registers [MessageEventModule] with the React Native bridge so that it is
 * available as `NativeModules.MessageEventModule` in JavaScript.
 *
 * Add this package to the `getPackages()` list in `MainApplication.kt` (or
 * `MainApplication.java`) to activate it.
 *
 * Requirements: 1.1
 */
class MessageEventPackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(MessageEventModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> = emptyList()
}

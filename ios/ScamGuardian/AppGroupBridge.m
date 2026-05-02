/**
 * AppGroupBridge.m
 *
 * Objective-C macro registration for the AppGroupBridge Swift native module.
 * React Native's bridge discovery requires this file even when the
 * implementation is written in Swift.
 *
 * Requirements: 1.1
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppGroupBridge, NSObject)

RCT_EXTERN_METHOD(
  fetchAndClearPendingEvents:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end

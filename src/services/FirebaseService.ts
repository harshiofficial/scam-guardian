/**
 * ScamGuardian — Firebase Service
 *
 * Initialises Firebase App and provides helpers for FCM token management.
 * Requires @react-native-firebase/app and @react-native-firebase/messaging
 * to be linked in the native projects.
 */
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

/**
 * Request permission to receive push notifications.
 * Returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Retrieve the current FCM registration token for this device.
 * Returns null if permission has not been granted.
 */
export async function getFCMToken(): Promise<string | null> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return null;
  }
  return messaging().getToken();
}

/**
 * Subscribe to foreground FCM messages.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  handler: (message: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  return messaging().onMessage(handler);
}

/**
 * Set a background message handler.
 * Must be called outside of any component lifecycle (e.g., in index.js).
 */
export function setBackgroundMessageHandler(
  handler: (message: FirebaseMessagingTypes.RemoteMessage) => Promise<void>,
): void {
  messaging().setBackgroundMessageHandler(handler);
}

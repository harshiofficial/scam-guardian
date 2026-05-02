/**
 * AlertServiceClient
 *
 * Mobile-side client for the Alert_Service backend.
 *
 * Responsibilities:
 *  - POST alert payloads to the backend /alert endpoint
 *  - Listen for FCM data messages from the Guardian and invoke callbacks
 *    with GuardianAction objects
 *  - Register the device FCM token with the backend
 *
 * Requirements: 3.1, 3.2, 3.4
 */

import messaging from '@react-native-firebase/messaging';
import type { AlertPayload, GuardianAction } from '../models/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const ALERT_API_BASE_URL = 'https://api.scamguardian.example.com';

// ---------------------------------------------------------------------------
// AlertServiceClientClass
// ---------------------------------------------------------------------------

export class AlertServiceClientClass {
  private readonly baseUrl: string;

  constructor(baseUrl: string = ALERT_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Sends an alert payload to the backend Alert API.
   *
   * POSTs to `${baseUrl}/alert` with a JSON body.
   * Throws on non-2xx HTTP responses or network errors.
   *
   * Requirements: 3.1, 3.2
   *
   * @param payload - The alert payload to send.
   */
  async sendAlert(payload: AlertPayload): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      // Network-level failure — let callers handle retry
      throw networkError;
    }

    if (!response.ok) {
      throw new Error(
        `AlertServiceClient.sendAlert failed with status ${response.status}`,
      );
    }
  }

  /**
   * Subscribes to FCM foreground messages and invokes the callback whenever
   * a `guardian_action` data message is received.
   *
   * Filters for messages where `data.type === 'guardian_action'` and parses
   * the GuardianAction fields from the FCM data payload.
   *
   * Requirement: 3.4
   *
   * @param callback - Invoked with the parsed GuardianAction.
   * @returns An unsubscribe function that removes the FCM listener.
   */
  onGuardianAction(callback: (action: GuardianAction) => void): () => void {
    const unsubscribe = messaging().onMessage(remoteMessage => {
      const data = remoteMessage.data;

      if (!data || data.type !== 'guardian_action') {
        return;
      }

      // Validate required fields are present before invoking callback
      if (
        typeof data.messageId !== 'string' ||
        typeof data.action !== 'string' ||
        typeof data.guardianId !== 'string' ||
        typeof data.timestamp !== 'string'
      ) {
        console.warn(
          '[AlertServiceClient] Received guardian_action with missing fields:',
          data,
        );
        return;
      }

      const guardianAction: GuardianAction = {
        messageId: data.messageId,
        action: data.action as GuardianAction['action'],
        guardianId: data.guardianId,
        timestamp: data.timestamp,
      };

      callback(guardianAction);
    });

    return unsubscribe;
  }

  /**
   * Registers the device FCM token with the backend so the Guardian can
   * receive push notifications for this user.
   *
   * POSTs to `${baseUrl}/alert/register` with `{ userId, fcmToken }`.
   * Throws on non-2xx HTTP responses or network errors.
   *
   * @param userId   - The authenticated user's ID.
   * @param fcmToken - The device's current FCM registration token.
   */
  async registerFCMToken(userId: string, fcmToken: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/alert/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, fcmToken }),
      });
    } catch (networkError) {
      throw networkError;
    }

    if (!response.ok) {
      throw new Error(
        `AlertServiceClient.registerFCMToken failed with status ${response.status}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const AlertServiceClient = new AlertServiceClientClass();

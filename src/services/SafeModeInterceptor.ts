/**
 * SafeModeInterceptor
 *
 * When Safe_Mode is enabled (`UserProfile.safeModeEnabled === true`), this
 * service intercepts every outbound link-open request before the link is
 * opened in the device browser.
 *
 * Behaviour:
 *   - interceptLink(url, safeModeEnabled=true)
 *       → returns { status: 'intercepted' }
 *       → calls AlertServiceClient.sendAlert() with link details
 *   - interceptLink(url, safeModeEnabled=false)
 *       → opens the link immediately via Linking.openURL()
 *       → returns { status: 'passed_through' }
 *   - handleGuardianAction(action='mark_safe', url)
 *       → opens the link via Linking.openURL() within 5 seconds
 *       → returns { status: 'opened' }
 *   - handleGuardianAction(action='confirm_scam', url)
 *       → returns { status: 'blocked', message: <plain-language explanation> }
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { Linking } from 'react-native';
import type { GuardianAction, AlertPayload } from '../models/types';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type SafeModeStatus = 'intercepted' | 'passed_through' | 'opened' | 'blocked';

export interface SafeModeResult {
  status: SafeModeStatus;
  /** Human-readable message shown to the User (present for 'intercepted' and 'blocked') */
  message?: string;
}

// ---------------------------------------------------------------------------
// AlertServiceClient interface (minimal — full implementation in task 8.1)
// ---------------------------------------------------------------------------

export interface IAlertServiceClient {
  sendAlert(payload: AlertPayload): Promise<void>;
}

// ---------------------------------------------------------------------------
// GuardianActionHandler interface (for registering Safe Mode links)
// ---------------------------------------------------------------------------

export interface IGuardianActionHandler {
  registerSafeModeLink(messageId: string, url: string): void;
}

// ---------------------------------------------------------------------------
// SafeModeInterceptor
// ---------------------------------------------------------------------------

/**
 * Interceptor that gates outbound link-open requests behind Guardian approval
 * when Safe_Mode is active.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export class SafeModeInterceptor {
  private readonly alertClient: IAlertServiceClient;
  private readonly userId: string;
  private readonly guardianId: string;
  private readonly guardianActionHandler: IGuardianActionHandler | null;

  constructor(
    alertClient: IAlertServiceClient,
    userId: string,
    guardianId: string,
    guardianActionHandler: IGuardianActionHandler | null = null,
  ) {
    this.alertClient = alertClient;
    this.userId = userId;
    this.guardianId = guardianId;
    this.guardianActionHandler = guardianActionHandler;
  }

  /**
   * Intercepts or passes through a link-open request depending on whether
   * Safe_Mode is enabled.
   *
   * When safeModeEnabled is true:
   *   - Sends an alert to the Guardian via AlertServiceClient
   *   - Registers the link with GuardianActionHandler for later approval/rejection
   *   - Returns { status: 'intercepted', message: 'Waiting for your family to approve this link' }
   *
   * When safeModeEnabled is false:
   *   - Opens the link immediately via Linking.openURL()
   *   - Returns { status: 'passed_through' }
   *
   * Requirements: 6.1, 6.2
   */
  async interceptLink(
    url: string,
    safeModeEnabled: boolean,
  ): Promise<SafeModeResult> {
    if (!safeModeEnabled) {
      await Linking.openURL(url);
      return { status: 'passed_through' };
    }

    // Safe Mode is active — intercept and notify Guardian (Requirement 6.1, 6.2)
    const messageId = `link-${Date.now()}`;
    const payload: AlertPayload = {
      userId: this.userId,
      messageId,
      sender: url,
      threatSummary: `Your family member wants to open this link: ${url}`,
      riskScore: 0,
      timestamp: new Date().toISOString(),
      userRequestedHelp: true,
    };

    await this.alertClient.sendAlert(payload);

    // Register the link with GuardianActionHandler so it can route the response correctly
    if (this.guardianActionHandler) {
      this.guardianActionHandler.registerSafeModeLink(messageId, url);
    }

    return {
      status: 'intercepted',
      message: 'Waiting for your family to approve this link',
    };
  }

  /**
   * Handles a Guardian action for a previously intercepted link.
   *
   * When action is 'mark_safe':
   *   - Opens the link via Linking.openURL() (within 5 seconds per Requirement 6.3)
   *   - Returns { status: 'opened' }
   *
   * When action is 'confirm_scam':
   *   - Returns { status: 'blocked', message: <plain-language explanation> }
   *
   * Requirements: 6.3, 6.4
   */
  async handleGuardianAction(
    action: GuardianAction,
    url: string,
  ): Promise<SafeModeResult> {
    if (action.action === 'mark_safe') {
      // Open the link within 5 seconds of Guardian approval (Requirement 6.3)
      await Linking.openURL(url);
      return { status: 'opened' };
    }

    if (action.action === 'confirm_scam') {
      // Dismiss waiting screen and show plain-language blocked message (Requirement 6.4)
      return {
        status: 'blocked',
        message:
          'Your family blocked this link to keep you safe. It may be a scam.',
      };
    }

    // 'call_user' and any future actions — pass through without opening
    return { status: 'blocked', message: 'This link was not approved.' };
  }
}

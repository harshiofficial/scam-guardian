/**
 * ScamGuardian Backend — FCM Service
 *
 * Wraps Firebase Admin Messaging for push notification dispatch.
 */
import * as admin from 'firebase-admin';
import { AlertPayload, GuardianAction } from '../models/types';

/**
 * Send a Guardian alert push notification.
 * Requirement 3.1: dispatch within 10 seconds of Risk_Score assignment.
 * Requirement 3.2: include sender, threat summary, risk score, timestamp.
 */
export async function sendGuardianAlert(
  guardianFcmToken: string,
  payload: AlertPayload,
  notificationId: string,
): Promise<string> {
  const message: admin.messaging.Message = {
    token: guardianFcmToken,
    notification: {
      title: `⚠️ Scam Alert — Risk ${payload.riskScore}/100`,
      body: `From: ${payload.sender}\n${payload.threatSummary}`,
    },
    data: {
      type: 'guardian_alert',
      notificationId,
      userId: payload.userId,
      messageId: payload.messageId,
      sender: payload.sender,
      threatSummary: payload.threatSummary,
      riskScore: String(payload.riskScore),
      timestamp: payload.timestamp,
      userRequestedHelp: String(payload.userRequestedHelp),
    },
    android: {
      priority: 'high',
    },
    apns: {
      headers: { 'apns-priority': '10' },
    },
  };

  return admin.messaging().send(message);
}

/**
 * Send a Guardian reminder notification for an unresponded alert.
 * Requirement 3.5: follow-up reminder if Guardian does not respond within 30 minutes.
 */
export async function sendGuardianReminder(
  guardianFcmToken: string,
  notificationId: string,
  userId: string,
  sender: string,
  riskScore: number,
): Promise<string> {
  const message: admin.messaging.Message = {
    token: guardianFcmToken,
    notification: {
      title: '🔔 Reminder: Scam Alert Awaiting Response',
      body: `Your relative received a suspicious message from ${sender} (Risk: ${riskScore}/100). Please review.`,
    },
    data: {
      type: 'guardian_reminder',
      notificationId,
      userId,
      sender,
      riskScore: String(riskScore),
    },
    android: { priority: 'high' },
    apns: { headers: { 'apns-priority': '10' } },
  };

  return admin.messaging().send(message);
}

/**
 * Push a Guardian action result back to the User device.
 * Requirement 3.3: Guardian can mark safe, confirm scam, or call user.
 * Requirement 3.4: mark_safe removes warning from User screen within 5 seconds.
 */
export async function sendUserActionUpdate(
  userFcmToken: string,
  action: GuardianAction,
): Promise<string> {
  const message: admin.messaging.Message = {
    token: userFcmToken,
    data: {
      type: 'guardian_action',
      messageId: action.messageId,
      action: action.action,
      guardianId: action.guardianId,
      timestamp: action.timestamp,
    },
    android: { priority: 'high' },
    apns: { headers: { 'apns-priority': '10' } },
  };

  return admin.messaging().send(message);
}

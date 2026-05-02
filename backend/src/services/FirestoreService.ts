/**
 * ScamGuardian Backend — Firestore Service
 *
 * Wraps Firebase Admin Firestore for Guardian registry operations.
 * Stores User↔Guardian mappings and FCM tokens.
 */
import * as admin from 'firebase-admin';
import { GuardianNotification } from '../models/types';

export interface GuardianRecord {
  guardianId: string;
  guardianFcmToken: string;
}

export interface UserRecord {
  userId: string;
  fcmToken: string;
  guardianId: string;
}

/**
 * Look up the Guardian record for a given userId.
 * Returns null if no mapping exists.
 */
export async function getGuardianForUser(
  userId: string,
): Promise<GuardianRecord | null> {
  const db = admin.firestore();
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) return null;
  const data = doc.data() as UserRecord & { guardianFcmToken?: string };
  if (!data.guardianFcmToken) return null;
  return {
    guardianId: data.guardianId,
    guardianFcmToken: data.guardianFcmToken,
  };
}

/**
 * Look up the User FCM token for a given userId.
 */
export async function getUserFcmToken(userId: string): Promise<string | null> {
  const db = admin.firestore();
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) return null;
  const data = doc.data() as UserRecord;
  return data.fcmToken ?? null;
}

/**
 * Store or update a User's FCM token in Firestore.
 */
export async function registerUserFcmToken(
  userId: string,
  fcmToken: string,
  guardianId?: string,
): Promise<void> {
  const db = admin.firestore();
  const update: Record<string, unknown> = { userId, fcmToken };
  if (guardianId) update.guardianId = guardianId;
  await db.collection('users').doc(userId).set(update, { merge: true });
}

/**
 * Store a pending alert notification record.
 */
export async function storePendingAlert(
  notification: GuardianNotification,
): Promise<void> {
  const db = admin.firestore();
  await db
    .collection('pendingAlerts')
    .doc(notification.notificationId)
    .set({
      ...notification,
      timestamp: notification.timestamp.toISOString(),
    });
}

/**
 * Mark an alert as responded.
 */
export async function markAlertResponded(
  notificationId: string,
  respondedAt: Date,
): Promise<void> {
  const db = admin.firestore();
  await db.collection('pendingAlerts').doc(notificationId).update({
    responded: true,
    respondedAt: respondedAt.toISOString(),
  });
}

/**
 * Fetch all unresponded alerts older than the given cutoff date.
 */
export async function getUnrespondedAlertsOlderThan(
  cutoff: Date,
): Promise<GuardianNotification[]> {
  const db = admin.firestore();
  const snapshot = await db
    .collection('pendingAlerts')
    .where('responded', '==', false)
    .get();

  const results: GuardianNotification[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const ts = new Date(data.timestamp as string);
    if (ts < cutoff) {
      results.push({
        notificationId: doc.id,
        userId: data.userId as string,
        messageId: data.messageId as string,
        sender: data.sender as string,
        threatSummary: data.threatSummary as string,
        riskScore: data.riskScore as number,
        timestamp: ts,
        responded: false,
        reminderSentAt: data.reminderSentAt
          ? new Date(data.reminderSentAt as string)
          : undefined,
      });
    }
  });
  return results;
}

/**
 * Record that a reminder was sent for an alert.
 */
export async function markReminderSent(
  notificationId: string,
  sentAt: Date,
): Promise<void> {
  const db = admin.firestore();
  await db.collection('pendingAlerts').doc(notificationId).update({
    reminderSentAt: sentAt.toISOString(),
  });
}

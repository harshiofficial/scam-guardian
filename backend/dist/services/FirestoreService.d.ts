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
export declare function getGuardianForUser(userId: string): Promise<GuardianRecord | null>;
/**
 * Look up the User FCM token for a given userId.
 */
export declare function getUserFcmToken(userId: string): Promise<string | null>;
/**
 * Store or update a User's FCM token in Firestore.
 */
export declare function registerUserFcmToken(userId: string, fcmToken: string, guardianId?: string): Promise<void>;
/**
 * Store a pending alert notification record.
 */
export declare function storePendingAlert(notification: GuardianNotification): Promise<void>;
/**
 * Mark an alert as responded.
 */
export declare function markAlertResponded(notificationId: string, respondedAt: Date): Promise<void>;
/**
 * Fetch all unresponded alerts older than the given cutoff date.
 */
export declare function getUnrespondedAlertsOlderThan(cutoff: Date): Promise<GuardianNotification[]>;
/**
 * Record that a reminder was sent for an alert.
 */
export declare function markReminderSent(notificationId: string, sentAt: Date): Promise<void>;
//# sourceMappingURL=FirestoreService.d.ts.map
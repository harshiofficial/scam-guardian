"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markReminderSent = exports.getUnrespondedAlertsOlderThan = exports.markAlertResponded = exports.storePendingAlert = exports.registerUserFcmToken = exports.getUserFcmToken = exports.getGuardianForUser = void 0;
/**
 * ScamGuardian Backend — Firestore Service
 *
 * Wraps Firebase Admin Firestore for Guardian registry operations.
 * Stores User↔Guardian mappings and FCM tokens.
 */
const admin = __importStar(require("firebase-admin"));
/**
 * Look up the Guardian record for a given userId.
 * Returns null if no mapping exists.
 */
async function getGuardianForUser(userId) {
    const db = admin.firestore();
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists)
        return null;
    const data = doc.data();
    if (!data.guardianFcmToken)
        return null;
    return {
        guardianId: data.guardianId,
        guardianFcmToken: data.guardianFcmToken,
    };
}
exports.getGuardianForUser = getGuardianForUser;
/**
 * Look up the User FCM token for a given userId.
 */
async function getUserFcmToken(userId) {
    const db = admin.firestore();
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists)
        return null;
    const data = doc.data();
    return data.fcmToken ?? null;
}
exports.getUserFcmToken = getUserFcmToken;
/**
 * Store or update a User's FCM token in Firestore.
 */
async function registerUserFcmToken(userId, fcmToken, guardianId) {
    const db = admin.firestore();
    const update = { userId, fcmToken };
    if (guardianId)
        update.guardianId = guardianId;
    await db.collection('users').doc(userId).set(update, { merge: true });
}
exports.registerUserFcmToken = registerUserFcmToken;
/**
 * Store a pending alert notification record.
 */
async function storePendingAlert(notification) {
    const db = admin.firestore();
    await db
        .collection('pendingAlerts')
        .doc(notification.notificationId)
        .set({
        ...notification,
        timestamp: notification.timestamp.toISOString(),
    });
}
exports.storePendingAlert = storePendingAlert;
/**
 * Mark an alert as responded.
 */
async function markAlertResponded(notificationId, respondedAt) {
    const db = admin.firestore();
    await db.collection('pendingAlerts').doc(notificationId).update({
        responded: true,
        respondedAt: respondedAt.toISOString(),
    });
}
exports.markAlertResponded = markAlertResponded;
/**
 * Fetch all unresponded alerts older than the given cutoff date.
 */
async function getUnrespondedAlertsOlderThan(cutoff) {
    const db = admin.firestore();
    const snapshot = await db
        .collection('pendingAlerts')
        .where('responded', '==', false)
        .get();
    const results = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const ts = new Date(data.timestamp);
        if (ts < cutoff) {
            results.push({
                notificationId: doc.id,
                userId: data.userId,
                messageId: data.messageId,
                sender: data.sender,
                threatSummary: data.threatSummary,
                riskScore: data.riskScore,
                timestamp: ts,
                responded: false,
                reminderSentAt: data.reminderSentAt
                    ? new Date(data.reminderSentAt)
                    : undefined,
            });
        }
    });
    return results;
}
exports.getUnrespondedAlertsOlderThan = getUnrespondedAlertsOlderThan;
/**
 * Record that a reminder was sent for an alert.
 */
async function markReminderSent(notificationId, sentAt) {
    const db = admin.firestore();
    await db.collection('pendingAlerts').doc(notificationId).update({
        reminderSentAt: sentAt.toISOString(),
    });
}
exports.markReminderSent = markReminderSent;
//# sourceMappingURL=FirestoreService.js.map
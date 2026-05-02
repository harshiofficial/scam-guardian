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
exports.sendUserActionUpdate = exports.sendGuardianReminder = exports.sendGuardianAlert = void 0;
/**
 * ScamGuardian Backend — FCM Service
 *
 * Wraps Firebase Admin Messaging for push notification dispatch.
 */
const admin = __importStar(require("firebase-admin"));
/**
 * Send a Guardian alert push notification.
 * Requirement 3.1: dispatch within 10 seconds of Risk_Score assignment.
 * Requirement 3.2: include sender, threat summary, risk score, timestamp.
 */
async function sendGuardianAlert(guardianFcmToken, payload, notificationId) {
    const message = {
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
exports.sendGuardianAlert = sendGuardianAlert;
/**
 * Send a Guardian reminder notification for an unresponded alert.
 * Requirement 3.5: follow-up reminder if Guardian does not respond within 30 minutes.
 */
async function sendGuardianReminder(guardianFcmToken, notificationId, userId, sender, riskScore) {
    const message = {
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
exports.sendGuardianReminder = sendGuardianReminder;
/**
 * Push a Guardian action result back to the User device.
 * Requirement 3.3: Guardian can mark safe, confirm scam, or call user.
 * Requirement 3.4: mark_safe removes warning from User screen within 5 seconds.
 */
async function sendUserActionUpdate(userFcmToken, action) {
    const message = {
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
exports.sendUserActionUpdate = sendUserActionUpdate;
//# sourceMappingURL=FcmService.js.map
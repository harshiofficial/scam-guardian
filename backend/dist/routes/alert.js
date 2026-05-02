"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ScamGuardian Backend — Alert Routes
 *
 * POST /alert          — receive alert from mobile client, dispatch FCM to Guardian
 * POST /alert/register — store/update User FCM token in Firestore
 */
const express_1 = require("express");
const uuid_1 = require("uuid");
const FirestoreService_1 = require("../services/FirestoreService");
const FcmService_1 = require("../services/FcmService");
const router = (0, express_1.Router)();
/**
 * POST /alert
 * Validates AlertPayload, looks up Guardian FCM token, dispatches FCM push.
 * Requirements: 3.1, 3.2
 */
router.post('/', async (req, res) => {
    const payload = req.body;
    // Validate required fields
    if (!payload.userId ||
        !payload.messageId ||
        !payload.sender ||
        !payload.threatSummary ||
        payload.riskScore === undefined ||
        !payload.timestamp) {
        res.status(400).json({ error: 'Missing required fields in AlertPayload' });
        return;
    }
    if (typeof payload.riskScore !== 'number' || payload.riskScore < 0 || payload.riskScore > 100) {
        res.status(400).json({ error: 'riskScore must be a number between 0 and 100' });
        return;
    }
    const alertPayload = payload;
    // Look up Guardian FCM token from Firestore
    const guardian = await (0, FirestoreService_1.getGuardianForUser)(alertPayload.userId);
    if (!guardian) {
        res.status(404).json({ error: 'No Guardian registered for this user' });
        return;
    }
    // Create a notification record
    const notificationId = (0, uuid_1.v4)();
    await (0, FirestoreService_1.storePendingAlert)({
        notificationId,
        userId: alertPayload.userId,
        messageId: alertPayload.messageId,
        sender: alertPayload.sender,
        threatSummary: alertPayload.threatSummary,
        riskScore: alertPayload.riskScore,
        timestamp: new Date(alertPayload.timestamp),
        responded: false,
    });
    // Dispatch FCM push to Guardian
    const fcmMessageId = await (0, FcmService_1.sendGuardianAlert)(guardian.guardianFcmToken, alertPayload, notificationId);
    res.status(200).json({ success: true, notificationId, fcmMessageId });
});
/**
 * POST /alert/register
 * Stores or updates the User's FCM token in Firestore.
 */
router.post('/register', async (req, res) => {
    const { userId, fcmToken, guardianId } = req.body;
    if (!userId || !fcmToken) {
        res.status(400).json({ error: 'userId and fcmToken are required' });
        return;
    }
    await (0, FirestoreService_1.registerUserFcmToken)(userId, fcmToken, guardianId);
    res.status(200).json({ success: true });
});
exports.default = router;
//# sourceMappingURL=alert.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ScamGuardian Backend — Guardian Routes
 *
 * POST /guardian/action — receive Guardian's response, push update back to User device
 */
const express_1 = require("express");
const FirestoreService_1 = require("../services/FirestoreService");
const FcmService_1 = require("../services/FcmService");
const router = (0, express_1.Router)();
/**
 * POST /guardian/action
 * Validates GuardianAction, pushes FCM data message back to User device.
 * Requirements: 3.3, 3.4
 */
router.post('/action', async (req, res) => {
    const body = req.body;
    // Validate required fields
    if (!body.messageId || !body.action || !body.guardianId || !body.timestamp) {
        res.status(400).json({ error: 'Missing required fields in GuardianAction' });
        return;
    }
    const validActions = ['mark_safe', 'confirm_scam', 'call_user'];
    if (!validActions.includes(body.action)) {
        res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
        return;
    }
    if (!body.userId) {
        res.status(400).json({ error: 'userId is required to route action to User device' });
        return;
    }
    const action = {
        messageId: body.messageId,
        action: body.action,
        guardianId: body.guardianId,
        timestamp: body.timestamp,
    };
    // Look up User FCM token
    const userFcmToken = await (0, FirestoreService_1.getUserFcmToken)(body.userId);
    if (!userFcmToken) {
        res.status(404).json({ error: 'No FCM token registered for this user' });
        return;
    }
    // Push action update to User device
    const fcmMessageId = await (0, FcmService_1.sendUserActionUpdate)(userFcmToken, action);
    // Mark alert as responded if notificationId provided
    if (body.notificationId) {
        await (0, FirestoreService_1.markAlertResponded)(body.notificationId, new Date(action.timestamp));
    }
    res.status(200).json({ success: true, fcmMessageId });
});
exports.default = router;
//# sourceMappingURL=guardian.js.map
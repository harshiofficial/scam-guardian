/**
 * ScamGuardian Backend — Guardian Routes
 *
 * POST /guardian/action — receive Guardian's response, push update back to User device
 */
import { Router, Request, Response } from 'express';
import { GuardianAction } from '../models/types';
import {
  getUserFcmToken,
  markAlertResponded,
} from '../services/FirestoreService';
import { sendUserActionUpdate } from '../services/FcmService';

const router = Router();

/**
 * POST /guardian/action
 * Validates GuardianAction, pushes FCM data message back to User device.
 * Requirements: 3.3, 3.4
 */
router.post('/action', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<GuardianAction & { userId: string; notificationId?: string }>;

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

  const action: GuardianAction = {
    messageId: body.messageId,
    action: body.action,
    guardianId: body.guardianId,
    timestamp: body.timestamp,
  };

  // Look up User FCM token
  const userFcmToken = await getUserFcmToken(body.userId);
  if (!userFcmToken) {
    res.status(404).json({ error: 'No FCM token registered for this user' });
    return;
  }

  // Push action update to User device
  const fcmMessageId = await sendUserActionUpdate(userFcmToken, action);

  // Mark alert as responded if notificationId provided
  if (body.notificationId) {
    await markAlertResponded(body.notificationId, new Date(action.timestamp));
  }

  res.status(200).json({ success: true, fcmMessageId });
});

export default router;

/**
 * ScamGuardian Backend — Alert Routes
 *
 * POST /alert          — receive alert from mobile client, dispatch FCM to Guardian
 * POST /alert/register — store/update User FCM token in Firestore
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AlertPayload } from '../models/types';
import {
  getGuardianForUser,
  registerUserFcmToken,
  storePendingAlert,
} from '../services/FirestoreService';
import { sendGuardianAlert } from '../services/FcmService';

const router = Router();

/**
 * POST /alert
 * Validates AlertPayload, looks up Guardian FCM token, dispatches FCM push.
 * Requirements: 3.1, 3.2
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Partial<AlertPayload>;

  // Validate required fields
  if (
    !payload.userId ||
    !payload.messageId ||
    !payload.sender ||
    !payload.threatSummary ||
    payload.riskScore === undefined ||
    !payload.timestamp
  ) {
    res.status(400).json({ error: 'Missing required fields in AlertPayload' });
    return;
  }

  if (typeof payload.riskScore !== 'number' || payload.riskScore < 0 || payload.riskScore > 100) {
    res.status(400).json({ error: 'riskScore must be a number between 0 and 100' });
    return;
  }

  const alertPayload = payload as AlertPayload;

  // Look up Guardian FCM token from Firestore
  const guardian = await getGuardianForUser(alertPayload.userId);
  if (!guardian) {
    res.status(404).json({ error: 'No Guardian registered for this user' });
    return;
  }

  // Create a notification record
  const notificationId = uuidv4();
  await storePendingAlert({
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
  const fcmMessageId = await sendGuardianAlert(
    guardian.guardianFcmToken,
    alertPayload,
    notificationId,
  );

  res.status(200).json({ success: true, notificationId, fcmMessageId });
});

/**
 * POST /alert/register
 * Stores or updates the User's FCM token in Firestore.
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { userId, fcmToken, guardianId } = req.body as {
    userId?: string;
    fcmToken?: string;
    guardianId?: string;
  };

  if (!userId || !fcmToken) {
    res.status(400).json({ error: 'userId and fcmToken are required' });
    return;
  }

  await registerUserFcmToken(userId, fcmToken, guardianId);
  res.status(200).json({ success: true });
});

export default router;

/**
 * Integration tests for ScamGuardian Alert API
 *
 * Tests:
 *  - POST /alert with valid payload dispatches FCM and returns 200
 *  - POST /guardian/action with mark_safe pushes update to user device
 *  - Reminder job fires for alerts unanswered after 30 minutes
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import request from 'supertest';
import app from '../app';
import { runReminderCheck } from '../jobs/reminderJob';

// ---------------------------------------------------------------------------
// Mock firebase-admin
// ---------------------------------------------------------------------------

const mockSend = jest.fn().mockResolvedValue('mock-fcm-message-id');

jest.mock('firebase-admin', () => {
  const firestoreData: Record<string, Record<string, unknown>> = {};

  const docRef = (collection: string, id: string) => ({
    get: jest.fn(async () => {
      const data = firestoreData[`${collection}/${id}`];
      return {
        exists: !!data,
        data: () => data,
      };
    }),
    set: jest.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      const key = `${collection}/${id}`;
      if (opts?.merge) {
        firestoreData[key] = { ...(firestoreData[key] ?? {}), ...data };
      } else {
        firestoreData[key] = { ...data };
      }
    }),
    update: jest.fn(async (data: Record<string, unknown>) => {
      const key = `${collection}/${id}`;
      firestoreData[key] = { ...(firestoreData[key] ?? {}), ...data };
    }),
  });

  // Simple query builder that supports a single .where(field, '==', value) chain
  type QueryRef = { where: jest.Mock; get: jest.Mock };
  const queryRef = (
    collection: string,
    filters: Array<[string, unknown]>,
  ): QueryRef => ({
    where: jest.fn((field: string, _op: string, value: unknown) =>
      queryRef(collection, [...filters, [field, value]]),
    ),
    get: jest.fn(async () => {
      const prefix = `${collection}/`;
      const docs = Object.entries(firestoreData)
        .filter(([key]) => key.startsWith(prefix))
        .filter(([, data]) =>
          filters.every(([field, value]) => (data as Record<string, unknown>)[field] === value),
        )
        .map(([key, data]) => ({
          id: key.slice(prefix.length),
          data: () => data,
        }));
      return {
        forEach: (cb: (doc: { id: string; data: () => unknown }) => void) =>
          docs.forEach(cb),
      };
    }),
  });

  const collectionRef = (collection: string) => ({
    doc: (id: string) => docRef(collection, id),
    where: jest.fn((field: string, _op: string, value: unknown) =>
      queryRef(collection, [[field, value]]),
    ),
    get: jest.fn(async () => {
      const prefix = `${collection}/`;
      const docs = Object.entries(firestoreData)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, data]) => ({
          id: key.slice(prefix.length),
          data: () => data,
        }));
      return {
        forEach: (cb: (doc: { id: string; data: () => unknown }) => void) =>
          docs.forEach(cb),
      };
    }),
  });

  return {
    firestore: jest.fn(() => ({
      collection: jest.fn((name: string) => collectionRef(name)),
    })),
    messaging: jest.fn(() => ({
      send: mockSend,
    })),
    // Expose internal store for test setup
    __firestoreData: firestoreData,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const adminMock = require('firebase-admin') as {
  __firestoreData: Record<string, Record<string, unknown>>;
};

function seedUser(
  userId: string,
  opts: {
    fcmToken?: string;
    guardianId?: string;
    guardianFcmToken?: string;
  } = {},
) {
  adminMock.__firestoreData[`users/${userId}`] = {
    userId,
    fcmToken: opts.fcmToken ?? `user-fcm-${userId}`,
    guardianId: opts.guardianId ?? `guardian-${userId}`,
    guardianFcmToken: opts.guardianFcmToken ?? `guardian-fcm-${userId}`,
  };
}

function seedPendingAlert(
  notificationId: string,
  opts: {
    userId?: string;
    messageId?: string;
    sender?: string;
    riskScore?: number;
    timestamp?: Date;
    responded?: boolean;
  } = {},
) {
  adminMock.__firestoreData[`pendingAlerts/${notificationId}`] = {
    notificationId,
    userId: opts.userId ?? 'user-1',
    messageId: opts.messageId ?? 'msg-1',
    sender: opts.sender ?? 'Unknown Sender',
    threatSummary: 'Suspicious message detected',
    riskScore: opts.riskScore ?? 85,
    timestamp: (opts.timestamp ?? new Date()).toISOString(),
    responded: opts.responded ?? false,
  };
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear Firestore mock data and FCM call history before each test
  Object.keys(adminMock.__firestoreData).forEach(k => {
    delete adminMock.__firestoreData[k];
  });
  mockSend.mockClear();
});

// ---------------------------------------------------------------------------
// POST /alert — dispatches FCM and returns 200
// ---------------------------------------------------------------------------

describe('POST /alert', () => {
  const validPayload = {
    userId: 'user-1',
    messageId: 'msg-abc',
    sender: 'Unknown Caller',
    threatSummary: 'This message looks like a scam. Be careful.',
    riskScore: 85,
    timestamp: new Date().toISOString(),
    userRequestedHelp: false,
  };

  it('returns 200 and dispatches FCM when payload is valid and Guardian is registered', async () => {
    seedUser('user-1', { guardianFcmToken: 'guardian-fcm-token-1' });

    const res = await request(app).post('/alert').send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notificationId).toBeDefined();
    expect(res.body.fcmMessageId).toBe('mock-fcm-message-id');

    // FCM send should have been called once with the Guardian's token
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentMessage = mockSend.mock.calls[0][0] as {
      token: string;
      notification: { title: string; body: string };
      data: Record<string, string>;
    };
    expect(sentMessage.token).toBe('guardian-fcm-token-1');
    expect(sentMessage.notification.title).toContain('85');
    expect(sentMessage.data.userId).toBe('user-1');
    expect(sentMessage.data.messageId).toBe('msg-abc');
    expect(sentMessage.data.sender).toBe('Unknown Caller');
    expect(sentMessage.data.riskScore).toBe('85');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/alert')
      .send({ userId: 'user-1' }); // missing most fields

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 400 when riskScore is out of range', async () => {
    const res = await request(app)
      .post('/alert')
      .send({ ...validPayload, riskScore: 150 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/riskScore/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 404 when no Guardian is registered for the user', async () => {
    // No user seeded — Firestore returns no document
    const res = await request(app).post('/alert').send(validPayload);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no guardian/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('stores a pending alert record in Firestore', async () => {
    seedUser('user-1', { guardianFcmToken: 'guardian-fcm-token-1' });

    const res = await request(app).post('/alert').send(validPayload);
    expect(res.status).toBe(200);

    const notificationId = res.body.notificationId as string;
    const stored = adminMock.__firestoreData[`pendingAlerts/${notificationId}`];
    expect(stored).toBeDefined();
    expect(stored.userId).toBe('user-1');
    expect(stored.messageId).toBe('msg-abc');
    expect(stored.responded).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /guardian/action — mark_safe pushes update to user device
// ---------------------------------------------------------------------------

describe('POST /guardian/action', () => {
  const markSafePayload = {
    userId: 'user-1',
    messageId: 'msg-abc',
    action: 'mark_safe',
    guardianId: 'guardian-1',
    timestamp: new Date().toISOString(),
    notificationId: 'notif-1',
  };

  it('returns 200 and pushes FCM data message to User device for mark_safe', async () => {
    seedUser('user-1', { fcmToken: 'user-fcm-token-1' });
    seedPendingAlert('notif-1', { userId: 'user-1', messageId: 'msg-abc' });

    const res = await request(app).post('/guardian/action').send(markSafePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.fcmMessageId).toBe('mock-fcm-message-id');

    // FCM send should have been called once with the User's token
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentMessage = mockSend.mock.calls[0][0] as {
      token: string;
      data: Record<string, string>;
    };
    expect(sentMessage.token).toBe('user-fcm-token-1');
    expect(sentMessage.data.type).toBe('guardian_action');
    expect(sentMessage.data.action).toBe('mark_safe');
    expect(sentMessage.data.messageId).toBe('msg-abc');
    expect(sentMessage.data.guardianId).toBe('guardian-1');
  });

  it('marks the alert as responded in Firestore when notificationId is provided', async () => {
    seedUser('user-1', { fcmToken: 'user-fcm-token-1' });
    seedPendingAlert('notif-1', { userId: 'user-1', messageId: 'msg-abc' });

    await request(app).post('/guardian/action').send(markSafePayload);

    const stored = adminMock.__firestoreData['pendingAlerts/notif-1'];
    expect(stored.responded).toBe(true);
    expect(stored.respondedAt).toBeDefined();
  });

  it('returns 200 for confirm_scam action', async () => {
    seedUser('user-1', { fcmToken: 'user-fcm-token-1' });

    const res = await request(app)
      .post('/guardian/action')
      .send({ ...markSafePayload, action: 'confirm_scam' });

    expect(res.status).toBe(200);
    const sentMessage = mockSend.mock.calls[0][0] as { data: Record<string, string> };
    expect(sentMessage.data.action).toBe('confirm_scam');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/guardian/action')
      .send({ messageId: 'msg-abc' }); // missing action, guardianId, timestamp, userId

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid action value', async () => {
    const res = await request(app)
      .post('/guardian/action')
      .send({ ...markSafePayload, action: 'invalid_action' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/action must be one of/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 404 when no FCM token is registered for the user', async () => {
    // No user seeded
    const res = await request(app).post('/guardian/action').send(markSafePayload);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no fcm token/i);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Reminder job — fires for alerts unanswered after 30 minutes
// ---------------------------------------------------------------------------

describe('Reminder job', () => {
  it('sends a reminder FCM notification for alerts older than 30 minutes', async () => {
    // Seed a user with a Guardian
    seedUser('user-1', {
      fcmToken: 'user-fcm-token-1',
      guardianId: 'guardian-1',
      guardianFcmToken: 'guardian-fcm-token-1',
    });

    // Seed an unresponded alert that is 35 minutes old
    const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);
    seedPendingAlert('notif-old', {
      userId: 'user-1',
      sender: 'Suspicious Sender',
      riskScore: 90,
      timestamp: thirtyFiveMinutesAgo,
      responded: false,
    });

    await runReminderCheck(new Date());

    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentMessage = mockSend.mock.calls[0][0] as {
      token: string;
      data: Record<string, string>;
    };
    expect(sentMessage.token).toBe('guardian-fcm-token-1');
    expect(sentMessage.data.type).toBe('guardian_reminder');
    expect(sentMessage.data.notificationId).toBe('notif-old');
    expect(sentMessage.data.userId).toBe('user-1');
  });

  it('does NOT send a reminder for alerts that are less than 30 minutes old', async () => {
    seedUser('user-1', {
      guardianFcmToken: 'guardian-fcm-token-1',
    });

    // Seed an alert that is only 10 minutes old
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    seedPendingAlert('notif-recent', {
      userId: 'user-1',
      timestamp: tenMinutesAgo,
      responded: false,
    });

    await runReminderCheck(new Date());

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does NOT send a reminder for alerts that have already been responded to', async () => {
    seedUser('user-1', {
      guardianFcmToken: 'guardian-fcm-token-1',
    });

    // Seed an old alert that was already responded to
    const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000);
    seedPendingAlert('notif-responded', {
      userId: 'user-1',
      timestamp: fortyMinutesAgo,
      responded: true,
    });

    await runReminderCheck(new Date());

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('records reminderSentAt in Firestore after sending reminder', async () => {
    seedUser('user-1', {
      guardianFcmToken: 'guardian-fcm-token-1',
    });

    const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);
    seedPendingAlert('notif-track', {
      userId: 'user-1',
      timestamp: thirtyFiveMinutesAgo,
      responded: false,
    });

    const now = new Date();
    await runReminderCheck(now);

    const stored = adminMock.__firestoreData['pendingAlerts/notif-track'];
    expect(stored.reminderSentAt).toBe(now.toISOString());
  });

  it('handles multiple unresponded old alerts in a single pass', async () => {
    seedUser('user-1', { guardianFcmToken: 'guardian-fcm-token-1' });
    seedUser('user-2', { guardianFcmToken: 'guardian-fcm-token-2' });

    const oldTime = new Date(Date.now() - 45 * 60 * 1000);
    seedPendingAlert('notif-a', { userId: 'user-1', timestamp: oldTime });
    seedPendingAlert('notif-b', { userId: 'user-2', timestamp: oldTime });

    await runReminderCheck(new Date());

    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// POST /alert/register
// ---------------------------------------------------------------------------

describe('POST /alert/register', () => {
  it('returns 200 and stores FCM token in Firestore', async () => {
    const res = await request(app).post('/alert/register').send({
      userId: 'user-reg',
      fcmToken: 'new-fcm-token',
      guardianId: 'guardian-reg',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stored = adminMock.__firestoreData['users/user-reg'];
    expect(stored).toBeDefined();
    expect(stored.fcmToken).toBe('new-fcm-token');
    expect(stored.guardianId).toBe('guardian-reg');
  });

  it('returns 400 when userId or fcmToken is missing', async () => {
    const res = await request(app)
      .post('/alert/register')
      .send({ userId: 'user-reg' }); // missing fcmToken

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId and fcmToken are required/i);
  });
});

/**
 * ScamGuardian Backend — Firebase Admin Service
 *
 * Wraps Firebase Admin SDK for FCM dispatch and Firestore operations.
 * Falls back to an in-memory store when Firebase credentials are not configured.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
import * as admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// In-memory fallback store (used when Firebase credentials are not configured)
// ---------------------------------------------------------------------------

interface InMemoryStore {
  /** userId → { fcmToken, guardianId } */
  users: Map<string, { fcmToken: string; guardianId?: string }>;
  /** guardianId → fcmToken */
  guardians: Map<string, string>;
  /** userId → guardianId */
  userGuardianMapping: Map<string, string>;
}

const inMemoryStore: InMemoryStore = {
  users: new Map(),
  guardians: new Map(),
  userGuardianMapping: new Map(),
};

/**
 * Returns true when Firebase Admin has been initialised with real credentials.
 */
function isFirebaseInitialised(): boolean {
  try {
    return admin.apps.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// FirebaseAdminService
// ---------------------------------------------------------------------------

export class FirebaseAdminService {
  /**
   * Send an FCM notification (title + body) to a device token.
   * Requirement 3.1: dispatch within 10 seconds of Risk_Score assignment.
   * Requirement 3.2: include sender, threat summary, risk score, timestamp.
   */
  async sendFCMNotification(token: string, payload: object): Promise<void> {
    if (!isFirebaseInitialised()) {
      console.warn(
        '[FirebaseAdminService] Firebase not initialised — FCM notification not sent.',
        { token, payload },
      );
      return;
    }

    const message: admin.messaging.Message = {
      token,
      ...(payload as admin.messaging.Message),
    };

    await admin.messaging().send(message);
  }

  /**
   * Send an FCM data-only message to a device token.
   * Requirement 3.3: push Guardian action back to User device.
   * Requirement 3.4: mark_safe removes warning within 5 seconds.
   */
  async sendFCMDataMessage(
    token: string,
    data: Record<string, string>,
  ): Promise<void> {
    if (!isFirebaseInitialised()) {
      console.warn(
        '[FirebaseAdminService] Firebase not initialised — FCM data message not sent.',
        { token, data },
      );
      return;
    }

    const message: admin.messaging.Message = {
      token,
      data,
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    };

    await admin.messaging().send(message);
  }

  /**
   * Look up the Guardian FCM token for a given userId.
   * Returns null if no Guardian mapping exists.
   */
  async getGuardianToken(userId: string): Promise<string | null> {
    if (!isFirebaseInitialised()) {
      // Fallback: resolve via in-memory mapping
      const guardianId = inMemoryStore.userGuardianMapping.get(userId);
      if (!guardianId) return null;
      return inMemoryStore.guardians.get(guardianId) ?? null;
    }

    const db = admin.firestore();
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return null;
    const data = doc.data() as Record<string, unknown>;
    return (data.guardianFcmToken as string) ?? null;
  }

  /**
   * Look up the User FCM token for a given guardianId.
   * Returns null if no token is registered.
   */
  async getUserToken(guardianId: string): Promise<string | null> {
    if (!isFirebaseInitialised()) {
      // Fallback: find the userId mapped to this guardianId, then return their token
      for (const [uid, record] of inMemoryStore.users.entries()) {
        if (record.guardianId === guardianId) {
          return record.fcmToken;
        }
      }
      return null;
    }

    const db = admin.firestore();
    const snapshot = await db
      .collection('users')
      .where('guardianId', '==', guardianId)
      .get();

    let token: string | null = null;
    snapshot.forEach(doc => {
      const data = doc.data() as Record<string, unknown>;
      if (data.fcmToken) token = data.fcmToken as string;
    });
    return token;
  }

  /**
   * Store or update a User's FCM token, keyed by userId.
   */
  async storeUserToken(userId: string, fcmToken: string): Promise<void> {
    if (!isFirebaseInitialised()) {
      const existing = inMemoryStore.users.get(userId) ?? {};
      inMemoryStore.users.set(userId, { ...existing, fcmToken });
      return;
    }

    const db = admin.firestore();
    await db
      .collection('users')
      .doc(userId)
      .set({ userId, fcmToken }, { merge: true });
  }

  /**
   * Store a User↔Guardian mapping in Firestore (or in-memory fallback).
   */
  async storeGuardianMapping(
    userId: string,
    guardianId: string,
  ): Promise<void> {
    if (!isFirebaseInitialised()) {
      const existing = inMemoryStore.users.get(userId) ?? { fcmToken: '' };
      inMemoryStore.users.set(userId, { ...existing, guardianId });
      inMemoryStore.userGuardianMapping.set(userId, guardianId);
      return;
    }

    const db = admin.firestore();
    await db
      .collection('users')
      .doc(userId)
      .set({ guardianId }, { merge: true });
  }
}

/** Singleton instance for use across the application. */
export const firebaseAdminService = new FirebaseAdminService();

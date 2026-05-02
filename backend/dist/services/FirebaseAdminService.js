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
exports.firebaseAdminService = exports.FirebaseAdminService = void 0;
/**
 * ScamGuardian Backend — Firebase Admin Service
 *
 * Wraps Firebase Admin SDK for FCM dispatch and Firestore operations.
 * Falls back to an in-memory store when Firebase credentials are not configured.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
const admin = __importStar(require("firebase-admin"));
const inMemoryStore = {
    users: new Map(),
    guardians: new Map(),
    userGuardianMapping: new Map(),
};
/**
 * Returns true when Firebase Admin has been initialised with real credentials.
 */
function isFirebaseInitialised() {
    try {
        return admin.apps.length > 0;
    }
    catch {
        return false;
    }
}
// ---------------------------------------------------------------------------
// FirebaseAdminService
// ---------------------------------------------------------------------------
class FirebaseAdminService {
    /**
     * Send an FCM notification (title + body) to a device token.
     * Requirement 3.1: dispatch within 10 seconds of Risk_Score assignment.
     * Requirement 3.2: include sender, threat summary, risk score, timestamp.
     */
    async sendFCMNotification(token, payload) {
        if (!isFirebaseInitialised()) {
            console.warn('[FirebaseAdminService] Firebase not initialised — FCM notification not sent.', { token, payload });
            return;
        }
        const message = {
            token,
            ...payload,
        };
        await admin.messaging().send(message);
    }
    /**
     * Send an FCM data-only message to a device token.
     * Requirement 3.3: push Guardian action back to User device.
     * Requirement 3.4: mark_safe removes warning within 5 seconds.
     */
    async sendFCMDataMessage(token, data) {
        if (!isFirebaseInitialised()) {
            console.warn('[FirebaseAdminService] Firebase not initialised — FCM data message not sent.', { token, data });
            return;
        }
        const message = {
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
    async getGuardianToken(userId) {
        if (!isFirebaseInitialised()) {
            // Fallback: resolve via in-memory mapping
            const guardianId = inMemoryStore.userGuardianMapping.get(userId);
            if (!guardianId)
                return null;
            return inMemoryStore.guardians.get(guardianId) ?? null;
        }
        const db = admin.firestore();
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        return data.guardianFcmToken ?? null;
    }
    /**
     * Look up the User FCM token for a given guardianId.
     * Returns null if no token is registered.
     */
    async getUserToken(guardianId) {
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
        let token = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.fcmToken)
                token = data.fcmToken;
        });
        return token;
    }
    /**
     * Store or update a User's FCM token, keyed by userId.
     */
    async storeUserToken(userId, fcmToken) {
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
    async storeGuardianMapping(userId, guardianId) {
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
exports.FirebaseAdminService = FirebaseAdminService;
/** Singleton instance for use across the application. */
exports.firebaseAdminService = new FirebaseAdminService();
//# sourceMappingURL=FirebaseAdminService.js.map
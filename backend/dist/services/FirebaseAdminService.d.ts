export declare class FirebaseAdminService {
    /**
     * Send an FCM notification (title + body) to a device token.
     * Requirement 3.1: dispatch within 10 seconds of Risk_Score assignment.
     * Requirement 3.2: include sender, threat summary, risk score, timestamp.
     */
    sendFCMNotification(token: string, payload: object): Promise<void>;
    /**
     * Send an FCM data-only message to a device token.
     * Requirement 3.3: push Guardian action back to User device.
     * Requirement 3.4: mark_safe removes warning within 5 seconds.
     */
    sendFCMDataMessage(token: string, data: Record<string, string>): Promise<void>;
    /**
     * Look up the Guardian FCM token for a given userId.
     * Returns null if no Guardian mapping exists.
     */
    getGuardianToken(userId: string): Promise<string | null>;
    /**
     * Look up the User FCM token for a given guardianId.
     * Returns null if no token is registered.
     */
    getUserToken(guardianId: string): Promise<string | null>;
    /**
     * Store or update a User's FCM token, keyed by userId.
     */
    storeUserToken(userId: string, fcmToken: string): Promise<void>;
    /**
     * Store a User↔Guardian mapping in Firestore (or in-memory fallback).
     */
    storeGuardianMapping(userId: string, guardianId: string): Promise<void>;
}
/** Singleton instance for use across the application. */
export declare const firebaseAdminService: FirebaseAdminService;
//# sourceMappingURL=FirebaseAdminService.d.ts.map
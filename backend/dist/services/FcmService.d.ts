import { AlertPayload, GuardianAction } from '../models/types';
/**
 * Send a Guardian alert push notification.
 * Requirement 3.1: dispatch within 10 seconds of Risk_Score assignment.
 * Requirement 3.2: include sender, threat summary, risk score, timestamp.
 */
export declare function sendGuardianAlert(guardianFcmToken: string, payload: AlertPayload, notificationId: string): Promise<string>;
/**
 * Send a Guardian reminder notification for an unresponded alert.
 * Requirement 3.5: follow-up reminder if Guardian does not respond within 30 minutes.
 */
export declare function sendGuardianReminder(guardianFcmToken: string, notificationId: string, userId: string, sender: string, riskScore: number): Promise<string>;
/**
 * Push a Guardian action result back to the User device.
 * Requirement 3.3: Guardian can mark safe, confirm scam, or call user.
 * Requirement 3.4: mark_safe removes warning from User screen within 5 seconds.
 */
export declare function sendUserActionUpdate(userFcmToken: string, action: GuardianAction): Promise<string>;
//# sourceMappingURL=FcmService.d.ts.map
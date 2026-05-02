/**
 * ScamGuardian Backend — Shared TypeScript Interfaces
 *
 * These types mirror src/models/types.ts in the mobile client.
 * In a monorepo setup these would be extracted to a shared package.
 */
export interface MessageEvent {
    id: string;
    channel: 'whatsapp' | 'sms' | 'email' | 'other';
    sender: string;
    body: string;
    attachments: Attachment[];
    timestamp: Date;
}
export interface Attachment {
    filename: string;
    mimeType: string;
    extension: string;
    sizeBytes: number;
}
export interface ThreatAnalysis {
    messageId: string;
    riskScore: number;
    indicators: ThreatIndicator[];
    analyzedAt: Date;
}
export interface ThreatIndicator {
    type: 'phishing_url' | 'urgency_language' | 'impersonation' | 'investment_scam' | 'malicious_attachment';
    confidence: number;
    evidence: string;
}
export interface AlertPayload {
    userId: string;
    messageId: string;
    sender: string;
    threatSummary: string;
    riskScore: number;
    timestamp: string;
    userRequestedHelp: boolean;
}
export interface GuardianAction {
    messageId: string;
    action: 'mark_safe' | 'confirm_scam' | 'call_user';
    guardianId: string;
    timestamp: string;
}
export interface UserProfile {
    userId: string;
    guardianId: string;
    guardianContact: string;
    safeModeEnabled: boolean;
    largeFontEnabled: boolean;
    fcmToken: string;
    onboardingComplete: boolean;
}
export interface AuditLogEntry {
    id: string;
    timestamp: Date;
    sender: string;
    riskScore: number;
    threatTypes: ThreatIndicator['type'][];
    outcome: 'user_safe' | 'user_help' | 'guardian_safe' | 'guardian_scam' | 'pending';
    messagePreview: string;
}
export interface GuardianNotification {
    notificationId: string;
    userId: string;
    messageId: string;
    sender: string;
    threatSummary: string;
    riskScore: number;
    timestamp: Date;
    responded: boolean;
    respondedAt?: Date;
    reminderSentAt?: Date;
}
//# sourceMappingURL=types.d.ts.map
/**
 * ScamGuardian — Shared TypeScript Interfaces
 *
 * All domain types used across the mobile client and backend are defined here.
 * Requirements: 1.1, 1.2, 7.1
 */

// ---------------------------------------------------------------------------
// Message Capture
// ---------------------------------------------------------------------------

/**
 * Represents a single message received in a monitored channel.
 * Emitted by the Message Listener (Accessibility Service / Share Extension).
 */
export interface MessageEvent {
  /** UUID generated at capture time */
  id: string;
  /** The channel through which the message was received */
  channel: 'whatsapp' | 'sms' | 'email' | 'other';
  /** Display name or phone number of the sender */
  sender: string;
  /** Full text content of the message */
  body: string;
  /** Any file attachments included with the message */
  attachments: Attachment[];
  /** When the message was received */
  timestamp: Date;
}

/**
 * Metadata for a file attachment included in a MessageEvent.
 */
export interface Attachment {
  filename: string;
  mimeType: string;
  /** File extension including the leading dot, e.g. ".pdf" */
  extension: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Threat Analysis
// ---------------------------------------------------------------------------

/**
 * The result produced by ThreatAnalyzerService for a single message.
 * Requirement 1.2: ScamGuardian SHALL assign a Risk_Score to the Message.
 */
export interface ThreatAnalysis {
  messageId: string;
  /** Numeric risk score in the range 0–100 */
  riskScore: number;
  /** Individual scam signals detected in the message */
  indicators: ThreatIndicator[];
  analyzedAt: Date;
}

/**
 * A single scam signal detected by one of the Threat_Analyzer sub-modules.
 */
export interface ThreatIndicator {
  type:
    | 'phishing_url'
    | 'urgency_language'
    | 'impersonation'
    | 'investment_scam'
    | 'malicious_attachment';
  /** Confidence that this indicator is a genuine threat, in the range 0–1 */
  confidence: number;
  /** Human-readable snippet of evidence from the message */
  evidence: string;
}

// ---------------------------------------------------------------------------
// Alerting
// ---------------------------------------------------------------------------

/**
 * Payload sent from the mobile client to the backend Alert API when a
 * high-risk message is detected (riskScore ≥ 70).
 * Requirements: 3.1, 3.2
 */
export interface AlertPayload {
  userId: string;
  messageId: string;
  /** Display name or phone number of the message sender */
  sender: string;
  /** Plain-language summary of the detected threat (≤ Grade 6 reading level) */
  threatSummary: string;
  riskScore: number;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** True when the User explicitly tapped "I'm not sure — ask my family" */
  userRequestedHelp: boolean;
}

/**
 * An action taken by the Guardian in response to an alert notification.
 * Requirement 3.3
 */
export interface GuardianAction {
  messageId: string;
  action: 'mark_safe' | 'confirm_scam' | 'call_user';
  guardianId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// User & Guardian Profiles
// ---------------------------------------------------------------------------

/**
 * Persisted profile for the protected User.
 * Requirement 5.1, 5.3
 */
export interface UserProfile {
  userId: string;
  /** ID of the designated Guardian */
  guardianId: string;
  /** Phone number or email address of the Guardian */
  guardianContact: string;
  /** When true, all outbound links require Guardian approval before opening */
  safeModeEnabled: boolean;
  /** When true, all warning text is rendered at ≥ 20sp */
  largeFontEnabled: boolean;
  /** Firebase Cloud Messaging token for this device */
  fcmToken: string;
  /** Whether the Onboarding_Flow has been completed */
  onboardingComplete: boolean;
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

/**
 * A single entry in the local audit log.
 * Written for every message with riskScore ≥ 40.
 * Requirement 7.1
 */
export interface AuditLogEntry {
  /** UUID */
  id: string;
  timestamp: Date;
  sender: string;
  riskScore: number;
  /** The threat types detected in this message */
  threatTypes: ThreatIndicator['type'][];
  /** The final outcome after User and/or Guardian action */
  outcome:
    | 'user_safe'
    | 'user_help'
    | 'guardian_safe'
    | 'guardian_scam'
    | 'pending';
  /** First 200 characters of the message body; no PII beyond sender */
  messagePreview: string;
}

// ---------------------------------------------------------------------------
// Guardian Notifications
// ---------------------------------------------------------------------------

/**
 * Tracks a push notification sent to the Guardian, including reminder state.
 * Requirement 3.5
 */
export interface GuardianNotification {
  notificationId: string;
  userId: string;
  messageId: string;
  sender: string;
  /** Plain-language summary of the detected threat */
  threatSummary: string;
  riskScore: number;
  timestamp: Date;
  /** Whether the Guardian has responded to this notification */
  responded: boolean;
  /** When the Guardian responded (undefined if not yet responded) */
  respondedAt?: Date;
  /** When the 30-minute reminder was sent (undefined if not yet sent) */
  reminderSentAt?: Date;
}

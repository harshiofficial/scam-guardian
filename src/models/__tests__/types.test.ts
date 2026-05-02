/**
 * Compile-time and runtime sanity checks for shared TypeScript interfaces.
 * Requirements: 1.1, 1.2, 7.1
 */
import {
  MessageEvent,
  Attachment,
  ThreatAnalysis,
  ThreatIndicator,
  AlertPayload,
  GuardianAction,
  UserProfile,
  AuditLogEntry,
  GuardianNotification,
} from '../types';

describe('Shared TypeScript interfaces', () => {
  it('MessageEvent can be constructed with all required fields', () => {
    const attachment: Attachment = {
      filename: 'invoice.pdf',
      mimeType: 'application/pdf',
      extension: '.pdf',
      sizeBytes: 102400,
    };

    const event: MessageEvent = {
      id: 'msg-001',
      channel: 'whatsapp',
      sender: '+1234567890',
      body: 'Click here to claim your prize!',
      attachments: [attachment],
      timestamp: new Date(),
    };

    expect(event.id).toBe('msg-001');
    expect(event.channel).toBe('whatsapp');
    expect(event.attachments).toHaveLength(1);
    expect(event.attachments[0].extension).toBe('.pdf');
  });

  it('ThreatAnalysis holds a riskScore in 0–100 range', () => {
    const indicator: ThreatIndicator = {
      type: 'phishing_url',
      confidence: 0.95,
      evidence: 'http://evil-bank.com/login',
    };

    const analysis: ThreatAnalysis = {
      messageId: 'msg-001',
      riskScore: 85,
      indicators: [indicator],
      analyzedAt: new Date(),
    };

    expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
    expect(analysis.riskScore).toBeLessThanOrEqual(100);
    expect(analysis.indicators[0].type).toBe('phishing_url');
  });

  it('AlertPayload includes all required fields', () => {
    const payload: AlertPayload = {
      userId: 'user-123',
      messageId: 'msg-001',
      sender: 'Unknown Caller',
      threatSummary: 'This message looks like a scam.',
      riskScore: 85,
      timestamp: new Date().toISOString(),
      userRequestedHelp: true,
    };

    expect(payload.userRequestedHelp).toBe(true);
    expect(typeof payload.timestamp).toBe('string');
  });

  it('GuardianAction supports all valid action types', () => {
    const actions: GuardianAction['action'][] = [
      'mark_safe',
      'confirm_scam',
      'call_user',
    ];

    actions.forEach(action => {
      const guardianAction: GuardianAction = {
        messageId: 'msg-001',
        action,
        guardianId: 'guardian-456',
        timestamp: new Date().toISOString(),
      };
      expect(guardianAction.action).toBe(action);
    });
  });

  it('UserProfile has all required boolean flags', () => {
    const profile: UserProfile = {
      userId: 'user-123',
      guardianId: 'guardian-456',
      guardianContact: '+0987654321',
      safeModeEnabled: false,
      largeFontEnabled: true,
      fcmToken: 'fcm-token-abc',
      onboardingComplete: false,
    };

    expect(typeof profile.safeModeEnabled).toBe('boolean');
    expect(typeof profile.largeFontEnabled).toBe('boolean');
    expect(typeof profile.onboardingComplete).toBe('boolean');
  });

  it('AuditLogEntry supports all valid outcome values', () => {
    const outcomes: AuditLogEntry['outcome'][] = [
      'user_safe',
      'user_help',
      'guardian_safe',
      'guardian_scam',
      'pending',
    ];

    outcomes.forEach(outcome => {
      const entry: AuditLogEntry = {
        id: 'entry-001',
        timestamp: new Date(),
        sender: '+1234567890',
        riskScore: 75,
        threatTypes: ['urgency_language'],
        outcome,
        messagePreview: 'Act now or lose your account',
      };
      expect(entry.outcome).toBe(outcome);
    });
  });

  it('GuardianNotification has optional respondedAt and reminderSentAt', () => {
    const notification: GuardianNotification = {
      notificationId: 'notif-001',
      userId: 'user-123',
      messageId: 'msg-001',
      sender: '+1234567890',
      threatSummary: 'Possible phishing attempt detected.',
      riskScore: 85,
      timestamp: new Date(),
      responded: false,
    };

    expect(notification.respondedAt).toBeUndefined();
    expect(notification.reminderSentAt).toBeUndefined();

    const respondedNotification: GuardianNotification = {
      ...notification,
      responded: true,
      respondedAt: new Date(),
    };

    expect(respondedNotification.respondedAt).toBeInstanceOf(Date);
  });

  it('ThreatIndicator supports all valid threat types', () => {
    const types: ThreatIndicator['type'][] = [
      'phishing_url',
      'urgency_language',
      'impersonation',
      'investment_scam',
      'malicious_attachment',
    ];

    types.forEach(type => {
      const indicator: ThreatIndicator = {
        type,
        confidence: 0.8,
        evidence: 'sample evidence',
      };
      expect(indicator.type).toBe(type);
    });
  });

  it('MessageEvent supports all valid channel values', () => {
    const channels: MessageEvent['channel'][] = [
      'whatsapp',
      'sms',
      'email',
      'other',
    ];

    channels.forEach(channel => {
      const event: MessageEvent = {
        id: 'msg-001',
        channel,
        sender: 'test',
        body: 'test body',
        attachments: [],
        timestamp: new Date(),
      };
      expect(event.channel).toBe(channel);
    });
  });
});

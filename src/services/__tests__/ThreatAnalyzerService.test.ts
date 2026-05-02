/**
 * Integration tests for ThreatAnalyzerService
 *
 * These tests exercise the full analysis pipeline:
 *   URLChecker → TextClassifier → AttachmentScanner → RiskScoreEngine
 *
 * The SQLite layer is covered by the in-memory mock in
 * src/__mocks__/react-native-sqlite-storage.ts, so no real database is
 * required.
 *
 * Covers:
 *  - Clean message returns riskScore 0 and empty indicators
 *  - Message with a blocklisted URL returns phishing_url indicator and non-zero score
 *  - Message with urgency language returns urgency_language indicator
 *  - Message with impersonation pattern returns impersonation indicator
 *  - Message with investment scam pattern returns investment_scam indicator
 *  - Message with a malicious attachment returns malicious_attachment indicator
 *  - Message combining multiple threat types accumulates all indicators
 *  - riskScore is always in the range [0, 100]
 *  - analyzedAt is a recent Date
 *  - messageId matches the input message id
 *  - Lazy initialisation: analyze() can be called without manually calling open()
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { ThreatAnalyzerServiceClass } from '../ThreatAnalyzerService';
import type { MessageEvent, Attachment } from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(overrides: Partial<MessageEvent> = {}): MessageEvent {
  return {
    id: 'msg-test-001',
    channel: 'sms',
    sender: 'Unknown',
    body: '',
    attachments: [],
    timestamp: new Date(),
    ...overrides,
  };
}

function makeAttachment(filename: string, extension: string): Attachment {
  return {
    filename,
    mimeType: 'application/octet-stream',
    extension,
    sizeBytes: 1024,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThreatAnalyzerService', () => {
  let service: ThreatAnalyzerServiceClass;

  beforeEach(() => {
    // Use a fresh instance per test so lazy-init state is reset
    service = new ThreatAnalyzerServiceClass();
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  describe('return shape', () => {
    it('returns a ThreatAnalysis with the correct messageId', async () => {
      const message = makeMessage({ id: 'abc-123', body: 'Hello there' });
      const result = await service.analyze(message);
      expect(result.messageId).toBe('abc-123');
    });

    it('returns analyzedAt as a Date close to now', async () => {
      const before = Date.now();
      const result = await service.analyze(makeMessage({ body: 'Hello' }));
      const after = Date.now();
      expect(result.analyzedAt).toBeInstanceOf(Date);
      expect(result.analyzedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.analyzedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('riskScore is always in the range [0, 100]', async () => {
      const result = await service.analyze(makeMessage({ body: 'Hello' }));
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  // -------------------------------------------------------------------------
  // Clean message
  // -------------------------------------------------------------------------

  describe('clean message', () => {
    it('returns riskScore 0 for a message with no threats', async () => {
      const result = await service.analyze(
        makeMessage({ body: 'Hi, how are you doing today?' }),
      );
      expect(result.riskScore).toBe(0);
    });

    it('returns an empty indicators array for a clean message', async () => {
      const result = await service.analyze(
        makeMessage({ body: 'Hi, how are you doing today?' }),
      );
      expect(result.indicators).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // URL detection (Requirement 2.1)
  // -------------------------------------------------------------------------

  describe('phishing URL detection', () => {
    it('returns a phishing_url indicator for a message containing a blocklisted URL', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'Click here: https://evil-bank.com/login to verify your account',
        }),
      );
      const urlIndicators = result.indicators.filter(
        i => i.type === 'phishing_url',
      );
      expect(urlIndicators).toHaveLength(1);
      expect(urlIndicators[0].confidence).toBe(1.0);
    });

    it('produces a non-zero riskScore when a phishing URL is detected', async () => {
      const result = await service.analyze(
        makeMessage({ body: 'Visit https://evil-bank.com now' }),
      );
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it('returns no phishing_url indicator for a message with only clean URLs', async () => {
      const result = await service.analyze(
        makeMessage({ body: 'Check out https://google.com for more info' }),
      );
      const urlIndicators = result.indicators.filter(
        i => i.type === 'phishing_url',
      );
      expect(urlIndicators).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Text classification (Requirements 2.2, 2.3, 2.4)
  // -------------------------------------------------------------------------

  describe('urgency language detection (Requirement 2.2)', () => {
    it('returns an urgency_language indicator for a message with urgency phrases', async () => {
      const result = await service.analyze(
        makeMessage({ body: 'Act now! Your account will be closed immediately.' }),
      );
      const urgencyIndicators = result.indicators.filter(
        i => i.type === 'urgency_language',
      );
      expect(urgencyIndicators).toHaveLength(1);
      expect(urgencyIndicators[0].confidence).toBeGreaterThan(0);
    });

    it('produces a non-zero riskScore when urgency language is detected', async () => {
      const result = await service.analyze(
        makeMessage({ body: 'Urgent: verify now or your account will be closed.' }),
      );
      expect(result.riskScore).toBeGreaterThan(0);
    });
  });

  describe('impersonation detection (Requirement 2.3)', () => {
    it('returns an impersonation indicator for a message impersonating a bank', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'This is your bank. Please verify your details with Chase Bank.',
        }),
      );
      const impersonationIndicators = result.indicators.filter(
        i => i.type === 'impersonation',
      );
      expect(impersonationIndicators).toHaveLength(1);
    });

    it('returns an impersonation indicator for a government impersonation', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'The IRS requires you to pay your outstanding tax immediately.',
        }),
      );
      const impersonationIndicators = result.indicators.filter(
        i => i.type === 'impersonation',
      );
      expect(impersonationIndicators).toHaveLength(1);
    });
  });

  describe('investment/prize scam detection (Requirement 2.4)', () => {
    it('returns an investment_scam indicator for a prize offer', async () => {
      const result = await service.analyze(
        makeMessage({ body: 'Congratulations you have won a free iPhone!' }),
      );
      const investmentIndicators = result.indicators.filter(
        i => i.type === 'investment_scam',
      );
      expect(investmentIndicators).toHaveLength(1);
    });

    it('returns an investment_scam indicator for a guaranteed returns offer', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'Guaranteed returns on your crypto opportunity investment!',
        }),
      );
      const investmentIndicators = result.indicators.filter(
        i => i.type === 'investment_scam',
      );
      expect(investmentIndicators).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Attachment scanning (Requirement 2.5)
  // -------------------------------------------------------------------------

  describe('malicious attachment detection (Requirement 2.5)', () => {
    it('returns a malicious_attachment indicator for a .exe attachment', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'Please open the attached file.',
          attachments: [makeAttachment('setup.exe', '.exe')],
        }),
      );
      const attachmentIndicators = result.indicators.filter(
        i => i.type === 'malicious_attachment',
      );
      expect(attachmentIndicators).toHaveLength(1);
      expect(attachmentIndicators[0].confidence).toBe(0.9);
    });

    it('returns a malicious_attachment indicator for a .apk attachment', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'Install this app.',
          attachments: [makeAttachment('app.apk', '.apk')],
        }),
      );
      const attachmentIndicators = result.indicators.filter(
        i => i.type === 'malicious_attachment',
      );
      expect(attachmentIndicators).toHaveLength(1);
    });

    it('returns no malicious_attachment indicator for a safe attachment', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'See the attached document.',
          attachments: [makeAttachment('report.pdf', '.pdf')],
        }),
      );
      const attachmentIndicators = result.indicators.filter(
        i => i.type === 'malicious_attachment',
      );
      expect(attachmentIndicators).toHaveLength(0);
    });

    it('produces a non-zero riskScore when a malicious attachment is present', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'Open this.',
          attachments: [makeAttachment('virus.exe', '.exe')],
        }),
      );
      expect(result.riskScore).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Combined threats
  // -------------------------------------------------------------------------

  describe('combined threat detection', () => {
    it('accumulates indicators from all sub-modules when multiple threats are present', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'Act now! Visit https://evil-bank.com — you have won a free iPhone!',
          attachments: [makeAttachment('malware.exe', '.exe')],
        }),
      );

      const types = result.indicators.map(i => i.type);
      expect(types).toContain('phishing_url');
      expect(types).toContain('urgency_language');
      expect(types).toContain('investment_scam');
      expect(types).toContain('malicious_attachment');
    });

    it('produces a higher riskScore when multiple threat types are combined', async () => {
      const singleThreat = await service.analyze(
        makeMessage({ body: 'Act now!' }),
      );
      const multipleThreat = await service.analyze(
        makeMessage({
          body: 'Act now! Visit https://evil-bank.com',
          attachments: [makeAttachment('virus.exe', '.exe')],
        }),
      );
      expect(multipleThreat.riskScore).toBeGreaterThan(singleThreat.riskScore);
    });

    it('riskScore stays within [0, 100] even with all threat types present', async () => {
      const result = await service.analyze(
        makeMessage({
          body: 'Act now! Visit https://evil-bank.com — you have won! Chase Bank IRS guaranteed returns.',
          attachments: [makeAttachment('virus.exe', '.exe')],
        }),
      );
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  // -------------------------------------------------------------------------
  // Lazy initialisation
  // -------------------------------------------------------------------------

  describe('lazy initialisation', () => {
    it('can be called multiple times without re-opening URLChecker', async () => {
      // Both calls should succeed without throwing
      await service.analyze(makeMessage({ body: 'Hello' }));
      await service.analyze(makeMessage({ body: 'Hello again' }));
    });
  });
});

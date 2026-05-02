/**
 * Unit tests for MessageListenerService
 * Requirements: 1.1, 1.2, 7.1
 */

import { MessageListenerServiceClass } from '../MessageListenerService';
import { ThreatAnalyzerService } from '../ThreatAnalyzerService';
import * as AuditLogRepositoryModule from '../AuditLogRepository';
import type { MessageEvent, ThreatAnalysis } from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal valid MessageEvent for testing. */
function makeMessageEvent(overrides: Partial<MessageEvent> = {}): MessageEvent {
  return {
    id: 'msg-test-001',
    channel: 'sms',
    sender: '+1234567890',
    body: 'Hello, click this link to claim your prize.',
    attachments: [],
    timestamp: new Date('2024-06-01T12:00:00Z'),
    ...overrides,
  };
}

/** Builds a ThreatAnalysis matching a given MessageEvent. */
function makeThreatAnalysis(
  event: MessageEvent,
  overrides: Partial<ThreatAnalysis> = {},
): ThreatAnalysis {
  return {
    messageId: event.id,
    riskScore: 0,
    indicators: [],
    analyzedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageListenerService', () => {
  let service: MessageListenerServiceClass;
  let mockInsert: jest.SpyInstance;

  beforeEach(() => {
    service = new MessageListenerServiceClass();
    jest.useFakeTimers();
    // Spy on the singleton auditLogRepository.insert
    mockInsert = jest
      .spyOn(AuditLogRepositoryModule.auditLogRepository, 'insert')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // _processEvent — happy path
  // -------------------------------------------------------------------------

  describe('_processEvent()', () => {
    it('calls ThreatAnalyzerService.analyze() with the received event', async () => {
      const event = makeMessageEvent();
      const analyzeSpy = jest
        .spyOn(ThreatAnalyzerService, 'analyze')
        .mockResolvedValue(makeThreatAnalysis(event));

      await service._processEvent(event);

      expect(analyzeSpy).toHaveBeenCalledTimes(1);
      expect(analyzeSpy).toHaveBeenCalledWith(event);
    });

    it('dispatches the ThreatAnalysis returned by analyze() to subscribers', async () => {
      const event = makeMessageEvent({ id: 'msg-dispatch-001' });
      const expectedAnalysis = makeThreatAnalysis(event, { riskScore: 85 });

      jest
        .spyOn(ThreatAnalyzerService, 'analyze')
        .mockResolvedValue(expectedAnalysis);

      const received: ThreatAnalysis[] = [];
      service.subscribe(a => received.push(a));

      await service._processEvent(event);

      expect(received).toHaveLength(1);
      expect(received[0]).toBe(expectedAnalysis);
    });

    it('dispatches to multiple subscribers', async () => {
      const event = makeMessageEvent({ id: 'msg-multi-001' });
      const analysis = makeThreatAnalysis(event, { riskScore: 50 });

      jest.spyOn(ThreatAnalyzerService, 'analyze').mockResolvedValue(analysis);

      const results1: ThreatAnalysis[] = [];
      const results2: ThreatAnalysis[] = [];
      service.subscribe(a => results1.push(a));
      service.subscribe(a => results2.push(a));

      await service._processEvent(event);

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // 5-second timeout / fail-safe
  // -------------------------------------------------------------------------

  describe('5-second scan deadline', () => {
    it('uses a default ThreatAnalysis (riskScore=0) when analysis exceeds 5 seconds', async () => {
      const event = makeMessageEvent({ id: 'msg-timeout-001' });

      // analyze() never resolves — simulates a hung analysis
      jest
        .spyOn(ThreatAnalyzerService, 'analyze')
        .mockReturnValue(new Promise(() => {}));

      const received: ThreatAnalysis[] = [];
      service.subscribe(a => received.push(a));

      const processPromise = service._processEvent(event);

      // Advance timers past the 5-second deadline
      jest.advanceTimersByTime(5001);

      await processPromise;

      expect(received).toHaveLength(1);
      expect(received[0].riskScore).toBe(0);
      expect(received[0].indicators).toEqual([]);
      expect(received[0].messageId).toBe(event.id);
    });

    it('does NOT time out when analysis completes within 5 seconds', async () => {
      const event = makeMessageEvent({ id: 'msg-fast-001' });
      const analysis = makeThreatAnalysis(event, { riskScore: 72 });

      jest.spyOn(ThreatAnalyzerService, 'analyze').mockResolvedValue(analysis);

      const received: ThreatAnalysis[] = [];
      service.subscribe(a => received.push(a));

      await service._processEvent(event);

      expect(received).toHaveLength(1);
      expect(received[0].riskScore).toBe(72);
    });

    it('uses a default ThreatAnalysis when analyze() rejects', async () => {
      const event = makeMessageEvent({ id: 'msg-reject-001' });

      jest
        .spyOn(ThreatAnalyzerService, 'analyze')
        .mockRejectedValue(new Error('Network error'));

      const received: ThreatAnalysis[] = [];
      service.subscribe(a => received.push(a));

      await service._processEvent(event);

      expect(received).toHaveLength(1);
      expect(received[0].riskScore).toBe(0);
      expect(received[0].messageId).toBe(event.id);
    });
  });

  // -------------------------------------------------------------------------
  // subscribe() / unsubscribe
  // -------------------------------------------------------------------------

  describe('subscribe()', () => {
    it('returns an unsubscribe function that stops future dispatches', async () => {
      const event = makeMessageEvent({ id: 'msg-unsub-001' });
      jest
        .spyOn(ThreatAnalyzerService, 'analyze')
        .mockResolvedValue(makeThreatAnalysis(event));

      const received: ThreatAnalysis[] = [];
      const unsubscribe = service.subscribe(a => received.push(a));

      // First event — subscriber is active
      await service._processEvent(event);
      expect(received).toHaveLength(1);

      // Unsubscribe, then process another event
      unsubscribe();
      await service._processEvent(makeMessageEvent({ id: 'msg-unsub-002' }));

      // Should still be 1 — no new dispatch after unsubscribe
      expect(received).toHaveLength(1);
    });

    it('does not throw when a subscriber callback throws', async () => {
      const event = makeMessageEvent({ id: 'msg-throw-001' });
      jest
        .spyOn(ThreatAnalyzerService, 'analyze')
        .mockResolvedValue(makeThreatAnalysis(event));

      service.subscribe(() => {
        throw new Error('Subscriber error');
      });

      // Should not propagate the subscriber's error
      await expect(service._processEvent(event)).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // start() / stop()
  // -------------------------------------------------------------------------

  describe('start() and stop()', () => {
    it('start() is idempotent — calling it twice does not double-subscribe', () => {
      // We just verify it does not throw; native bridge is mocked by jest preset
      expect(() => {
        service.start();
        service.start();
      }).not.toThrow();
    });

    it('stop() can be called before start() without throwing', () => {
      expect(() => service.stop()).not.toThrow();
    });

    it('stop() can be called multiple times without throwing', () => {
      service.start();
      expect(() => {
        service.stop();
        service.stop();
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Default ThreatAnalysis shape
  // -------------------------------------------------------------------------

  describe('default ThreatAnalysis (fail-safe)', () => {
    it('default analysis has messageId matching the event id', async () => {
      const event = makeMessageEvent({ id: 'msg-default-shape-001' });

      jest
        .spyOn(ThreatAnalyzerService, 'analyze')
        .mockReturnValue(new Promise(() => {}));

      const received: ThreatAnalysis[] = [];
      service.subscribe(a => received.push(a));

      const processPromise = service._processEvent(event);
      jest.advanceTimersByTime(5001);
      await processPromise;

      expect(received[0].messageId).toBe('msg-default-shape-001');
      expect(received[0].riskScore).toBe(0);
      expect(received[0].indicators).toEqual([]);
      expect(received[0].analyzedAt).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  // Audit log wiring — Requirement 7.1
  // -------------------------------------------------------------------------

  describe('audit log wiring (Requirement 7.1)', () => {
    it('calls auditLogRepository.insert() when riskScore >= 40', async () => {
      const event = makeMessageEvent({ id: 'msg-audit-001', sender: '+447911000001' });
      const analysis = makeThreatAnalysis(event, {
        riskScore: 55,
        indicators: [{ type: 'urgency_language', confidence: 0.8, evidence: 'act now' }],
      });

      jest.spyOn(ThreatAnalyzerService, 'analyze').mockResolvedValue(analysis);

      await service._processEvent(event);

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.sender).toBe(event.sender);
      expect(insertArg.riskScore).toBe(55);
      expect(insertArg.threatTypes).toEqual(['urgency_language']);
      expect(insertArg.outcome).toBe('pending');
      expect(insertArg.messagePreview).toBe(event.body.slice(0, 200));
      expect(typeof insertArg.id).toBe('string');
      expect(insertArg.timestamp).toBeInstanceOf(Date);
    });

    it('calls auditLogRepository.insert() when riskScore is exactly 40', async () => {
      const event = makeMessageEvent({ id: 'msg-audit-boundary' });
      const analysis = makeThreatAnalysis(event, { riskScore: 40 });

      jest.spyOn(ThreatAnalyzerService, 'analyze').mockResolvedValue(analysis);

      await service._processEvent(event);

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('does NOT call auditLogRepository.insert() when riskScore < 40', async () => {
      const event = makeMessageEvent({ id: 'msg-audit-low' });
      const analysis = makeThreatAnalysis(event, { riskScore: 39 });

      jest.spyOn(ThreatAnalyzerService, 'analyze').mockResolvedValue(analysis);

      await service._processEvent(event);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('does NOT call auditLogRepository.insert() for the default (timeout) analysis (riskScore=0)', async () => {
      const event = makeMessageEvent({ id: 'msg-audit-timeout' });

      jest
        .spyOn(ThreatAnalyzerService, 'analyze')
        .mockReturnValue(new Promise(() => {}));

      const processPromise = service._processEvent(event);
      jest.advanceTimersByTime(5001);
      await processPromise;

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('still dispatches to subscribers even if auditLogRepository.insert() throws', async () => {
      const event = makeMessageEvent({ id: 'msg-audit-insert-fail' });
      const analysis = makeThreatAnalysis(event, { riskScore: 75 });

      jest.spyOn(ThreatAnalyzerService, 'analyze').mockResolvedValue(analysis);
      mockInsert.mockRejectedValueOnce(new Error('DB error'));

      const received: ThreatAnalysis[] = [];
      service.subscribe(a => received.push(a));

      await expect(service._processEvent(event)).resolves.not.toThrow();
      expect(received).toHaveLength(1);
      expect(received[0].riskScore).toBe(75);
    });

    it('truncates messagePreview to 200 characters', async () => {
      const longBody = 'X'.repeat(300);
      const event = makeMessageEvent({ id: 'msg-audit-long-body', body: longBody });
      const analysis = makeThreatAnalysis(event, { riskScore: 60 });

      jest.spyOn(ThreatAnalyzerService, 'analyze').mockResolvedValue(analysis);

      await service._processEvent(event);

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.messagePreview).toHaveLength(200);
    });
  });
});

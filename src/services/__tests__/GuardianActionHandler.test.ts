/**
 * Unit tests for GuardianActionHandler
 *
 * Covers:
 *  - start() subscribes to AlertServiceClient.onGuardianAction
 *  - mark_safe action for regular messages: dismisses warning and updates audit log to 'guardian_safe'
 *  - confirm_scam action for regular messages: dismisses warning and updates audit log to 'guardian_scam'
 *  - mark_safe action for Safe Mode links: routes to SafeModeInterceptor.handleGuardianAction()
 *  - confirm_scam action for Safe Mode links: routes to SafeModeInterceptor.handleGuardianAction()
 *  - call_user action: does NOT dismiss warning or update audit log
 *  - start() returns an unsubscribe function
 *  - dismissWarning is called immediately (synchronously) on mark_safe
 *
 * Requirements: 3.4, 6.3, 6.4
 */

// Mock @react-native-firebase/messaging so AlertServiceClient can be imported
jest.mock('@react-native-firebase/messaging', () => {
  return () => ({
    onMessage: jest.fn(() => jest.fn()),
  });
});

import { GuardianActionHandler } from '../GuardianActionHandler';
import type { GuardianAction } from '../../models/types';
import type { IGuardianActionHandler } from '../SafeModeInterceptor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGuardianAction(
  overrides: Partial<GuardianAction> = {},
): GuardianAction {
  return {
    messageId: 'msg-123',
    action: 'mark_safe',
    guardianId: 'guardian-456',
    timestamp: '2024-01-15T10:35:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * Creates a mock AlertServiceClient with a controllable onGuardianAction.
 * Returns the mock client and a trigger function to simulate incoming actions.
 */
function createMockAlertServiceClient() {
  let capturedCallback: ((action: GuardianAction) => void) | null = null;
  const mockUnsubscribe = jest.fn();

  const mockClient = {
    onGuardianAction: jest.fn((cb: (action: GuardianAction) => void) => {
      capturedCallback = cb;
      return mockUnsubscribe;
    }),
  } as unknown as typeof import('../AlertServiceClient').AlertServiceClient;

  const triggerAction = (action: GuardianAction) => {
    if (!capturedCallback) {
      throw new Error('onGuardianAction callback not yet registered');
    }
    return capturedCallback(action);
  };

  return { mockClient, mockUnsubscribe, triggerAction };
}

/**
 * Creates a mock AuditLogRepository with a jest-spied updateOutcome.
 */
function createMockAuditLogRepository() {
  return {
    updateOutcome: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('../AuditLogRepository').AuditLogRepository;
}

/**
 * Creates a mock SafeModeInterceptor with a jest-spied handleGuardianAction.
 */
function createMockSafeModeInterceptor() {
  return {
    handleGuardianAction: jest.fn().mockResolvedValue({ status: 'opened' }),
  } as unknown as import('../SafeModeInterceptor').SafeModeInterceptor;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GuardianActionHandler', () => {
  let dismissWarning: jest.Mock;

  beforeEach(() => {
    dismissWarning = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // start() — subscription
  // -------------------------------------------------------------------------

  describe('start()', () => {
    it('subscribes to AlertServiceClient.onGuardianAction', () => {
      const { mockClient } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);

      expect(mockClient.onGuardianAction).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function', () => {
      const { mockClient } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      const unsubscribe = handler.start(dismissWarning);

      expect(typeof unsubscribe).toBe('function');
    });

    it('the returned unsubscribe function is the one from onGuardianAction', () => {
      const { mockClient, mockUnsubscribe } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      const unsubscribe = handler.start(dismissWarning);
      unsubscribe();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // mark_safe action — Requirement 3.4
  // -------------------------------------------------------------------------

  describe('mark_safe action', () => {
    it('calls dismissWarning when action is mark_safe', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);
      await triggerAction(makeGuardianAction({ action: 'mark_safe' }));

      expect(dismissWarning).toHaveBeenCalledTimes(1);
    });

    it('updates audit log outcome to guardian_safe when action is mark_safe', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);
      await triggerAction(
        makeGuardianAction({ action: 'mark_safe', messageId: 'msg-abc' }),
      );

      expect(mockRepo.updateOutcome).toHaveBeenCalledWith('msg-abc', 'guardian_safe');
    });

    it('calls dismissWarning before (or at the same time as) updateOutcome for mark_safe', async () => {
      const callOrder: string[] = [];
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = {
        updateOutcome: jest.fn().mockImplementation(async () => {
          callOrder.push('updateOutcome');
        }),
      } as unknown as import('../AuditLogRepository').AuditLogRepository;

      const trackingDismiss = jest.fn().mockImplementation(() => {
        callOrder.push('dismissWarning');
      });

      const handler = new GuardianActionHandler(mockClient, mockRepo);
      handler.start(trackingDismiss);
      await triggerAction(makeGuardianAction({ action: 'mark_safe' }));

      // dismissWarning must be called before updateOutcome
      expect(callOrder[0]).toBe('dismissWarning');
      expect(callOrder[1]).toBe('updateOutcome');
    });

    it('passes the correct messageId to updateOutcome for mark_safe', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);
      await triggerAction(
        makeGuardianAction({ action: 'mark_safe', messageId: 'specific-msg-id' }),
      );

      expect(mockRepo.updateOutcome).toHaveBeenCalledWith(
        'specific-msg-id',
        'guardian_safe',
      );
    });
  });

  // -------------------------------------------------------------------------
  // confirm_scam action
  // -------------------------------------------------------------------------

  describe('confirm_scam action', () => {
    it('calls dismissWarning when action is confirm_scam', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);
      await triggerAction(makeGuardianAction({ action: 'confirm_scam' }));

      expect(dismissWarning).toHaveBeenCalledTimes(1);
    });

    it('updates audit log outcome to guardian_scam when action is confirm_scam', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);
      await triggerAction(
        makeGuardianAction({ action: 'confirm_scam', messageId: 'msg-xyz' }),
      );

      expect(mockRepo.updateOutcome).toHaveBeenCalledWith('msg-xyz', 'guardian_scam');
    });

    it('passes the correct messageId to updateOutcome for confirm_scam', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);
      await triggerAction(
        makeGuardianAction({ action: 'confirm_scam', messageId: 'scam-msg-999' }),
      );

      expect(mockRepo.updateOutcome).toHaveBeenCalledWith(
        'scam-msg-999',
        'guardian_scam',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Safe Mode link handling — Requirements 6.3, 6.4
  // -------------------------------------------------------------------------

  describe('Safe Mode link handling', () => {
    it('routes mark_safe action to SafeModeInterceptor for registered Safe Mode links', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const mockInterceptor = createMockSafeModeInterceptor();
      const handler = new GuardianActionHandler(mockClient, mockRepo, mockInterceptor);

      // Register a Safe Mode link
      const linkMessageId = 'link-123456';
      const linkUrl = 'https://example.com/safe-link';
      handler.registerSafeModeLink(linkMessageId, linkUrl);

      handler.start(dismissWarning);
      const action = makeGuardianAction({
        action: 'mark_safe',
        messageId: linkMessageId,
      });
      await triggerAction(action);

      // Should route to SafeModeInterceptor, not dismiss warning or update audit log
      expect(mockInterceptor.handleGuardianAction).toHaveBeenCalledWith(
        action,
        linkUrl,
      );
      expect(dismissWarning).not.toHaveBeenCalled();
      expect(mockRepo.updateOutcome).not.toHaveBeenCalled();
    });

    it('routes confirm_scam action to SafeModeInterceptor for registered Safe Mode links', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const mockInterceptor = createMockSafeModeInterceptor();
      const handler = new GuardianActionHandler(mockClient, mockRepo, mockInterceptor);

      // Register a Safe Mode link
      const linkMessageId = 'link-789012';
      const linkUrl = 'https://example.com/blocked-link';
      handler.registerSafeModeLink(linkMessageId, linkUrl);

      handler.start(dismissWarning);
      const action = makeGuardianAction({
        action: 'confirm_scam',
        messageId: linkMessageId,
      });
      await triggerAction(action);

      // Should route to SafeModeInterceptor, not dismiss warning or update audit log
      expect(mockInterceptor.handleGuardianAction).toHaveBeenCalledWith(
        action,
        linkUrl,
      );
      expect(dismissWarning).not.toHaveBeenCalled();
      expect(mockRepo.updateOutcome).not.toHaveBeenCalled();
    });

    it('cleans up Safe Mode link registration after handling', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const mockInterceptor = createMockSafeModeInterceptor();
      const handler = new GuardianActionHandler(mockClient, mockRepo, mockInterceptor);

      const linkMessageId = 'link-cleanup-test';
      const linkUrl = 'https://example.com/cleanup';
      handler.registerSafeModeLink(linkMessageId, linkUrl);

      handler.start(dismissWarning);
      await triggerAction(
        makeGuardianAction({
          action: 'mark_safe',
          messageId: linkMessageId,
        }),
      );

      // Trigger another action with the same messageId — should NOT route to SafeModeInterceptor
      // (because the link was cleaned up)
      mockInterceptor.handleGuardianAction.mockClear();
      await triggerAction(
        makeGuardianAction({
          action: 'mark_safe',
          messageId: linkMessageId,
        }),
      );

      // This time it should be treated as a regular message
      expect(mockInterceptor.handleGuardianAction).not.toHaveBeenCalled();
      expect(dismissWarning).toHaveBeenCalled();
      expect(mockRepo.updateOutcome).toHaveBeenCalledWith(
        linkMessageId,
        'guardian_safe',
      );
    });

    it('handles Safe Mode links when SafeModeInterceptor is null', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo, null);

      const linkMessageId = 'link-no-interceptor';
      handler.registerSafeModeLink(linkMessageId, 'https://example.com');

      handler.start(dismissWarning);
      await triggerAction(
        makeGuardianAction({
          action: 'mark_safe',
          messageId: linkMessageId,
        }),
      );

      // Should not crash; should treat as regular message
      expect(dismissWarning).toHaveBeenCalled();
      expect(mockRepo.updateOutcome).toHaveBeenCalledWith(
        linkMessageId,
        'guardian_safe',
      );
    });
  });

  // -------------------------------------------------------------------------
  // call_user action — no side effects
  // -------------------------------------------------------------------------

  describe('call_user action', () => {
    it('does NOT call dismissWarning when action is call_user', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);
      await triggerAction(makeGuardianAction({ action: 'call_user' }));

      expect(dismissWarning).not.toHaveBeenCalled();
    });

    it('does NOT update the audit log when action is call_user', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);
      await triggerAction(makeGuardianAction({ action: 'call_user' }));

      expect(mockRepo.updateOutcome).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Multiple actions
  // -------------------------------------------------------------------------

  describe('multiple sequential actions', () => {
    it('handles multiple mark_safe actions independently', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);

      await triggerAction(
        makeGuardianAction({ action: 'mark_safe', messageId: 'msg-1' }),
      );
      await triggerAction(
        makeGuardianAction({ action: 'mark_safe', messageId: 'msg-2' }),
      );

      expect(dismissWarning).toHaveBeenCalledTimes(2);
      expect(mockRepo.updateOutcome).toHaveBeenCalledTimes(2);
      expect(mockRepo.updateOutcome).toHaveBeenNthCalledWith(1, 'msg-1', 'guardian_safe');
      expect(mockRepo.updateOutcome).toHaveBeenNthCalledWith(2, 'msg-2', 'guardian_safe');
    });

    it('handles mixed actions correctly', async () => {
      const { mockClient, triggerAction } = createMockAlertServiceClient();
      const mockRepo = createMockAuditLogRepository();
      const handler = new GuardianActionHandler(mockClient, mockRepo);

      handler.start(dismissWarning);

      await triggerAction(
        makeGuardianAction({ action: 'mark_safe', messageId: 'msg-safe' }),
      );
      await triggerAction(
        makeGuardianAction({ action: 'call_user', messageId: 'msg-call' }),
      );
      await triggerAction(
        makeGuardianAction({ action: 'confirm_scam', messageId: 'msg-scam' }),
      );

      // dismissWarning called for mark_safe and confirm_scam, not call_user
      expect(dismissWarning).toHaveBeenCalledTimes(2);

      // updateOutcome called for mark_safe and confirm_scam only
      expect(mockRepo.updateOutcome).toHaveBeenCalledTimes(2);
      expect(mockRepo.updateOutcome).toHaveBeenCalledWith('msg-safe', 'guardian_safe');
      expect(mockRepo.updateOutcome).toHaveBeenCalledWith('msg-scam', 'guardian_scam');
    });
  });
});

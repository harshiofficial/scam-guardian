/**
 * Unit tests for SafeModeInterceptor
 *
 * Covers:
 *   - Link open with safeModeEnabled=true is intercepted and alert is sent
 *   - Link open with safeModeEnabled=false passes through unmodified (Linking.openURL called)
 *   - Guardian 'mark_safe' action opens the link in the device browser
 *   - Guardian 'confirm_scam' action dismisses the waiting screen and shows a blocked message
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { Linking } from 'react-native';
import { SafeModeInterceptor } from '../SafeModeInterceptor';
import type { IAlertServiceClient } from '../SafeModeInterceptor';
import type { AlertPayload, GuardianAction } from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock AlertServiceClient that records calls. */
function makeMockAlertClient(): jest.Mocked<IAlertServiceClient> {
  return {
    sendAlert: jest.fn().mockResolvedValue(undefined),
  };
}

/** Builds a minimal GuardianAction for testing. */
function makeGuardianAction(
  action: GuardianAction['action'],
  overrides: Partial<GuardianAction> = {},
): GuardianAction {
  return {
    messageId: 'msg-safe-mode-001',
    action,
    guardianId: 'guardian-001',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SafeModeInterceptor', () => {
  let alertClient: jest.Mocked<IAlertServiceClient>;
  let interceptor: SafeModeInterceptor;
  let openURLMock: jest.SpyInstance;

  const TEST_URL = 'https://example.com/some-link';
  const USER_ID = 'user-001';
  const GUARDIAN_ID = 'guardian-001';

  beforeEach(() => {
    alertClient = makeMockAlertClient();
    interceptor = new SafeModeInterceptor(alertClient, USER_ID, GUARDIAN_ID);
    // Create a fresh spy and clear any accumulated call history
    openURLMock = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined);
    openURLMock.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // interceptLink — Safe Mode enabled (Requirements 6.1, 6.2)
  // -------------------------------------------------------------------------

  describe('interceptLink() with safeModeEnabled=true', () => {
    it('returns status "intercepted" when Safe Mode is enabled', async () => {
      const result = await interceptor.interceptLink(TEST_URL, true);
      expect(result.status).toBe('intercepted');
    });

    it('returns the "Waiting for your family" message when intercepted', async () => {
      const result = await interceptor.interceptLink(TEST_URL, true);
      expect(result.message).toBe(
        'Waiting for your family to approve this link',
      );
    });

    it('calls AlertServiceClient.sendAlert() when the link is intercepted', async () => {
      await interceptor.interceptLink(TEST_URL, true);
      expect(alertClient.sendAlert).toHaveBeenCalledTimes(1);
    });

    it('sends an alert payload that includes the intercepted URL', async () => {
      await interceptor.interceptLink(TEST_URL, true);
      const payload: AlertPayload = alertClient.sendAlert.mock.calls[0][0];
      expect(payload.sender).toBe(TEST_URL);
    });

    it('sends an alert payload with the correct userId', async () => {
      await interceptor.interceptLink(TEST_URL, true);
      const payload: AlertPayload = alertClient.sendAlert.mock.calls[0][0];
      expect(payload.userId).toBe(USER_ID);
    });

    it('does NOT call Linking.openURL when Safe Mode is enabled', async () => {
      await interceptor.interceptLink(TEST_URL, true);
      expect(openURLMock).not.toHaveBeenCalled();
    });

    it('registers the Safe Mode link with GuardianActionHandler when provided', async () => {
      const mockHandler = {
        registerSafeModeLink: jest.fn(),
      };
      const interceptorWithHandler = new SafeModeInterceptor(
        alertClient,
        USER_ID,
        GUARDIAN_ID,
        mockHandler,
      );

      await interceptorWithHandler.interceptLink(TEST_URL, true);

      expect(mockHandler.registerSafeModeLink).toHaveBeenCalledTimes(1);
      const [messageId, url] = mockHandler.registerSafeModeLink.mock.calls[0];
      expect(messageId).toMatch(/^link-\d+$/);
      expect(url).toBe(TEST_URL);
    });

    it('does not crash when GuardianActionHandler is null', async () => {
      const interceptorWithoutHandler = new SafeModeInterceptor(
        alertClient,
        USER_ID,
        GUARDIAN_ID,
        null,
      );

      const result = await interceptorWithoutHandler.interceptLink(TEST_URL, true);
      expect(result.status).toBe('intercepted');
    });
  });

  // -------------------------------------------------------------------------
  // interceptLink — Safe Mode disabled (Requirement 6.1 — pass-through)
  // -------------------------------------------------------------------------

  describe('interceptLink() with safeModeEnabled=false', () => {
    it('returns status "passed_through" when Safe Mode is disabled', async () => {
      const result = await interceptor.interceptLink(TEST_URL, false);
      expect(result.status).toBe('passed_through');
    });

    it('calls Linking.openURL with the original URL when Safe Mode is disabled', async () => {
      await interceptor.interceptLink(TEST_URL, false);
      expect(openURLMock).toHaveBeenCalledTimes(1);
      expect(openURLMock).toHaveBeenCalledWith(TEST_URL);
    });

    it('does NOT call AlertServiceClient.sendAlert when Safe Mode is disabled', async () => {
      await interceptor.interceptLink(TEST_URL, false);
      expect(alertClient.sendAlert).not.toHaveBeenCalled();
    });

    it('passes through without modifying the URL', async () => {
      const specificUrl = 'https://trusted-site.org/page?ref=123';
      await interceptor.interceptLink(specificUrl, false);
      expect(openURLMock).toHaveBeenCalledWith(specificUrl);
    });
  });

  // -------------------------------------------------------------------------
  // handleGuardianAction — approval (Requirement 6.3)
  // -------------------------------------------------------------------------

  describe('handleGuardianAction() with action="mark_safe"', () => {
    it('returns status "opened" when Guardian approves the link', async () => {
      const action = makeGuardianAction('mark_safe');
      const result = await interceptor.handleGuardianAction(action, TEST_URL);
      expect(result.status).toBe('opened');
    });

    it('calls Linking.openURL with the approved URL', async () => {
      const action = makeGuardianAction('mark_safe');
      await interceptor.handleGuardianAction(action, TEST_URL);
      expect(openURLMock).toHaveBeenCalledTimes(1);
      expect(openURLMock).toHaveBeenCalledWith(TEST_URL);
    });

    it('opens the exact URL that was intercepted', async () => {
      const specificUrl = 'https://safe-bank.com/statement';
      const action = makeGuardianAction('mark_safe');
      await interceptor.handleGuardianAction(action, specificUrl);
      expect(openURLMock).toHaveBeenCalledWith(specificUrl);
    });
  });

  // -------------------------------------------------------------------------
  // handleGuardianAction — rejection (Requirement 6.4)
  // -------------------------------------------------------------------------

  describe('handleGuardianAction() with action="confirm_scam"', () => {
    it('returns status "blocked" when Guardian rejects the link', async () => {
      const action = makeGuardianAction('confirm_scam');
      const result = await interceptor.handleGuardianAction(action, TEST_URL);
      expect(result.status).toBe('blocked');
    });

    it('returns a plain-language blocked message when Guardian rejects', async () => {
      const action = makeGuardianAction('confirm_scam');
      const result = await interceptor.handleGuardianAction(action, TEST_URL);
      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe('string');
    });

    it('does NOT call Linking.openURL when the link is rejected', async () => {
      const action = makeGuardianAction('confirm_scam');
      await interceptor.handleGuardianAction(action, TEST_URL);
      expect(openURLMock).not.toHaveBeenCalled();
    });

    it('blocked message mentions safety in plain language', async () => {
      const action = makeGuardianAction('confirm_scam');
      const result = await interceptor.handleGuardianAction(action, TEST_URL);
      // Message should be plain-language and mention safety (Requirement 6.4)
      const msg = result.message?.toLowerCase() ?? '';
      expect(msg).toMatch(/safe|block|scam/);
    });
  });
});

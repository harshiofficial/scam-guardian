/**
 * Unit tests for AlertServiceClient
 *
 * Covers:
 *  - sendAlert() POSTs to the correct endpoint with JSON body and headers
 *  - sendAlert() throws on non-2xx HTTP responses
 *  - sendAlert() re-throws network errors
 *  - onGuardianAction() subscribes to FCM messages and invokes callback
 *  - onGuardianAction() filters out non-guardian_action messages
 *  - onGuardianAction() ignores messages with missing required fields
 *  - onGuardianAction() returns an unsubscribe function
 *  - registerFCMToken() POSTs to the correct endpoint
 *  - registerFCMToken() throws on non-2xx HTTP responses
 *  - registerFCMToken() re-throws network errors
 *
 * Requirements: 3.1, 3.2, 3.4
 */

import { AlertServiceClientClass, ALERT_API_BASE_URL } from '../AlertServiceClient';
import type { AlertPayload, GuardianAction } from '../../models/types';

// ---------------------------------------------------------------------------
// Mock @react-native-firebase/messaging
// ---------------------------------------------------------------------------

// Capture the handler registered via onMessage so tests can trigger it
let capturedOnMessageHandler: ((msg: unknown) => void) | null = null;
const mockUnsubscribe = jest.fn();

jest.mock('@react-native-firebase/messaging', () => {
  return () => ({
    onMessage: jest.fn((handler: (msg: unknown) => void) => {
      capturedOnMessageHandler = handler;
      return mockUnsubscribe;
    }),
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAlertPayload(overrides: Partial<AlertPayload> = {}): AlertPayload {
  return {
    userId: 'user-123',
    messageId: 'msg-456',
    sender: 'Unknown Caller',
    threatSummary: 'This message looks like a scam.',
    riskScore: 85,
    timestamp: '2024-01-15T10:30:00.000Z',
    userRequestedHelp: false,
    ...overrides,
  };
}

function makeFetchResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function makeGuardianActionMessage(
  overrides: Record<string, string> = {},
): unknown {
  return {
    data: {
      type: 'guardian_action',
      messageId: 'msg-456',
      action: 'mark_safe',
      guardianId: 'guardian-789',
      timestamp: '2024-01-15T10:35:00.000Z',
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlertServiceClientClass', () => {
  let client: AlertServiceClientClass;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    capturedOnMessageHandler = null;
    mockUnsubscribe.mockClear();
    client = new AlertServiceClientClass();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // ALERT_API_BASE_URL constant
  // -------------------------------------------------------------------------

  describe('ALERT_API_BASE_URL', () => {
    it('exports the expected default base URL', () => {
      expect(ALERT_API_BASE_URL).toBe('https://api.scamguardian.example.com');
    });
  });

  // -------------------------------------------------------------------------
  // sendAlert()
  // -------------------------------------------------------------------------

  describe('sendAlert()', () => {
    it('POSTs to the /alert endpoint', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeFetchResponse(200));
      global.fetch = fetchMock;

      await client.sendAlert(makeAlertPayload());

      expect(fetchMock).toHaveBeenCalledWith(
        `${ALERT_API_BASE_URL}/alert`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes Content-Type: application/json header', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeFetchResponse(200));
      global.fetch = fetchMock;

      await client.sendAlert(makeAlertPayload());

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
    });

    it('sends the alert payload as a JSON body', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeFetchResponse(200));
      global.fetch = fetchMock;

      const payload = makeAlertPayload({ riskScore: 92, userRequestedHelp: true });
      await client.sendAlert(payload);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body).toEqual(payload);
    });

    it('resolves without error on a 200 response', async () => {
      global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(200));

      await expect(client.sendAlert(makeAlertPayload())).resolves.toBeUndefined();
    });

    it('resolves without error on a 204 response', async () => {
      global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(204));

      await expect(client.sendAlert(makeAlertPayload())).resolves.toBeUndefined();
    });

    it('throws an error with the status code on a 400 response', async () => {
      global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(400));

      await expect(client.sendAlert(makeAlertPayload())).rejects.toThrow('400');
    });

    it('throws an error with the status code on a 500 response', async () => {
      global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(500));

      await expect(client.sendAlert(makeAlertPayload())).rejects.toThrow('500');
    });

    it('throws an error with the status code on a 503 response', async () => {
      global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(503));

      await expect(client.sendAlert(makeAlertPayload())).rejects.toThrow('503');
    });

    it('re-throws network errors for callers to handle', async () => {
      const networkError = new Error('Network request failed');
      global.fetch = jest.fn().mockRejectedValue(networkError);

      await expect(client.sendAlert(makeAlertPayload())).rejects.toThrow(
        'Network request failed',
      );
    });

    it('uses a custom base URL when provided to the constructor', async () => {
      const customUrl = 'https://custom.example.com';
      const customClient = new AlertServiceClientClass(customUrl);
      const fetchMock = jest.fn().mockResolvedValue(makeFetchResponse(200));
      global.fetch = fetchMock;

      await customClient.sendAlert(makeAlertPayload());

      expect(fetchMock).toHaveBeenCalledWith(
        `${customUrl}/alert`,
        expect.any(Object),
      );
    });
  });

  // -------------------------------------------------------------------------
  // onGuardianAction()
  // -------------------------------------------------------------------------

  describe('onGuardianAction()', () => {
    it('returns an unsubscribe function', () => {
      const unsubscribe = client.onGuardianAction(jest.fn());
      expect(typeof unsubscribe).toBe('function');
    });

    it('the returned unsubscribe function is the one from messaging().onMessage()', () => {
      const unsubscribe = client.onGuardianAction(jest.fn());
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('invokes the callback with a parsed GuardianAction on a valid guardian_action message', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!(makeGuardianActionMessage());

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith<[GuardianAction]>({
        messageId: 'msg-456',
        action: 'mark_safe',
        guardianId: 'guardian-789',
        timestamp: '2024-01-15T10:35:00.000Z',
      });
    });

    it('correctly parses a confirm_scam action', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!(
        makeGuardianActionMessage({ action: 'confirm_scam' }),
      );

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'confirm_scam' }),
      );
    });

    it('correctly parses a call_user action', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!(
        makeGuardianActionMessage({ action: 'call_user' }),
      );

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'call_user' }),
      );
    });

    it('does NOT invoke the callback for messages with a different type', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!({
        data: { type: 'some_other_type', messageId: 'msg-1' },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT invoke the callback for messages with no data field', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!({ notification: { title: 'Hello' } });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT invoke the callback for messages with null data', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!({ data: null });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT invoke the callback when messageId is missing', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!({
        data: {
          type: 'guardian_action',
          // messageId missing
          action: 'mark_safe',
          guardianId: 'guardian-789',
          timestamp: '2024-01-15T10:35:00.000Z',
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT invoke the callback when action is missing', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!({
        data: {
          type: 'guardian_action',
          messageId: 'msg-456',
          // action missing
          guardianId: 'guardian-789',
          timestamp: '2024-01-15T10:35:00.000Z',
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT invoke the callback when guardianId is missing', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!({
        data: {
          type: 'guardian_action',
          messageId: 'msg-456',
          action: 'mark_safe',
          // guardianId missing
          timestamp: '2024-01-15T10:35:00.000Z',
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT invoke the callback when timestamp is missing', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      capturedOnMessageHandler!({
        data: {
          type: 'guardian_action',
          messageId: 'msg-456',
          action: 'mark_safe',
          guardianId: 'guardian-789',
          // timestamp missing
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('passes all GuardianAction fields through correctly', () => {
      const callback = jest.fn();
      client.onGuardianAction(callback);

      const msg = makeGuardianActionMessage({
        messageId: 'msg-999',
        action: 'confirm_scam',
        guardianId: 'guardian-abc',
        timestamp: '2024-06-01T08:00:00.000Z',
      });
      capturedOnMessageHandler!(msg);

      const received: GuardianAction = callback.mock.calls[0][0];
      expect(received.messageId).toBe('msg-999');
      expect(received.action).toBe('confirm_scam');
      expect(received.guardianId).toBe('guardian-abc');
      expect(received.timestamp).toBe('2024-06-01T08:00:00.000Z');
    });
  });

  // -------------------------------------------------------------------------
  // registerFCMToken()
  // -------------------------------------------------------------------------

  describe('registerFCMToken()', () => {
    it('POSTs to the /alert/register endpoint', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeFetchResponse(200));
      global.fetch = fetchMock;

      await client.registerFCMToken('user-123', 'fcm-token-abc');

      expect(fetchMock).toHaveBeenCalledWith(
        `${ALERT_API_BASE_URL}/alert/register`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes Content-Type: application/json header', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeFetchResponse(200));
      global.fetch = fetchMock;

      await client.registerFCMToken('user-123', 'fcm-token-abc');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
    });

    it('sends userId and fcmToken in the JSON body', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeFetchResponse(200));
      global.fetch = fetchMock;

      await client.registerFCMToken('user-123', 'fcm-token-abc');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body).toEqual({ userId: 'user-123', fcmToken: 'fcm-token-abc' });
    });

    it('resolves without error on a 200 response', async () => {
      global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(200));

      await expect(
        client.registerFCMToken('user-123', 'fcm-token-abc'),
      ).resolves.toBeUndefined();
    });

    it('throws an error with the status code on a 400 response', async () => {
      global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(400));

      await expect(
        client.registerFCMToken('user-123', 'fcm-token-abc'),
      ).rejects.toThrow('400');
    });

    it('throws an error with the status code on a 500 response', async () => {
      global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(500));

      await expect(
        client.registerFCMToken('user-123', 'fcm-token-abc'),
      ).rejects.toThrow('500');
    });

    it('re-throws network errors for callers to handle', async () => {
      const networkError = new Error('Network request failed');
      global.fetch = jest.fn().mockRejectedValue(networkError);

      await expect(
        client.registerFCMToken('user-123', 'fcm-token-abc'),
      ).rejects.toThrow('Network request failed');
    });

    it('uses a custom base URL when provided to the constructor', async () => {
      const customUrl = 'https://custom.example.com';
      const customClient = new AlertServiceClientClass(customUrl);
      const fetchMock = jest.fn().mockResolvedValue(makeFetchResponse(200));
      global.fetch = fetchMock;

      await customClient.registerFCMToken('user-123', 'token-xyz');

      expect(fetchMock).toHaveBeenCalledWith(
        `${customUrl}/alert/register`,
        expect.any(Object),
      );
    });
  });
});

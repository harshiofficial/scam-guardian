/**
 * Mock for @react-native-firebase/messaging
 */

export const FirebaseMessagingTypes = {};

const mockMessaging = jest.fn(() => ({
  requestPermission: jest.fn().mockResolvedValue(1),
  getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
  onMessage: jest.fn().mockReturnValue(jest.fn()),
  setBackgroundMessageHandler: jest.fn(),
}));

mockMessaging.AuthorizationStatus = {
  AUTHORIZED: 1,
  DENIED: 0,
  PROVISIONAL: 2,
};

export default mockMessaging;

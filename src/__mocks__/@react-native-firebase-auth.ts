/**
 * Mock for @react-native-firebase/auth
 */

export const FirebaseAuthTypes = {};

const mockSignInWithPhoneNumber = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();

const mockAuth = jest.fn(() => ({
  signInWithPhoneNumber: mockSignInWithPhoneNumber,
  currentUser: null,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
}));

// Expose the mocks for testing
Object.defineProperty(mockAuth, 'signInWithPhoneNumber', {
  get: () => mockSignInWithPhoneNumber,
});
Object.defineProperty(mockAuth, 'signOut', {
  get: () => mockSignOut,
});
Object.defineProperty(mockAuth, 'onAuthStateChanged', {
  get: () => mockOnAuthStateChanged,
});

export default mockAuth;

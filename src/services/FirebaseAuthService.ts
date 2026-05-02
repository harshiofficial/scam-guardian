/**
 * ScamGuardian — Firebase Auth Service
 *
 * Handles phone-number sign-in flow using Firebase Authentication.
 * Provides methods to:
 *  - Initiate phone sign-in (send verification code)
 *  - Confirm phone sign-in (verify code and authenticate)
 *  - Get the current authenticated user
 *  - Sign out
 *
 * Requirements: 5.1, 5.3
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

/**
 * Initiates phone number sign-in by sending a verification code to the provided phone number.
 *
 * @param phoneNumber - The phone number in E.164 format (e.g., "+1234567890")
 * @returns A confirmation result that must be passed to confirmPhoneSignIn
 * @throws Error if the phone number is invalid or the request fails
 */
export async function initiatePhoneSignIn(
  phoneNumber: string,
): Promise<FirebaseAuthTypes.ConfirmationResult> {
  try {
    const confirmationResult = await auth().signInWithPhoneNumber(phoneNumber);
    return confirmationResult;
  } catch (error) {
    throw new Error(`Failed to initiate phone sign-in: ${error}`);
  }
}

/**
 * Confirms phone sign-in by verifying the code sent to the user's phone.
 *
 * @param confirmationResult - The result from initiatePhoneSignIn
 * @param verificationCode - The 6-digit code sent to the user's phone
 * @returns The authenticated user credential
 * @throws Error if the verification code is invalid or the request fails
 */
export async function confirmPhoneSignIn(
  confirmationResult: FirebaseAuthTypes.ConfirmationResult,
  verificationCode: string,
): Promise<FirebaseAuthTypes.UserCredential> {
  try {
    const userCredential = await confirmationResult.confirm(verificationCode);
    return userCredential;
  } catch (error) {
    throw new Error(`Failed to confirm phone sign-in: ${error}`);
  }
}

/**
 * Gets the currently authenticated user.
 *
 * @returns The current user, or null if no user is authenticated
 */
export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return auth().currentUser;
}

/**
 * Gets the ID of the currently authenticated user.
 *
 * @returns The user ID, or null if no user is authenticated
 */
export function getCurrentUserId(): string | null {
  return auth().currentUser?.uid ?? null;
}

/**
 * Signs out the current user.
 *
 * @throws Error if the sign-out fails
 */
export async function signOut(): Promise<void> {
  try {
    await auth().signOut();
  } catch (error) {
    throw new Error(`Failed to sign out: ${error}`);
  }
}

/**
 * Subscribes to authentication state changes.
 *
 * @param callback - Called whenever the authentication state changes
 * @returns An unsubscribe function
 */
export function onAuthStateChanged(
  callback: (user: FirebaseAuthTypes.User | null) => void,
): () => void {
  return auth().onAuthStateChanged(callback);
}

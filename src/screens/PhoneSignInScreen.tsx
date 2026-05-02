/**
 * PhoneSignInScreen
 *
 * A simple phone-number sign-in flow for elderly users (no password required).
 * Two steps:
 * 1. Enter phone number and send verification code
 * 2. Enter verification code and confirm sign-in
 *
 * On successful sign-in:
 * - Store userId and fcmToken in UserProfile
 * - Register FCM token with backend via POST /alert/register
 *
 * Requirements: 5.1, 5.3
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  initiatePhoneSignIn,
  confirmPhoneSignIn,
} from '../services/FirebaseAuthService';
import { getFCMToken } from '../services/FirebaseService';
import { userProfileRepository } from '../services/UserProfileRepository';
import { AlertServiceClient } from '../services/AlertServiceClient';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhoneSignInScreenProps {
  /** Called when sign-in is successful */
  onSignInSuccess: (userId: string) => void;
  /** When true, render all text at larger font sizes (≥ 20sp) */
  largeFontEnabled?: boolean;
}

type Step = 'phone_entry' | 'code_verification';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PhoneSignInScreen: React.FC<PhoneSignInScreenProps> = ({
  onSignInSuccess,
  largeFontEnabled = false,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('phone_entry');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] =
    useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  // -------------------------------------------------------------------------
  // Phone Entry Step
  // -------------------------------------------------------------------------

  /**
   * Validates and sends verification code to the provided phone number.
   */
  const handleSendCode = useCallback(async () => {
    setError('');

    // Validate phone number format
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number.');
      return;
    }

    // Basic validation: phone number should be at least 10 digits
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Please enter a valid phone number with at least 10 digits.');
      return;
    }

    setLoading(true);
    try {
      // Format phone number to E.164 format if not already
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (!phoneNumber.startsWith('+')) {
        // Assume US number if no country code provided
        if (formattedPhone.length === 10) {
          formattedPhone = `+1${formattedPhone}`;
        } else {
          formattedPhone = `+${formattedPhone}`;
        }
      } else {
        // If it starts with +, just remove all non-digits and re-add the +
        formattedPhone = `+${formattedPhone}`;
      }

      // Send verification code
      const result = await initiatePhoneSignIn(formattedPhone);
      setConfirmationResult(result);
      setCurrentStep('code_verification');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send verification code. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [phoneNumber]);

  // -------------------------------------------------------------------------
  // Code Verification Step
  // -------------------------------------------------------------------------

  /**
   * Verifies the code and completes sign-in.
   * On success, stores userId and fcmToken in UserProfile and registers with backend.
   */
  const handleVerifyCode = useCallback(async () => {
    setError('');

    if (!verificationCode.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('Verification code must be 6 digits.');
      return;
    }

    if (!confirmationResult) {
      setError('Confirmation result is missing. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Confirm phone sign-in
      const userCredential = await confirmPhoneSignIn(
        confirmationResult,
        verificationCode,
      );
      const userId = userCredential.user.uid;

      // Get FCM token
      const fcmToken = await getFCMToken();
      if (!fcmToken) {
        throw new Error('Failed to get FCM token. Please check notification permissions.');
      }

      // Store userId and fcmToken in UserProfile
      let userProfile = await userProfileRepository.findById(userId);
      if (!userProfile) {
        userProfile = {
          userId,
          guardianId: '',
          guardianContact: '',
          safeModeEnabled: false,
          largeFontEnabled: false,
          fcmToken,
          onboardingComplete: false,
        };
      } else {
        userProfile.fcmToken = fcmToken;
      }
      await userProfileRepository.upsert(userProfile);

      // Register FCM token with backend
      try {
        await AlertServiceClient.registerFCMToken(userId, fcmToken);
      } catch (registrationError) {
        // Log but don't fail — user is authenticated even if registration fails
        console.warn('Failed to register FCM token with backend:', registrationError);
      }

      // Call success callback
      onSignInSuccess(userId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to verify code. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [verificationCode, confirmationResult, onSignInSuccess]);

  /**
   * Go back to phone entry step.
   */
  const handleBackToPhoneEntry = useCallback(() => {
    setCurrentStep('phone_entry');
    setVerificationCode('');
    setError('');
    setConfirmationResult(null);
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, largeFontEnabled && { fontSize: 32 }]}>
          ScamGuardian
        </Text>
        <Text style={[styles.subtitle, largeFontEnabled && { fontSize: 18 }]}>
          Sign in to get protected
        </Text>
      </View>

      {/* Phone Entry Step */}
      {currentStep === 'phone_entry' && (
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, largeFontEnabled && { fontSize: 24 }]}>
            Enter Your Phone Number
          </Text>
          <Text style={[styles.stepDescription, largeFontEnabled && { fontSize: 16 }]}>
            We'll send you a verification code to confirm your identity.
          </Text>

          <TextInput
            style={[styles.input, largeFontEnabled && { fontSize: 18 }]}
            placeholder="Phone number (e.g., +1 234 567 8900)"
            placeholderTextColor="#999"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            editable={!loading}
            keyboardType="phone-pad"
            accessibilityLabel="Phone number input"
            testID="phone-number-input"
          />

          {error && (
            <Text style={[styles.errorText, largeFontEnabled && { fontSize: 16 }]}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={loading}
            accessibilityLabel="Send verification code button"
            testID="send-code-button">
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.buttonPrimaryText, largeFontEnabled && { fontSize: 18 }]}>
                Send Code
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Code Verification Step */}
      {currentStep === 'code_verification' && (
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, largeFontEnabled && { fontSize: 24 }]}>
            Enter Verification Code
          </Text>
          <Text style={[styles.stepDescription, largeFontEnabled && { fontSize: 16 }]}>
            We sent a 6-digit code to {phoneNumber}. Enter it below.
          </Text>

          <TextInput
            style={[styles.input, largeFontEnabled && { fontSize: 18 }]}
            placeholder="000000"
            placeholderTextColor="#999"
            value={verificationCode}
            onChangeText={setVerificationCode}
            editable={!loading}
            keyboardType="number-pad"
            maxLength={6}
            accessibilityLabel="Verification code input"
            testID="verification-code-input"
          />

          {error && (
            <Text style={[styles.errorText, largeFontEnabled && { fontSize: 16 }]}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
            onPress={handleVerifyCode}
            disabled={loading}
            accessibilityLabel="Verify code button"
            testID="verify-code-button">
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.buttonPrimaryText, largeFontEnabled && { fontSize: 18 }]}>
                Verify Code
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleBackToPhoneEntry}
            disabled={loading}
            accessibilityLabel="Back button"
            testID="back-button">
            <Text style={[styles.buttonSecondaryText, largeFontEnabled && { fontSize: 16 }]}>
              Back
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  stepContent: {
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 15,
    color: '#3C3C43',
    lineHeight: 22,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 16,
    fontWeight: '500',
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default PhoneSignInScreen;

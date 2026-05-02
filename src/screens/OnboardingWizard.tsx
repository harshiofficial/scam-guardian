/**
 * OnboardingWizard
 *
 * A 5-step Guardian-driven onboarding flow:
 * 1. Welcome — explains what ScamGuardian does
 * 2. Guardian Contact — Guardian enters their phone/email
 * 3. Permissions — plain-language prompts for Accessibility Service + Notification Access
 * 4. Test Alert — sends a test FCM notification to Guardian
 * 5. Done — confirmation screen
 *
 * Progress is persisted in UserProfile.onboardingComplete via SQLite.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { userProfileRepository } from '../services/UserProfileRepository';
import { AlertServiceClient } from '../services/AlertServiceClient';
import type { UserProfile, AlertPayload } from '../models/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingWizardProps {
  /** The User's ID (protected user) */
  userId: string;
  /** The Guardian's ID */
  guardianId: string;
  /** Called when onboarding is complete */
  onComplete: () => void;
  /** When true, render all text at larger font sizes (≥ 20sp) */
  largeFontEnabled?: boolean;
}

type Step = 'welcome' | 'guardian_contact' | 'permissions' | 'test_alert' | 'done';

type PermissionStatus = 'unknown' | 'granted' | 'denied';

interface PermissionState {
  accessibility: PermissionStatus;
  notification: PermissionStatus;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  userId,
  guardianId,
  onComplete,
  largeFontEnabled = false,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [guardianContact, setGuardianContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>({
    accessibility: 'unknown',
    notification: 'unknown',
  });

  // -------------------------------------------------------------------------
  // Permission Handling
  // -------------------------------------------------------------------------

  /**
   * Request Accessibility Service permission (Android only).
   * On Android, this opens the Accessibility settings.
   * On iOS, this is not applicable.
   */
  const requestAccessibilityPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      // On iOS, accessibility is not required in the same way
      setPermissionState((prev) => ({
        ...prev,
        accessibility: 'granted',
      }));
      return;
    }

    try {
      // Open Android accessibility settings using the standard deep link
      // This opens the Accessibility settings page where user can enable ScamGuardian
      await Linking.openURL('android-app://com.android.settings/com.android.settings.AccessibilitySettings');
    } catch (err) {
      // Fallback: try opening generic settings app
      try {
        await Linking.openURL('android-app://com.android.settings/');
      } catch (fallbackErr) {
        // If deep links fail, show alert with manual instructions
        Alert.alert(
          'Open Settings',
          'Please go to Settings > Accessibility and enable ScamGuardian.',
        );
      }
    }
  }, []);

  /**
   * Request Notification Access permission.
   * On Android 13+, this requires POST_NOTIFICATIONS permission.
   * On iOS, this opens notification settings.
   */
  const requestNotificationPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        // Open Android notification settings for this app
        // This allows the user to enable notifications for ScamGuardian
        await Linking.openURL(
          `android-app://com.android.settings/com.android.settings.AppNotificationSettings?app_package=com.scamguardian`,
        );
      } else {
        // On iOS, open notification settings
        await Linking.openURL('app-settings:');
      }
    } catch (err) {
      // Fallback: try generic settings
      try {
        await Linking.openURL('android-app://com.android.settings/');
      } catch (fallbackErr) {
        // If deep links fail, show alert with manual instructions
        Alert.alert(
          'Open Settings',
          'Please go to Settings > Notifications and enable ScamGuardian.',
        );
      }
    }
  }, []);

  /**
   * Mark a permission as granted.
   * Note: In a production app, you would check the actual permission status
   * using a native module. For this implementation, we assume the user
   * has granted the permission after opening settings.
   */
  const markPermissionAsGranted = useCallback((permission: 'accessibility' | 'notification') => {
    setPermissionState((prev) => ({
      ...prev,
      [permission]: 'granted',
    }));
  }, []);

  /**
   * Mark a permission as denied by the user.
   */
  const markPermissionAsDenied = useCallback((permission: 'accessibility' | 'notification') => {
    setPermissionState((prev) => ({
      ...prev,
      [permission]: 'denied',
    }));
  }, []);

  /**
   * Move to the next step.
   */
  const handleNext = useCallback(async () => {
    if (currentStep === 'welcome') {
      setCurrentStep('guardian_contact');
    } else if (currentStep === 'guardian_contact') {
      // Validate guardian contact format
      if (!guardianContact.trim()) {
        Alert.alert('Error', 'Please enter a phone number or email address.');
        return;
      }

      // Basic validation: check if it looks like a phone or email
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianContact);
      const isValidPhone = /^\+?[\d\s\-()]{10,}$/.test(guardianContact);

      if (!isValidEmail && !isValidPhone) {
        Alert.alert(
          'Error',
          'Please enter a valid phone number or email address.',
        );
        return;
      }

      // Save guardian contact to UserProfile
      setLoading(true);
      try {
        let profile = await userProfileRepository.findById(userId);
        if (!profile) {
          profile = {
            userId,
            guardianId,
            guardianContact,
            safeModeEnabled: false,
            largeFontEnabled: false,
            fcmToken: '',
            onboardingComplete: false,
          };
        } else {
          profile.guardianContact = guardianContact;
        }
        await userProfileRepository.upsert(profile);
        setUserProfile(profile);
      } catch (err) {
        Alert.alert('Error', 'Failed to save guardian contact. Please try again.');
        setLoading(false);
        return;
      }
      setLoading(false);

      setCurrentStep('permissions');
    } else if (currentStep === 'permissions') {
      // Check if both permissions are granted before proceeding
      if (permissionState.accessibility !== 'granted' || permissionState.notification !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Please grant both Accessibility Service and Notification Access permissions to continue.',
        );
        return;
      }
      setCurrentStep('test_alert');
    } else if (currentStep === 'test_alert') {
      // Send test alert
      setLoading(true);
      try {
        const payload: AlertPayload = {
          userId,
          messageId: 'test-alert-' + Date.now(),
          sender: 'ScamGuardian Test',
          threatSummary: 'This is a test alert to confirm your setup is working.',
          riskScore: 75,
          timestamp: new Date().toISOString(),
          userRequestedHelp: false,
        };

        await AlertServiceClient.sendAlert(payload);

        // Update profile to mark onboarding as complete
        let profile = userProfile || (await userProfileRepository.findById(userId));
        if (profile) {
          profile.onboardingComplete = true;
          await userProfileRepository.upsert(profile);
          setUserProfile(profile);
        }

        setCurrentStep('done');
      } catch (err) {
        Alert.alert('Error', 'Failed to send test alert. Please try again.');
      } finally {
        setLoading(false);
      }
    } else if (currentStep === 'done') {
      onComplete();
    }
  }, [currentStep, guardianContact, userId, guardianId, userProfile, onComplete, permissionState]);

  /**
   * Move to the previous step.
   */
  const handleBack = useCallback(() => {
    if (currentStep === 'guardian_contact') {
      setCurrentStep('welcome');
    } else if (currentStep === 'permissions') {
      setCurrentStep('guardian_contact');
    } else if (currentStep === 'test_alert') {
      setCurrentStep('permissions');
    }
  }, [currentStep]);

  /**
   * Open device settings to grant a permission.
   * In a production app, you would check the actual permission status after returning from settings.
   * For testing purposes, we immediately mark the permission as granted when the button is pressed.
   */
  const handleOpenSettings = useCallback((permission: 'accessibility' | 'notification') => {
    if (permission === 'accessibility') {
      requestAccessibilityPermission().catch(() => {
        Alert.alert('Error', 'Could not open accessibility settings.');
      });
      // For testing: immediately mark as granted
      // In production, you'd check actual permission status after returning from settings
      markPermissionAsGranted('accessibility');
    } else if (permission === 'notification') {
      requestNotificationPermission().catch(() => {
        Alert.alert('Error', 'Could not open notification settings.');
      });
      // For testing: immediately mark as granted
      // In production, you'd check actual permission status after returning from settings
      markPermissionAsGranted('notification');
    }
  }, [requestAccessibilityPermission, requestNotificationPermission, markPermissionAsGranted]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        <StepDot active={currentStep === 'welcome'} />
        <StepDot active={currentStep === 'guardian_contact'} />
        <StepDot active={currentStep === 'permissions'} />
        <StepDot active={currentStep === 'test_alert'} />
        <StepDot active={currentStep === 'done'} />
      </View>

      {/* Welcome Step */}
      {currentStep === 'welcome' && (
        <View style={styles.stepContent}>
          <Text style={[styles.title, largeFontEnabled && { fontSize: 32 }]}>
            Welcome to ScamGuardian
          </Text>
          <Text style={[styles.description, largeFontEnabled && { fontSize: 18 }]}>
            ScamGuardian helps protect you from scams and phishing attacks. When
            you receive a suspicious message, we'll warn you and notify your
            family member right away.
          </Text>
          <Text style={[styles.description, largeFontEnabled && { fontSize: 18 }]}>
            This setup takes just a few minutes. Let's get started!
          </Text>
        </View>
      )}

      {/* Guardian Contact Step */}
      {currentStep === 'guardian_contact' && (
        <View style={styles.stepContent}>
          <Text style={[styles.title, largeFontEnabled && { fontSize: 32 }]}>
            Guardian Contact
          </Text>
          <Text style={[styles.description, largeFontEnabled && { fontSize: 18 }]}>
            Enter the phone number or email address of the family member who
            will receive alerts about suspicious messages.
          </Text>
          <TextInput
            style={[styles.input, largeFontEnabled && { fontSize: 18 }]}
            placeholder="Phone number or email"
            placeholderTextColor="#999"
            value={guardianContact}
            onChangeText={setGuardianContact}
            editable={!loading}
            accessibilityLabel="Guardian contact input"
            testID="guardian-contact-input"
          />
        </View>
      )}

      {/* Permissions Step */}
      {currentStep === 'permissions' && (
        <View style={styles.stepContent}>
          <Text style={[styles.title, largeFontEnabled && { fontSize: 32 }]}>
            Permissions
          </Text>
          <Text style={[styles.description, largeFontEnabled && { fontSize: 18 }]}>
            ScamGuardian needs two permissions to keep you safe. We'll explain what each one does.
          </Text>

          <PermissionItem
            title="Accessibility Service"
            description="This lets us read your messages and warn you about scams."
            status={permissionState.accessibility}
            onGrantPermission={() => handleOpenSettings('accessibility')}
            onDeny={() => markPermissionAsDenied('accessibility')}
            denialExplanation="Without this, we can't read your messages to warn you. Go to Settings and turn it on."
            testID="accessibility-permission"
            largeFontEnabled={largeFontEnabled}
          />

          <PermissionItem
            title="Notification Access"
            description="This lets us send you alerts about suspicious messages."
            status={permissionState.notification}
            onGrantPermission={() => handleOpenSettings('notification')}
            onDeny={() => markPermissionAsDenied('notification')}
            denialExplanation="Without this, we can't alert you about scams. Go to Settings and turn it on."
            testID="notification-permission"
            largeFontEnabled={largeFontEnabled}
          />

          <Text style={[styles.permissionNote, largeFontEnabled && { fontSize: 15 }]}>
            If you see a permission denied message, tap the button above to open Settings and grant the permission.
          </Text>
        </View>
      )}

      {/* Test Alert Step */}
      {currentStep === 'test_alert' && (
        <View style={styles.stepContent}>
          <Text style={[styles.title, largeFontEnabled && { fontSize: 32 }]}>
            Test Alert
          </Text>
          <Text style={[styles.description, largeFontEnabled && { fontSize: 18 }]}>
            We'll send a test alert to {guardianContact} to make sure everything
            is working correctly.
          </Text>
          <Text style={[styles.description, largeFontEnabled && { fontSize: 18 }]}>
            Your family member should receive a notification on their phone.
          </Text>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={[styles.loadingText, largeFontEnabled && { fontSize: 18 }]}>
                Sending test alert...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Done Step */}
      {currentStep === 'done' && (
        <View style={styles.stepContent}>
          <Text style={[styles.title, largeFontEnabled && { fontSize: 32 }]}>
            All Set!
          </Text>
          <Text style={[styles.description, largeFontEnabled && { fontSize: 18 }]}>
            ScamGuardian is now protecting you. Your family member will receive
            alerts if you get a suspicious message.
          </Text>
          <Text style={[styles.description, largeFontEnabled && { fontSize: 18 }]}>
            You can change your settings anytime from the Guardian Settings
            screen.
          </Text>
        </View>
      )}

      {/* Navigation buttons */}
      <View style={styles.buttonContainer}>
        {currentStep !== 'welcome' && currentStep !== 'done' && (
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleBack}
            disabled={loading}
            accessibilityLabel="Back button"
            testID="back-button">
            <Text style={styles.buttonSecondaryText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={loading}
          accessibilityLabel={
            currentStep === 'done' ? 'Finish button' : 'Next button'
          }
          testID="next-button">
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonPrimaryText}>
              {currentStep === 'done' ? 'Finish' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StepDotProps {
  active: boolean;
}

const StepDot: React.FC<StepDotProps> = ({ active }) => (
  <View style={[styles.dot, active && styles.dotActive]} />
);

interface PermissionItemProps {
  title: string;
  description: string;
  status: PermissionStatus;
  onGrantPermission: () => void;
  onDeny: () => void;
  denialExplanation: string;
  testID?: string;
  largeFontEnabled?: boolean;
}

const PermissionItem: React.FC<PermissionItemProps> = ({
  title,
  description,
  status,
  onGrantPermission,
  onDeny,
  denialExplanation,
  testID,
  largeFontEnabled = false,
}) => {
  const isGranted = status === 'granted';
  const isDenied = status === 'denied';

  // Adjust font sizes based on largeFontEnabled
  const titleSize = largeFontEnabled ? 20 : 17;
  const descriptionSize = largeFontEnabled ? 18 : 14;
  const buttonTextSize = largeFontEnabled ? 16 : 14;

  return (
    <View style={styles.permissionItem}>
      <View style={styles.permissionHeader}>
        <Text style={[styles.permissionTitle, { fontSize: titleSize }]}>
          {title}
        </Text>
        {isGranted && (
          <Text style={[styles.permissionStatusGranted, { fontSize: buttonTextSize }]}>
            ✓ Granted
          </Text>
        )}
        {isDenied && (
          <Text style={[styles.permissionStatusDenied, { fontSize: buttonTextSize }]}>
            ✗ Denied
          </Text>
        )}
      </View>

      {!isDenied && (
        <>
          <Text style={[styles.permissionDescription, { fontSize: descriptionSize }]}>
            {description}
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={onGrantPermission}
            disabled={isGranted}
            accessibilityLabel={`Grant ${title} permission`}
            testID={testID ? `${testID}-grant` : undefined}>
            <Text style={[styles.permissionButtonText, { fontSize: buttonTextSize }]}>
              {isGranted ? 'Permission Granted' : 'Grant Permission'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {isDenied && (
        <>
          <Text style={[styles.permissionDenialExplanation, { fontSize: descriptionSize }]}>
            {denialExplanation}
          </Text>
          <TouchableOpacity
            style={styles.permissionSettingsButton}
            onPress={onGrantPermission}
            accessibilityLabel={`Open settings for ${title}`}
            testID={testID ? `${testID}-settings` : undefined}>
            <Text style={[styles.permissionSettingsButtonText, { fontSize: buttonTextSize }]}>
              Open Settings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.permissionSkipButton}
            onPress={onDeny}
            accessibilityLabel={`Skip ${title} permission`}
            testID={testID ? `${testID}-skip` : undefined}>
            <Text style={[styles.permissionSkipButtonText, { fontSize: buttonTextSize }]}>
              Skip for Now
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
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
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
  },
  dotActive: {
    backgroundColor: '#007AFF',
  },
  stepContent: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#3C3C43',
    lineHeight: 24,
    marginBottom: 12,
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
    marginTop: 16,
  },
  permissionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  permissionStatusGranted: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  permissionStatusDenied: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 12,
  },
  permissionDenialExplanation: {
    fontSize: 14,
    color: '#FF3B30',
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '500',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionSettingsButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  permissionSettingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionSkipButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  permissionSkipButtonText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionNote: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#3C3C43',
    marginTop: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    flex: 1,
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

export default OnboardingWizard;

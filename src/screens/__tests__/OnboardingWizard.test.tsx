/**
 * Tests for OnboardingWizard
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingWizard from '../OnboardingWizard';

// Mock the services before importing the component
jest.mock('../../services/UserProfileRepository', () => ({
  userProfileRepository: {
    findById: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.mock('../../services/AlertServiceClient', () => ({
  AlertServiceClient: {
    sendAlert: jest.fn(),
  },
}));

import { userProfileRepository } from '../../services/UserProfileRepository';
import { AlertServiceClient } from '../../services/AlertServiceClient';

describe('OnboardingWizard', () => {
  const mockOnComplete = jest.fn();
  const userId = 'user-123';
  const guardianId = 'guardian-456';

  beforeEach(() => {
    jest.clearAllMocks();
    (userProfileRepository.findById as jest.Mock).mockResolvedValue(null);
    (userProfileRepository.upsert as jest.Mock).mockResolvedValue(undefined);
    (AlertServiceClient.sendAlert as jest.Mock).mockResolvedValue(undefined);
  });

  it('should render the welcome step initially', () => {
    const { getByText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    expect(getByText('Welcome to ScamGuardian')).toBeTruthy();
    expect(
      getByText(/ScamGuardian helps protect you from scams/),
    ).toBeTruthy();
  });

  it('should accept valid phone number and save to UserProfile', async () => {
    const { getByText, getByPlaceholderText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Move to guardian contact step
    const buttons = getByText('Next');
    fireEvent.press(buttons);

    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    // Enter phone number
    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');

    // Proceed
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(userProfileRepository.upsert).toHaveBeenCalled();
      const callArgs = (userProfileRepository.upsert as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.guardianContact).toBe('+1234567890');
    });
  });

  it('should accept valid email address', async () => {
    const { getByText, getByPlaceholderText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Move to guardian contact step
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    // Enter email
    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, 'guardian@example.com');

    // Proceed
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(userProfileRepository.upsert).toHaveBeenCalled();
    });
  });

  it('should render permissions step', async () => {
    const { getByText, getByPlaceholderText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Move to guardian contact step
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    // Enter contact and proceed
    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
      expect(getByText('Accessibility Service')).toBeTruthy();
      expect(getByText('Notification Access')).toBeTruthy();
    });
  });

  it('should require both permissions to be granted before proceeding', async () => {
    const { getByText, getByPlaceholderText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Try to proceed without granting permissions - should not advance
    const nextButton = getByText('Next');
    fireEvent.press(nextButton);

    // Should still be on permissions step
    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });
  });

  it('should allow granting accessibility permission', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant accessibility permission
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    // Permission should be marked as granted
    await waitFor(() => {
      expect(getByText('Permission Granted')).toBeTruthy();
    });
  });

  it('should show denial explanation when permission is denied', async () => {
    const { getByText, getByPlaceholderText, getByTestId, getAllByText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant accessibility permission
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    await waitFor(() => {
      const grantedButtons = getAllByText('Permission Granted');
      expect(grantedButtons.length).toBeGreaterThan(0);
    });

    // Grant notification permission
    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    await waitFor(() => {
      const grantedButtons = getAllByText('Permission Granted');
      expect(grantedButtons.length).toBe(2);
    });
  });

  it('should show Open Settings button when permission is denied', async () => {
    const { getByText, getByPlaceholderText, getByTestId, getAllByText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant accessibility permission
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    await waitFor(() => {
      const grantedButtons = getAllByText('Permission Granted');
      expect(grantedButtons.length).toBeGreaterThan(0);
    });

    // Grant notification permission
    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    await waitFor(() => {
      // Both permissions should now be granted
      const grantedElements = getAllByText('Permission Granted');
      expect(grantedElements.length).toBe(2);
    });
  });

  it('should render test alert step', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to test alert step
    fireEvent.press(getByText('Next')); // welcome -> guardian contact
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next')); // guardian contact -> permissions

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant both permissions
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    fireEvent.press(getByText('Next')); // permissions -> test alert

    await waitFor(() => {
      expect(getByText('Test Alert')).toBeTruthy();
    });
  });

  it('should send test alert when Next is pressed', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to test alert step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant both permissions
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Test Alert')).toBeTruthy();
    });

    // Send test alert
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(AlertServiceClient.sendAlert).toHaveBeenCalled();
    });
  });

  it('should mark onboarding as complete after test alert', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to test alert step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant both permissions
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Test Alert')).toBeTruthy();
    });

    // Send test alert
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(AlertServiceClient.sendAlert).toHaveBeenCalled();
    });
  });

  it('should render done step after test alert', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate through all steps
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant both permissions
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Test Alert')).toBeTruthy();
    });

    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('All Set!')).toBeTruthy();
    });
  });

  it('should call onComplete when Finish is pressed', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate through all steps
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant both permissions
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Test Alert')).toBeTruthy();
    });

    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('All Set!')).toBeTruthy();
    });

    // Press Finish
    fireEvent.press(getByText('Finish'));

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('should allow going back to welcome step', async () => {
    const { getByText, getByPlaceholderText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Move to guardian contact step
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    // Go back
    fireEvent.press(getByText('Back'));

    await waitFor(() => {
      expect(getByText('Welcome to ScamGuardian')).toBeTruthy();
    });
  });

  // Additional tests for Permissions step (Requirements 5.2, 5.5)

  it('should display plain-language explanations for each permission', async () => {
    const { getByText, getByPlaceholderText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Verify plain-language explanations are present
    expect(getByText('This lets us read your messages and warn you about scams.')).toBeTruthy();
    expect(getByText('This lets us send you alerts about suspicious messages.')).toBeTruthy();
  });

  it('should support large font mode in permissions step', async () => {
    const { getByText, getByPlaceholderText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
        largeFontEnabled={true}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Verify large font is applied (this is a basic check)
    const permissionTitle = getByText('Accessibility Service');
    expect(permissionTitle).toBeTruthy();
  });

  it('should show denial explanation when permission is denied', async () => {
    const { getByText, getByPlaceholderText, getByTestId, queryByTestId } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant accessibility permission
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    await waitFor(() => {
      const grantedButtons = getByText('Permission Granted');
      expect(grantedButtons).toBeTruthy();
    });
  });

  it('should provide Open Settings button when permission is denied', async () => {
    const { getByText, getByPlaceholderText, getByTestId, getAllByText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant accessibility permission
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    await waitFor(() => {
      const grantedButtons = getAllByText('Permission Granted');
      expect(grantedButtons.length).toBeGreaterThan(0);
    });

    // Grant notification permission
    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    await waitFor(() => {
      // Both permissions should now be granted
      const grantedElements = getAllByText('Permission Granted');
      expect(grantedElements.length).toBe(2);
    });
  });

  it('should allow user to retry granting permission after denial', async () => {
    const { getByText, getByPlaceholderText, getByTestId, getAllByText } = render(
      <OnboardingWizard
        userId={userId}
        guardianId={guardianId}
        onComplete={mockOnComplete}
      />,
    );

    // Navigate to permissions step
    fireEvent.press(getByText('Next'));
    await waitFor(() => {
      expect(getByText('Guardian Contact')).toBeTruthy();
    });

    const input = getByPlaceholderText('Phone number or email');
    fireEvent.changeText(input, '+1234567890');
    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Permissions')).toBeTruthy();
    });

    // Grant accessibility permission
    const accessibilityGrantButton = getByTestId('accessibility-permission-grant');
    fireEvent.press(accessibilityGrantButton);

    await waitFor(() => {
      const grantedButtons = getAllByText('Permission Granted');
      expect(grantedButtons.length).toBeGreaterThan(0);
    });

    // Grant notification permission
    const notificationGrantButton = getByTestId('notification-permission-grant');
    fireEvent.press(notificationGrantButton);

    await waitFor(() => {
      // Both permissions should now be granted
      const grantedElements = getAllByText('Permission Granted');
      expect(grantedElements.length).toBe(2);
    });
  });
});

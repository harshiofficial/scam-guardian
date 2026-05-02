/**
 * PhoneSignInScreen Tests
 *
 * Tests for phone sign-in screen component.
 * Requirements: 5.1, 5.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PhoneSignInScreen from '../PhoneSignInScreen';
import * as FirebaseAuthService from '../../services/FirebaseAuthService';
import * as FirebaseService from '../../services/FirebaseService';
import { userProfileRepository } from '../../services/UserProfileRepository';
import { AlertServiceClient } from '../../services/AlertServiceClient';

// Mock dependencies
jest.mock('../../services/FirebaseAuthService');
jest.mock('../../services/FirebaseService');
jest.mock('../../services/UserProfileRepository');
jest.mock('../../services/AlertServiceClient');

describe('PhoneSignInScreen', () => {
  const mockOnSignInSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Phone Entry Step', () => {
    it('should render phone entry step initially', () => {
      render(
        <PhoneSignInScreen onSignInSuccess={mockOnSignInSuccess} />,
      );

      expect(screen.getByText('Enter Your Phone Number')).toBeTruthy();
      expect(screen.getByTestId('phone-number-input')).toBeTruthy();
      expect(screen.getByTestId('send-code-button')).toBeTruthy();
    });

    it('should show error when phone number is empty', async () => {
      render(
        <PhoneSignInScreen onSignInSuccess={mockOnSignInSuccess} />,
      );

      const sendButton = screen.getByTestId('send-code-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a phone number.')).toBeTruthy();
      });
    });

    it('should show error when phone number is too short', async () => {
      render(
        <PhoneSignInScreen onSignInSuccess={mockOnSignInSuccess} />,
      );

      const phoneInput = screen.getByTestId('phone-number-input');
      fireEvent.changeText(phoneInput, '123');

      const sendButton = screen.getByTestId('send-code-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Please enter a valid phone number with at least 10 digits.',
          ),
        ).toBeTruthy();
      });
    });

    it('should send verification code with valid phone number', async () => {
      const mockConfirmationResult = { confirm: jest.fn() };
      (FirebaseAuthService.initiatePhoneSignIn as jest.Mock).mockResolvedValue(
        mockConfirmationResult,
      );

      render(
        <PhoneSignInScreen onSignInSuccess={mockOnSignInSuccess} />,
      );

      const phoneInput = screen.getByTestId('phone-number-input');
      fireEvent.changeText(phoneInput, '2025551234');

      const sendButton = screen.getByTestId('send-code-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(FirebaseAuthService.initiatePhoneSignIn).toHaveBeenCalledWith(
          '+12025551234',
        );
      });
    });

    it('should format phone number with country code', async () => {
      const mockConfirmationResult = { confirm: jest.fn() };
      (FirebaseAuthService.initiatePhoneSignIn as jest.Mock).mockResolvedValue(
        mockConfirmationResult,
      );

      render(
        <PhoneSignInScreen onSignInSuccess={mockOnSignInSuccess} />,
      );

      const phoneInput = screen.getByTestId('phone-number-input');
      fireEvent.changeText(phoneInput, '+44 20 2555 1234');

      const sendButton = screen.getByTestId('send-code-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(FirebaseAuthService.initiatePhoneSignIn).toHaveBeenCalledWith(
          '+442025551234',
        );
      });
    });

    it('should show error when verification code send fails', async () => {
      (FirebaseAuthService.initiatePhoneSignIn as jest.Mock).mockRejectedValue(
        new Error('Failed to initiate phone sign-in: Network error'),
      );

      render(
        <PhoneSignInScreen onSignInSuccess={mockOnSignInSuccess} />,
      );

      const phoneInput = screen.getByTestId('phone-number-input');
      fireEvent.changeText(phoneInput, '2025551234');

      const sendButton = screen.getByTestId('send-code-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to initiate phone sign-in/),
        ).toBeTruthy();
      });
    });

    it('should transition to code verification step on success', async () => {
      const mockConfirmationResult = { confirm: jest.fn() };
      (FirebaseAuthService.initiatePhoneSignIn as jest.Mock).mockResolvedValue(
        mockConfirmationResult,
      );

      render(
        <PhoneSignInScreen onSignInSuccess={mockOnSignInSuccess} />,
      );

      const phoneInput = screen.getByTestId('phone-number-input');
      fireEvent.changeText(phoneInput, '2025551234');

      const sendButton = screen.getByTestId('send-code-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Enter Verification Code')).toBeTruthy();
      });
    });
  });

  describe('Code Verification Step', () => {
    beforeEach(async () => {
      const mockConfirmationResult = { confirm: jest.fn() };
      (FirebaseAuthService.initiatePhoneSignIn as jest.Mock).mockResolvedValue(
        mockConfirmationResult,
      );

      render(
        <PhoneSignInScreen onSignInSuccess={mockOnSignInSuccess} />,
      );

      const phoneInput = screen.getByTestId('phone-number-input');
      fireEvent.changeText(phoneInput, '2025551234');

      const sendButton = screen.getByTestId('send-code-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Enter Verification Code')).toBeTruthy();
      });
    });

    it('should show error when verification code is empty', async () => {
      const verifyButton = screen.getByTestId('verify-code-button');
      fireEvent.press(verifyButton);

      await waitFor(() => {
        expect(
          screen.getByText('Please enter the verification code.'),
        ).toBeTruthy();
      });
    });

    it('should show error when verification code is not 6 digits', async () => {
      const codeInput = screen.getByTestId('verification-code-input');
      fireEvent.changeText(codeInput, '12345');

      const verifyButton = screen.getByTestId('verify-code-button');
      fireEvent.press(verifyButton);

      await waitFor(() => {
        expect(
          screen.getByText('Verification code must be 6 digits.'),
        ).toBeTruthy();
      });
    });

    it('should verify code and store user profile on success', async () => {
      const mockUserCredential = {
        user: { uid: 'user-123' },
      };

      (FirebaseAuthService.confirmPhoneSignIn as jest.Mock).mockResolvedValue(
        mockUserCredential,
      );
      (FirebaseService.getFCMToken as jest.Mock).mockResolvedValue('fcm-token-123');
      (userProfileRepository.findById as jest.Mock).mockResolvedValue(null);
      (userProfileRepository.upsert as jest.Mock).mockResolvedValue(undefined);
      (AlertServiceClient.registerFCMToken as jest.Mock).mockResolvedValue(undefined);

      const codeInput = screen.getByTestId('verification-code-input');
      fireEvent.changeText(codeInput, '123456');

      const verifyButton = screen.getByTestId('verify-code-button');
      fireEvent.press(verifyButton);

      await waitFor(() => {
        expect(FirebaseAuthService.confirmPhoneSignIn).toHaveBeenCalledWith(
          expect.any(Object),
          '123456',
        );
        expect(FirebaseService.getFCMToken).toHaveBeenCalled();
        expect(userProfileRepository.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-123',
            fcmToken: 'fcm-token-123',
          }),
        );
        expect(AlertServiceClient.registerFCMToken).toHaveBeenCalledWith(
          'user-123',
          'fcm-token-123',
        );
      });
    });

    it('should call onSignInSuccess callback on successful verification', async () => {
      const mockUserCredential = {
        user: { uid: 'user-123' },
      };

      (FirebaseAuthService.confirmPhoneSignIn as jest.Mock).mockResolvedValue(
        mockUserCredential,
      );
      (FirebaseService.getFCMToken as jest.Mock).mockResolvedValue('fcm-token-123');
      (userProfileRepository.findById as jest.Mock).mockResolvedValue(null);
      (userProfileRepository.upsert as jest.Mock).mockResolvedValue(undefined);
      (AlertServiceClient.registerFCMToken as jest.Mock).mockResolvedValue(undefined);

      const codeInput = screen.getByTestId('verification-code-input');
      fireEvent.changeText(codeInput, '123456');

      const verifyButton = screen.getByTestId('verify-code-button');
      fireEvent.press(verifyButton);

      await waitFor(() => {
        expect(mockOnSignInSuccess).toHaveBeenCalledWith('user-123');
      });
    });

    it('should show error when verification code is invalid', async () => {
      (FirebaseAuthService.confirmPhoneSignIn as jest.Mock).mockRejectedValue(
        new Error('Failed to confirm phone sign-in: Invalid code'),
      );

      const codeInput = screen.getByTestId('verification-code-input');
      fireEvent.changeText(codeInput, '000000');

      const verifyButton = screen.getByTestId('verify-code-button');
      fireEvent.press(verifyButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to confirm phone sign-in/),
        ).toBeTruthy();
      });
    });

    it('should show error when FCM token retrieval fails', async () => {
      const mockUserCredential = {
        user: { uid: 'user-123' },
      };

      (FirebaseAuthService.confirmPhoneSignIn as jest.Mock).mockResolvedValue(
        mockUserCredential,
      );
      (FirebaseService.getFCMToken as jest.Mock).mockResolvedValue(null);

      const codeInput = screen.getByTestId('verification-code-input');
      fireEvent.changeText(codeInput, '123456');

      const verifyButton = screen.getByTestId('verify-code-button');
      fireEvent.press(verifyButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to get FCM token/),
        ).toBeTruthy();
      });
    });

    it('should go back to phone entry step', async () => {
      const backButton = screen.getByTestId('back-button');
      fireEvent.press(backButton);

      await waitFor(() => {
        expect(screen.getByText('Enter Your Phone Number')).toBeTruthy();
      });
    });
  });

  describe('Large Font Support', () => {
    it('should render with larger font sizes when largeFontEnabled is true', () => {
      const { getByText } = render(
        <PhoneSignInScreen
          onSignInSuccess={mockOnSignInSuccess}
          largeFontEnabled={true}
        />,
      );

      const title = getByText('ScamGuardian');
      expect(title.props.style).toContainEqual(expect.objectContaining({ fontSize: 32 }));
    });
  });
});

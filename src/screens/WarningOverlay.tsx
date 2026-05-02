/**
 * WarningOverlay
 *
 * Screen/overlay that renders the appropriate warning UI component based on
 * the current WarningContext state:
 *   - warningLevel === 'danger'  → FullScreenWarning
 *   - warningLevel === 'caution' → CautionBanner
 *   - warningLevel === 'none'    → null (no warning)
 *
 * The "ask my family" button in FullScreenWarning calls AlertServiceClient.sendAlert()
 * with userRequestedHelp: true.
 *
 * Requirements: 1.3, 1.4, 1.5, 4.4
 */

import React, { useCallback } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useWarning } from '../contexts/WarningContext';
import FullScreenWarning from '../components/FullScreenWarning';
import CautionBanner from '../components/CautionBanner';
import { AlertServiceClient } from '../services/AlertServiceClient';
import type { AlertPayload } from '../models/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WarningOverlayProps {
  /** User ID for constructing AlertPayload. */
  userId: string;
  /** Whether large font mode is enabled (passed to FullScreenWarning). */
  largeFontEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WarningOverlay: React.FC<WarningOverlayProps> = ({
  userId,
  largeFontEnabled = false,
}) => {
  const { currentAnalysis, warningLevel, dismissWarning } = useWarning();

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  /**
   * Called when the User taps "I'm not sure — ask my family" in FullScreenWarning.
   * Sends an alert with userRequestedHelp: true.
   *
   * Requirement 4.4
   */
  const handleAskFamily = useCallback(async () => {
    if (!currentAnalysis) {
      return;
    }

    const payload: AlertPayload = {
      userId,
      messageId: currentAnalysis.messageId,
      sender: 'Unknown', // TODO: extract sender from MessageEvent in Task 8.1
      threatSummary: generateThreatSummary(currentAnalysis),
      riskScore: currentAnalysis.riskScore,
      timestamp: new Date().toISOString(),
      userRequestedHelp: true,
    };

    await AlertServiceClient.sendAlert(payload);

    // Keep the warning visible until Guardian responds
  }, [currentAnalysis, userId]);

  /**
   * Called when the User taps "I know this person — it's safe" in FullScreenWarning.
   * Dismisses the warning immediately.
   */
  const handleMarkSafe = useCallback(() => {
    dismissWarning();
  }, [dismissWarning]);

  /**
   * Called when the User dismisses the CautionBanner.
   */
  const handleDismissCaution = useCallback(() => {
    dismissWarning();
  }, [dismissWarning]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (warningLevel === 'none' || !currentAnalysis) {
    return null;
  }

  if (warningLevel === 'danger') {
    // Full-screen modal for high-risk warnings
    return (
      <Modal
        visible
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleMarkSafe}>
        <FullScreenWarning
          threatAnalysis={currentAnalysis}
          onAskFamily={handleAskFamily}
          onMarkSafe={handleMarkSafe}
          largeFontEnabled={largeFontEnabled}
        />
      </Modal>
    );
  }

  if (warningLevel === 'caution') {
    // Inline banner for medium-risk warnings
    return (
      <View style={styles.cautionContainer}>
        <CautionBanner
          threatAnalysis={currentAnalysis}
          onDismiss={handleDismissCaution}
        />
      </View>
    );
  }

  return null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a plain-language threat summary from ThreatAnalysis indicators.
 * Uses Grade 6 reading level or below.
 *
 * Priority order (most severe first):
 * phishing_url > malicious_attachment > impersonation > investment_scam > urgency_language
 */
function generateThreatSummary(analysis: {
  indicators: Array<{ type: string }>;
}): string {
  const { indicators } = analysis;

  if (indicators.length === 0) {
    return 'This message looks suspicious. Be careful.';
  }

  const severityOrder = [
    'phishing_url',
    'malicious_attachment',
    'impersonation',
    'investment_scam',
    'urgency_language',
  ];

  const messages: Record<string, string> = {
    phishing_url:
      'This message contains a dangerous link that could steal your information.',
    malicious_attachment: 'This message has a dangerous file attached.',
    impersonation:
      'Someone may be pretending to be your bank, the government, or a family member.',
    investment_scam:
      'This message is offering something that sounds too good to be true.',
    urgency_language:
      'This message is trying to rush you into doing something.',
  };

  for (const type of severityOrder) {
    if (indicators.some(indicator => indicator.type === type)) {
      return messages[type];
    }
  }

  return 'This message looks suspicious. Be careful.';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  cautionContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: 16,
  },
});

export default WarningOverlay;

/**
 * FullScreenWarning
 *
 * Displayed when a message's riskScore is ≥ 70.
 * Shows a full-screen warning in plain, non-technical language with two
 * clearly labelled action buttons.
 *
 * Requirements: 1.3, 4.1, 4.2, 4.3, 4.5
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ThreatAnalysis, ThreatIndicator } from '../models/types';

export interface FullScreenWarningProps {
  threatAnalysis: ThreatAnalysis;
  onAskFamily: () => void;
  onMarkSafe: () => void;
  largeFontEnabled?: boolean;
}

/**
 * Generate a plain-language threat summary from ThreatAnalysis indicators.
 * Uses Grade 6 reading level or below.
 * 
 * Priority order (most severe first):
 * phishing_url > malicious_attachment > impersonation > investment_scam > urgency_language
 */
const generateThreatSummary = (indicators: ThreatIndicator[]): string => {
  if (indicators.length === 0) {
    return 'This message looks suspicious. Be careful.';
  }

  // Define severity order and corresponding messages
  const severityOrder: ThreatIndicator['type'][] = [
    'phishing_url',
    'malicious_attachment',
    'impersonation',
    'investment_scam',
    'urgency_language',
  ];

  const messages: Record<ThreatIndicator['type'], string> = {
    phishing_url: 'This message contains a dangerous link that could steal your information.',
    malicious_attachment: 'This message has a dangerous file attached.',
    impersonation: 'Someone may be pretending to be your bank, the government, or a family member.',
    investment_scam: 'This message is offering something that sounds too good to be true.',
    urgency_language: 'This message is trying to rush you into doing something.',
  };

  // Find the most severe indicator present
  for (const type of severityOrder) {
    if (indicators.some(indicator => indicator.type === type)) {
      return messages[type];
    }
  }

  return 'This message looks suspicious. Be careful.';
};

const FullScreenWarning: React.FC<FullScreenWarningProps> = ({
  threatAnalysis,
  onAskFamily,
  onMarkSafe,
  largeFontEnabled = false,
}) => {
  const threatSummary = generateThreatSummary(threatAnalysis.indicators);

  // Font sizes based on largeFontEnabled prop
  const headingSize = largeFontEnabled ? 28 : 22;
  const bodySize = largeFontEnabled ? 20 : 16;
  const buttonSize = largeFontEnabled ? 22 : 18;

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { fontSize: headingSize }]}>
        This looks dangerous — don't tap anything
      </Text>
      <Text style={[styles.threatSummary, { fontSize: bodySize }]}>
        {threatSummary}
      </Text>
      <TouchableOpacity style={styles.askFamilyButton} onPress={onAskFamily}>
        <Text style={[styles.askFamilyButtonText, { fontSize: buttonSize }]}>
          I'm not sure — ask my family
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.markSafeButton} onPress={onMarkSafe}>
        <Text style={[styles.markSafeButtonText, { fontSize: buttonSize }]}>
          I know this person — it's safe
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#B71C1C', // Deep red for high-contrast warning
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heading: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  threatSummary: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  askFamilyButton: {
    backgroundColor: '#1565C0', // Blue for "ask family"
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  askFamilyButtonText: {
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  markSafeButton: {
    backgroundColor: '#2E7D32', // Green for "mark safe"
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  markSafeButtonText: {
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default FullScreenWarning;

/**
 * CautionBanner
 *
 * Inline overlay displayed when a message's riskScore is between 40 and 69
 * (inclusive). Uses softer, plain-language caution text compared to the
 * full-screen warning.
 *
 * Requirements: 1.4, 4.1
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ThreatAnalysis, ThreatIndicator } from '../models/types';

export interface CautionBannerProps {
  threatAnalysis: ThreatAnalysis;
  onDismiss: () => void;
}

/**
 * Generate a plain-language caution message from ThreatAnalysis indicators.
 * Uses softer language than FullScreenWarning (Grade 6 reading level or below).
 *
 * Priority order (most severe first):
 * phishing_url > malicious_attachment > impersonation > investment_scam > urgency_language
 */
const generateCautionText = (indicators: ThreatIndicator[]): string => {
  if (indicators.length === 0) {
    return 'This message looks a little suspicious. Be careful.';
  }

  const severityOrder: ThreatIndicator['type'][] = [
    'phishing_url',
    'malicious_attachment',
    'impersonation',
    'investment_scam',
    'urgency_language',
  ];

  const messages: Record<ThreatIndicator['type'], string> = {
    phishing_url: 'Be careful — this message has a link that may not be safe.',
    malicious_attachment:
      'The file in this message may not be safe to open.',
    impersonation:
      'Check who sent this — it may not be who you think.',
    investment_scam:
      'This offer may be too good to be true. Be careful.',
    urgency_language:
      'This message seems to be in a hurry. Take your time.',
  };

  for (const type of severityOrder) {
    if (indicators.some(indicator => indicator.type === type)) {
      return messages[type];
    }
  }

  return 'This message looks a little suspicious. Be careful.';
};

const CautionBanner: React.FC<CautionBannerProps> = ({
  threatAnalysis,
  onDismiss,
}) => {
  const cautionText = generateCautionText(threatAnalysis.indicators);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.cautionText}>{cautionText}</Text>
      </View>
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={onDismiss}
        accessibilityLabel="Dismiss caution banner"
        accessibilityRole="button">
        <Text style={styles.dismissButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F57F17', // Amber/yellow for caution
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: 10,
  },
  cautionText: {
    flex: 1,
    fontSize: 16, // Minimum 16sp for accessibility
    color: '#1A1A1A', // Dark text for contrast against amber background
    fontWeight: '500',
    lineHeight: 22,
  },
  dismissButton: {
    marginLeft: 12,
    padding: 4,
  },
  dismissButtonText: {
    fontSize: 18,
    color: '#1A1A1A',
    fontWeight: '600',
  },
});

export { generateCautionText };
export default CautionBanner;

/**
 * GuardianActionScreen
 *
 * Displayed when the Guardian deep-links from an FCM notification.
 * Shows sender identity, plain-language threat summary, Risk_Score (as a
 * colored badge), and timestamp. Provides three action buttons that POST a
 * GuardianAction to the backend.
 *
 * Requirements: 3.2, 3.3
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { GuardianAction, GuardianNotification } from '../models/types';
import { ALERT_API_BASE_URL } from '../services/AlertServiceClient';

export interface GuardianActionScreenProps {
  notification: GuardianNotification;
  /** The authenticated Guardian's ID */
  guardianId: string;
  /** The User's ID */
  userId: string;
  /** The User's display name (used in "Call [User name]" button label) */
  userName?: string;
  /** Base URL for the backend API (defaults to ALERT_API_BASE_URL) */
  apiBaseUrl?: string;
}

/**
 * Returns the badge colour for a given risk score:
 *   red   ≥ 70
 *   amber 40–69
 *   green < 40
 */
const getRiskBadgeColor = (score: number): string => {
  if (score >= 70) return '#FF3B30'; // red
  if (score >= 40) return '#FF9500'; // amber
  return '#34C759';                  // green
};

const GuardianActionScreen: React.FC<GuardianActionScreenProps> = ({
  notification,
  guardianId,
  userId,
  userName,
  apiBaseUrl = ALERT_API_BASE_URL,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState<'success' | 'error' | null>(null);

  const displayName = userName || 'User';

  const dispatchAction = async (
    action: GuardianAction['action'],
  ): Promise<void> => {
    setLoading(true);
    setActionResult(null);

    const payload: GuardianAction & { userId: string; notificationId: string } =
      {
        messageId: notification.messageId,
        action,
        guardianId,
        timestamp: new Date().toISOString(),
        userId,
        notificationId: notification.notificationId,
      };

    try {
      const response = await fetch(`${apiBaseUrl}/guardian/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      setActionResult('success');
    } catch (err) {
      setActionResult('error');
      Alert.alert('Error', 'Could not send your response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formattedTime = new Date(notification.timestamp).toLocaleString();
  const badgeColor = getRiskBadgeColor(notification.riskScore);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guardian Alert</Text>

      <View style={styles.infoCard}>
        <Text style={styles.label}>From</Text>
        <Text style={styles.value}>{notification.sender}</Text>

        <Text style={styles.label}>Threat Summary</Text>
        <Text style={styles.value}>{notification.threatSummary}</Text>

        <Text style={styles.label}>Risk Score</Text>
        <View style={[styles.riskBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.riskBadgeText}>{notification.riskScore} / 100</Text>
        </View>

        <Text style={styles.label}>Received</Text>
        <Text style={styles.value}>{formattedTime}</Text>
      </View>

      {actionResult === 'success' && (
        <Text style={styles.successText}>Response sent successfully.</Text>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.safeButton]}
            onPress={() => dispatchAction('mark_safe')}
            accessibilityLabel="Mark as safe"
          >
            <Text style={styles.buttonText}>Mark as safe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.scamButton]}
            onPress={() => dispatchAction('confirm_scam')}
            accessibilityLabel="Confirm scam"
          >
            <Text style={styles.buttonText}>Confirm scam</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.callButton]}
            onPress={() => dispatchAction('call_user')}
            accessibilityLabel={`Call ${displayName}`}
          >
            <Text style={styles.buttonText}>Call {displayName}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 17,
    color: '#1C1C1E',
    marginTop: 4,
  },
  riskBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  riskBadgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  successText: {
    fontSize: 15,
    color: '#34C759',
    marginBottom: 12,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  safeButton: {
    backgroundColor: '#34C759',
  },
  scamButton: {
    backgroundColor: '#FF3B30',
  },
  callButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loader: {
    marginTop: 32,
  },
});

export default GuardianActionScreen;

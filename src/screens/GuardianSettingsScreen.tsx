/**
 * GuardianSettingsScreen
 *
 * Allows the Guardian to toggle Safe Mode on/off for the protected User.
 * On toggle, POSTs a `toggle_safe_mode` action to the backend which updates
 * UserProfile.safeModeEnabled in Firestore and pushes the new value to the
 * User device.
 *
 * Requirements: 6.5
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import type { GuardianAction } from '../models/types';
import { ALERT_API_BASE_URL } from '../services/AlertServiceClient';

export interface GuardianSettingsScreenProps {
  /** The authenticated Guardian's ID */
  guardianId: string;
  /** The User's ID whose settings are being managed */
  userId: string;
  /** Initial Safe Mode state */
  initialSafeModeEnabled: boolean;
  /** Base URL for the backend API (defaults to ALERT_API_BASE_URL) */
  apiBaseUrl?: string;
}

const GuardianSettingsScreen: React.FC<GuardianSettingsScreenProps> = ({
  guardianId,
  userId,
  initialSafeModeEnabled,
  apiBaseUrl = ALERT_API_BASE_URL,
}) => {
  const [safeMode, setSafeMode] = useState(initialSafeModeEnabled);
  const [loading, setLoading] = useState(false);

  const handleSafeModeToggle = async (value: boolean): Promise<void> => {
    setSafeMode(value);
    setLoading(true);

    // toggle_safe_mode is a guardian-initiated action; we reuse the
    // GuardianAction shape with a custom action string.
    const payload: GuardianAction & { userId: string; safeModeEnabled: boolean } =
      {
        messageId: '',          // not tied to a specific message
        action: 'toggle_safe_mode' as GuardianAction['action'],
        guardianId,
        timestamp: new Date().toISOString(),
        userId,
        safeModeEnabled: value,
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
    } catch (_err) {
      // Revert optimistic update on failure
      setSafeMode(!value);
      Alert.alert('Error', 'Could not update Safe Mode. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guardian Settings</Text>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Safe Mode</Text>
          <Text style={styles.rowDescription}>
            Block all links until you approve them
          </Text>
        </View>
        <Switch
          value={safeMode}
          onValueChange={handleSafeModeToggle}
          disabled={loading}
          accessibilityLabel="Safe Mode toggle"
          testID="safe-mode-toggle"
        />
      </View>
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
    marginBottom: 24,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  rowDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
});

export default GuardianSettingsScreen;

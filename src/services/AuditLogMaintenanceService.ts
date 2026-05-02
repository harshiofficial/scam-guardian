/**
 * AuditLogMaintenanceService
 *
 * Runs two maintenance tasks whenever the app comes to the foreground:
 *   1. Retention: delete entries older than 90 days (Requirement 7.2)
 *   2. Storage cap: if total size > 500 MB, delete oldest entries until
 *      size drops below 400 MB, then notify the Guardian (Requirement 7.5)
 *
 * Usage:
 *   const stopMaintenance = AuditLogMaintenanceService.startMaintenanceOnForeground();
 *   // later, when tearing down:
 *   stopMaintenance();
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  auditLogRepository,
  STORAGE_CAP_BYTES,
  STORAGE_TARGET_BYTES,
} from './AuditLogRepository';

// ---------------------------------------------------------------------------
// Local notification helper
// ---------------------------------------------------------------------------

/**
 * Sends a local notification to the Guardian informing them that old audit
 * log entries were deleted to free up storage.
 *
 * In production this would use @notifee/react-native or
 * @react-native-community/push-notification-ios. For now we use the
 * React Native built-in Alert as a cross-platform placeholder that works
 * without additional native dependencies.
 *
 * Exported so it can be replaced in tests.
 */
export let sendStorageCleanupNotification = async (
  deletedCount: number,
): Promise<void> => {
  // Dynamic import keeps the dependency optional at the module level.
  // If a real notification library is available it can be wired here.
  try {
    const { Alert } = await import('react-native');
    Alert.alert(
      'Audit Log Cleaned',
      `${deletedCount} old audit log ${
        deletedCount === 1 ? 'entry was' : 'entries were'
      } removed to free up storage space.`,
    );
  } catch {
    // Silently ignore if Alert is unavailable (e.g. in a headless JS context).
  }
};

// ---------------------------------------------------------------------------
// AuditLogMaintenanceService
// ---------------------------------------------------------------------------

class AuditLogMaintenanceServiceClass {
  private readonly notify: (deletedCount: number) => Promise<void>;

  constructor(
    notifyFn: (deletedCount: number) => Promise<void> = sendStorageCleanupNotification,
  ) {
    this.notify = notifyFn;
  }

  /**
   * Runs both maintenance tasks sequentially:
   *   1. Delete entries older than 90 days.
   *   2. If storage > 500 MB, delete oldest entries until < 400 MB and
   *      notify the Guardian.
   *
   * Requirements: 7.2, 7.5
   */
  async runMaintenance(): Promise<void> {
    // --- Step 1: Retention (90-day rule) ---
    try {
      await auditLogRepository.deleteExpiredEntries();
    } catch (err) {
      console.warn('[AuditLogMaintenance] Retention cleanup failed:', err);
    }

    // --- Step 2: Storage cap enforcement ---
    try {
      const totalBytes = await auditLogRepository.getTotalSizeBytes();
      if (totalBytes > STORAGE_CAP_BYTES) {
        const deletedCount = await auditLogRepository.deleteOldestUntilBelow(
          STORAGE_TARGET_BYTES,
        );
        if (deletedCount > 0) {
          await this.notify(deletedCount);
        }
      }
    } catch (err) {
      console.warn('[AuditLogMaintenance] Storage cap enforcement failed:', err);
    }
  }

  /**
   * Subscribes to AppState 'active' events and calls `runMaintenance()`
   * each time the app comes to the foreground.
   *
   * @returns An unsubscribe function that removes the AppState listener.
   *
   * Requirements: 7.2, 7.5
   */
  startMaintenanceOnForeground(): () => void {
    const handleAppStateChange = (nextState: AppStateStatus): void => {
      if (nextState === 'active') {
        this.runMaintenance().catch(err => {
          console.warn('[AuditLogMaintenance] runMaintenance error:', err);
        });
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    // Return an unsubscribe function
    return () => {
      subscription.remove();
    };
  }
}

/** Singleton instance for use throughout the app. */
export const AuditLogMaintenanceService = new AuditLogMaintenanceServiceClass();
export { AuditLogMaintenanceServiceClass };

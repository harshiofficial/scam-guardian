/**
 * ScamGuardian Backend — Guardian Reminder Job
 *
 * Checks every 5 minutes for unresponded alerts older than 30 minutes.
 * Re-dispatches FCM reminder notification to Guardian for each.
 * Requirement 3.5
 */
import {
  getGuardianForUser,
  getUnrespondedAlertsOlderThan,
  markReminderSent,
} from '../services/FirestoreService';
import { sendGuardianReminder } from '../services/FcmService';

export const REMINDER_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
export const CHECK_INTERVAL_MS = 5 * 60 * 1000;      // 5 minutes

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Run a single pass of the reminder check.
 * Exported for testing purposes.
 */
export async function runReminderCheck(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - REMINDER_THRESHOLD_MS);
  const unresponded = await getUnrespondedAlertsOlderThan(cutoff);

  for (const alert of unresponded) {
    try {
      const guardian = await getGuardianForUser(alert.userId);
      if (!guardian) continue;

      await sendGuardianReminder(
        guardian.guardianFcmToken,
        alert.notificationId,
        alert.userId,
        alert.sender,
        alert.riskScore,
      );

      await markReminderSent(alert.notificationId, now);
    } catch (err) {
      // Log but don't crash the job for a single failure
      console.error(
        `[ReminderJob] Failed to send reminder for alert ${alert.notificationId}:`,
        err,
      );
    }
  }
}

/**
 * Start the reminder job scheduler.
 * Returns a stop function that clears the interval (useful for clean shutdown / testing).
 */
export function startReminderJob(): () => void {
  if (!intervalHandle) {
    intervalHandle = setInterval(() => {
      runReminderCheck().catch(err =>
        console.error('[ReminderJob] Unhandled error in reminder check:', err),
      );
    }, CHECK_INTERVAL_MS);
  }

  return () => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };
}

/**
 * Stop the reminder job scheduler (for clean shutdown / testing).
 */
export function stopReminderJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

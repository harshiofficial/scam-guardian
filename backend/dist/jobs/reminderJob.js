"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopReminderJob = exports.startReminderJob = exports.runReminderCheck = exports.CHECK_INTERVAL_MS = exports.REMINDER_THRESHOLD_MS = void 0;
/**
 * ScamGuardian Backend — Guardian Reminder Job
 *
 * Checks every 5 minutes for unresponded alerts older than 30 minutes.
 * Re-dispatches FCM reminder notification to Guardian for each.
 * Requirement 3.5
 */
const FirestoreService_1 = require("../services/FirestoreService");
const FcmService_1 = require("../services/FcmService");
exports.REMINDER_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
exports.CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let intervalHandle = null;
/**
 * Run a single pass of the reminder check.
 * Exported for testing purposes.
 */
async function runReminderCheck(now = new Date()) {
    const cutoff = new Date(now.getTime() - exports.REMINDER_THRESHOLD_MS);
    const unresponded = await (0, FirestoreService_1.getUnrespondedAlertsOlderThan)(cutoff);
    for (const alert of unresponded) {
        try {
            const guardian = await (0, FirestoreService_1.getGuardianForUser)(alert.userId);
            if (!guardian)
                continue;
            await (0, FcmService_1.sendGuardianReminder)(guardian.guardianFcmToken, alert.notificationId, alert.userId, alert.sender, alert.riskScore);
            await (0, FirestoreService_1.markReminderSent)(alert.notificationId, now);
        }
        catch (err) {
            // Log but don't crash the job for a single failure
            console.error(`[ReminderJob] Failed to send reminder for alert ${alert.notificationId}:`, err);
        }
    }
}
exports.runReminderCheck = runReminderCheck;
/**
 * Start the reminder job scheduler.
 * Returns a stop function that clears the interval (useful for clean shutdown / testing).
 */
function startReminderJob() {
    if (!intervalHandle) {
        intervalHandle = setInterval(() => {
            runReminderCheck().catch(err => console.error('[ReminderJob] Unhandled error in reminder check:', err));
        }, exports.CHECK_INTERVAL_MS);
    }
    return () => {
        if (intervalHandle) {
            clearInterval(intervalHandle);
            intervalHandle = null;
        }
    };
}
exports.startReminderJob = startReminderJob;
/**
 * Stop the reminder job scheduler (for clean shutdown / testing).
 */
function stopReminderJob() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
}
exports.stopReminderJob = stopReminderJob;
//# sourceMappingURL=reminderJob.js.map
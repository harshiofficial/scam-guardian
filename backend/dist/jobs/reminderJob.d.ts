export declare const REMINDER_THRESHOLD_MS: number;
export declare const CHECK_INTERVAL_MS: number;
/**
 * Run a single pass of the reminder check.
 * Exported for testing purposes.
 */
export declare function runReminderCheck(now?: Date): Promise<void>;
/**
 * Start the reminder job scheduler.
 * Returns a stop function that clears the interval (useful for clean shutdown / testing).
 */
export declare function startReminderJob(): () => void;
/**
 * Stop the reminder job scheduler (for clean shutdown / testing).
 */
export declare function stopReminderJob(): void;
//# sourceMappingURL=reminderJob.d.ts.map
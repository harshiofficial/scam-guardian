/**
 * ScamGuardian Backend — Entry Point
 */
import app from './app';
import { startReminderJob } from './jobs/reminderJob';

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`ScamGuardian backend listening on port ${PORT}`);

  // Start the Guardian reminder job: checks every 5 minutes for unresponded
  // alerts older than 30 minutes and re-dispatches FCM reminders (Requirement 3.5)
  startReminderJob();
  console.log('[ReminderJob] Guardian reminder job started');
});

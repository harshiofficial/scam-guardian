"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ScamGuardian Backend — Entry Point
 */
const app_1 = __importDefault(require("./app"));
const reminderJob_1 = require("./jobs/reminderJob");
const PORT = process.env.PORT ?? 3000;
app_1.default.listen(PORT, () => {
    console.log(`ScamGuardian backend listening on port ${PORT}`);
    // Start the Guardian reminder job: checks every 5 minutes for unresponded
    // alerts older than 30 minutes and re-dispatches FCM reminders (Requirement 3.5)
    (0, reminderJob_1.startReminderJob)();
    console.log('[ReminderJob] Guardian reminder job started');
});
//# sourceMappingURL=index.js.map
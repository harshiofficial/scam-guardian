/**
 * GuardianActionHandler
 *
 * Wires AlertServiceClient to WarningContext, AuditLogRepository, and SafeModeInterceptor.
 * When the Guardian takes an action (mark_safe or confirm_scam), this handler:
 *  1. For Safe Mode links: routes to SafeModeInterceptor.handleGuardianAction()
 *  2. For regular messages: dismisses the warning UI and updates the audit log entry outcome
 *
 * Requirements: 3.4, 6.3, 6.4
 */

import { AlertServiceClient } from './AlertServiceClient';
import { AuditLogRepository } from './AuditLogRepository';
import type { GuardianAction } from '../models/types';
import type { SafeModeInterceptor } from './SafeModeInterceptor';

export class GuardianActionHandler {
  private readonly alertServiceClient: typeof AlertServiceClient;
  private readonly auditLogRepository: AuditLogRepository;
  private readonly safeModeInterceptor: SafeModeInterceptor | null;
  /** Map of messageId -> URL for Safe Mode links awaiting Guardian approval */
  private readonly safeModeLinks: Map<string, string>;

  constructor(
    alertServiceClient: typeof AlertServiceClient = AlertServiceClient,
    auditLogRepository: AuditLogRepository,
    safeModeInterceptor: SafeModeInterceptor | null = null,
  ) {
    this.alertServiceClient = alertServiceClient;
    this.auditLogRepository = auditLogRepository;
    this.safeModeInterceptor = safeModeInterceptor;
    this.safeModeLinks = new Map();
  }

  /**
   * Register a Safe Mode link that is awaiting Guardian approval.
   * Called by SafeModeInterceptor when a link is intercepted.
   *
   * @param messageId - The messageId of the intercepted link alert
   * @param url - The URL that was intercepted
   */
  registerSafeModeLink(messageId: string, url: string): void {
    this.safeModeLinks.set(messageId, url);
  }

  /**
   * Start listening for Guardian actions from FCM.
   *
   * When a Guardian action is received:
   *  - If it's for a Safe Mode link: route to SafeModeInterceptor.handleGuardianAction()
   *  - If action === 'mark_safe': dismiss warning and update audit log to 'guardian_safe'
   *  - If action === 'confirm_scam': dismiss warning and update audit log to 'guardian_scam'
   *
   * @param dismissWarning - Callback to dismiss the FullScreenWarning (from WarningContext)
   * @returns An unsubscribe function to stop listening
   */
  start(dismissWarning: () => void): () => void {
    const unsubscribe = this.alertServiceClient.onGuardianAction(
      async (action: GuardianAction) => {
        // Check if this is a Safe Mode link action (Requirements 6.3, 6.4)
        const safeModeUrl = this.safeModeLinks.get(action.messageId);
        if (safeModeUrl && this.safeModeInterceptor) {
          // Route to SafeModeInterceptor for link approval/rejection handling
          await this.safeModeInterceptor.handleGuardianAction(action, safeModeUrl);
          // Clean up the tracked link
          this.safeModeLinks.delete(action.messageId);
          return;
        }

        // Handle regular message alerts
        if (action.action === 'mark_safe') {
          // Dismiss the warning immediately (within 5 seconds per spec)
          dismissWarning();
          // Update the audit log entry outcome
          await this.auditLogRepository.updateOutcome(
            action.messageId,
            'guardian_safe',
          );
        } else if (action.action === 'confirm_scam') {
          // Also dismiss the warning (user should not interact with the message)
          dismissWarning();
          // Update the audit log entry outcome
          await this.auditLogRepository.updateOutcome(
            action.messageId,
            'guardian_scam',
          );
        }
        // For 'call_user' action, we don't dismiss or update audit log
        // (the warning remains until the Guardian explicitly marks it safe/scam)
      },
    );

    return unsubscribe;
  }
}

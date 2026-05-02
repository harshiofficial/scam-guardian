/**
 * ScamGuardian — AttachmentScanner
 *
 * Checks file attachments for known malicious file extensions and returns a
 * ThreatIndicator of type 'malicious_attachment' for each match.
 *
 * Extension matching is case-insensitive. One indicator is returned per
 * malicious attachment — if a message contains three malicious attachments,
 * three indicators are returned.
 *
 * Requirements: 2.5
 */

import {Attachment, ThreatIndicator} from '../models/types';

/**
 * File extensions considered malicious.
 * All entries are lowercase and include the leading dot.
 *
 * Rationale for each entry:
 *   .exe  — Windows executable
 *   .apk  — Android package
 *   .zip  — Compressed archive (may contain executables)
 *   .bat  — Windows batch file
 *   .cmd  — Windows command file
 *   .scr  — Windows screensaver (commonly used to distribute malware)
 *   .vbs  — Visual Basic Script
 *   .js   — JavaScript file (when delivered as an attachment)
 *   .jar  — Java archive
 *   .dmg  — macOS disk image
 *   .pkg  — macOS package installer
 *   .deb  — Debian package
 *   .rpm  — RPM package
 */
const MALICIOUS_EXTENSIONS: ReadonlySet<string> = new Set([
  '.exe',
  '.apk',
  '.zip',
  '.bat',
  '.cmd',
  '.scr',
  '.vbs',
  '.js',
  '.jar',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
]);

export class AttachmentScanner {
  /**
   * Scan a list of attachments for malicious file extensions.
   *
   * @param attachments - The attachments to inspect.
   * @returns One ThreatIndicator per malicious attachment (not deduplicated).
   *          Returns an empty array when no malicious attachments are found or
   *          when the input array is empty.
   *
   * Requirement 2.5
   */
  scan(attachments: Attachment[]): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    for (const attachment of attachments) {
      const ext = attachment.extension.toLowerCase();
      if (MALICIOUS_EXTENSIONS.has(ext)) {
        indicators.push({
          type: 'malicious_attachment',
          confidence: 0.9,
          evidence: `Malicious attachment detected: "${attachment.filename}" (${attachment.extension})`,
        });
      }
    }

    return indicators;
  }
}

/** Singleton instance for use throughout the app. */
export const attachmentScanner = new AttachmentScanner();

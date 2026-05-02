/**
 * Unit tests for AttachmentScanner
 *
 * Covers:
 *  - Returns empty array for empty attachments list
 *  - Returns empty array for safe (non-malicious) attachments
 *  - Returns one indicator per malicious attachment
 *  - Returns correct indicator shape (type, confidence, evidence)
 *  - Evidence string includes filename and extension
 *  - Case-insensitive extension matching (.EXE, .Apk, etc.)
 *  - All hardcoded malicious extensions are detected
 *  - Multiple malicious attachments produce multiple indicators (not deduplicated)
 *  - Mixed safe and malicious attachments — only malicious ones flagged
 *
 * Requirements: 2.5
 */

import {AttachmentScanner} from '../AttachmentScanner';
import {Attachment} from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttachment(filename: string, extension: string): Attachment {
  return {
    filename,
    mimeType: 'application/octet-stream',
    extension,
    sizeBytes: 1024,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AttachmentScanner', () => {
  let scanner: AttachmentScanner;

  beforeEach(() => {
    scanner = new AttachmentScanner();
  });

  // -------------------------------------------------------------------------
  // Empty / safe inputs
  // -------------------------------------------------------------------------

  describe('empty and safe inputs', () => {
    it('returns an empty array when given no attachments', () => {
      expect(scanner.scan([])).toHaveLength(0);
    });

    it('returns an empty array for a single safe attachment (.pdf)', () => {
      const result = scanner.scan([makeAttachment('document.pdf', '.pdf')]);
      expect(result).toHaveLength(0);
    });

    it('returns an empty array for multiple safe attachments', () => {
      const attachments = [
        makeAttachment('photo.jpg', '.jpg'),
        makeAttachment('report.docx', '.docx'),
        makeAttachment('data.csv', '.csv'),
      ];
      expect(scanner.scan(attachments)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Indicator shape
  // -------------------------------------------------------------------------

  describe('indicator shape', () => {
    it('returns type "malicious_attachment" for a .exe file', () => {
      const [indicator] = scanner.scan([makeAttachment('setup.exe', '.exe')]);
      expect(indicator.type).toBe('malicious_attachment');
    });

    it('returns confidence 0.9 for a malicious attachment', () => {
      const [indicator] = scanner.scan([makeAttachment('setup.exe', '.exe')]);
      expect(indicator.confidence).toBe(0.9);
    });

    it('includes the filename in the evidence string', () => {
      const [indicator] = scanner.scan([makeAttachment('setup.exe', '.exe')]);
      expect(indicator.evidence).toContain('setup.exe');
    });

    it('includes the extension in the evidence string', () => {
      const [indicator] = scanner.scan([makeAttachment('setup.exe', '.exe')]);
      expect(indicator.evidence).toContain('.exe');
    });
  });

  // -------------------------------------------------------------------------
  // All malicious extensions
  // -------------------------------------------------------------------------

  describe('malicious extension detection', () => {
    const maliciousExtensions = [
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
    ];

    it.each(maliciousExtensions)(
      'flags attachment with extension %s',
      ext => {
        const result = scanner.scan([makeAttachment(`file${ext}`, ext)]);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('malicious_attachment');
      },
    );
  });

  // -------------------------------------------------------------------------
  // Case-insensitive matching
  // -------------------------------------------------------------------------

  describe('case-insensitive extension matching', () => {
    it('detects .EXE (uppercase)', () => {
      const result = scanner.scan([makeAttachment('SETUP.EXE', '.EXE')]);
      expect(result).toHaveLength(1);
    });

    it('detects .Apk (mixed case)', () => {
      const result = scanner.scan([makeAttachment('app.Apk', '.Apk')]);
      expect(result).toHaveLength(1);
    });

    it('detects .ZIP (uppercase)', () => {
      const result = scanner.scan([makeAttachment('archive.ZIP', '.ZIP')]);
      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple attachments
  // -------------------------------------------------------------------------

  describe('multiple attachments', () => {
    it('returns one indicator per malicious attachment (not deduplicated)', () => {
      const attachments = [
        makeAttachment('virus1.exe', '.exe'),
        makeAttachment('virus2.exe', '.exe'),
        makeAttachment('malware.apk', '.apk'),
      ];
      const result = scanner.scan(attachments);
      expect(result).toHaveLength(3);
      expect(result.every(i => i.type === 'malicious_attachment')).toBe(true);
    });

    it('only flags malicious attachments in a mixed list', () => {
      const attachments = [
        makeAttachment('photo.jpg', '.jpg'),
        makeAttachment('virus.exe', '.exe'),
        makeAttachment('report.pdf', '.pdf'),
        makeAttachment('malware.apk', '.apk'),
      ];
      const result = scanner.scan(attachments);
      expect(result).toHaveLength(2);
      expect(result.every(i => i.type === 'malicious_attachment')).toBe(true);
    });

    it('each indicator references its own attachment filename', () => {
      const attachments = [
        makeAttachment('first.exe', '.exe'),
        makeAttachment('second.apk', '.apk'),
      ];
      const result = scanner.scan(attachments);
      expect(result[0].evidence).toContain('first.exe');
      expect(result[1].evidence).toContain('second.apk');
    });
  });
});

/**
 * Unit tests for AuditLogScreen
 * Requirements: 7.3, 7.4
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AuditLogScreen, { entriesToCsv } from '../AuditLogScreen';
import type { AuditLogEntry } from '../../models/types';
import Share from 'react-native/Libraries/Share/Share';

// ---------------------------------------------------------------------------
// Mock repository
// ---------------------------------------------------------------------------

const mockFindAll = jest.fn();

const mockRepository = {
  findAll: mockFindAll,
  open: jest.fn(),
  close: jest.fn(),
  createTable: jest.fn(),
  insert: jest.fn(),
  updateOutcome: jest.fn(),
  findOlderThan: jest.fn(),
  getTotalSizeBytes: jest.fn(),
  deleteOldestUntilBelow: jest.fn(),
  deleteExpiredEntries: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock Share API — handled via moduleNameMapper in package.json
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'entry-001',
    timestamp: new Date('2024-06-01T10:00:00Z'),
    sender: '+1234567890',
    riskScore: 75,
    threatTypes: ['phishing_url'],
    outcome: 'pending',
    messagePreview: 'Click here to claim your prize',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogScreen', () => {
  beforeEach(() => {
    mockFindAll.mockReset();
    (Share.share as jest.Mock).mockReset();
    (Share.share as jest.Mock).mockResolvedValue({ action: 'sharedAction' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Requirement 7.3 — display audit log entries
  // -------------------------------------------------------------------------

  describe('Requirement 7.3 — display audit log entries', () => {
    it('renders loading indicator while fetching entries', () => {
      mockFindAll.mockReturnValue(new Promise(() => {})); // never resolves
      const { getByLabelText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );
      expect(getByLabelText('Loading audit log')).toBeTruthy();
    });

    it('renders empty state when no entries are returned', async () => {
      mockFindAll.mockResolvedValue([]);
      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );
      await waitFor(() => {
        expect(getByText('No flagged messages yet.')).toBeTruthy();
      });
    });

    it('renders a list of entries when data is available', async () => {
      const entries = [
        makeEntry({ id: 'e1', sender: 'Alice', riskScore: 85 }),
        makeEntry({ id: 'e2', sender: 'Bob', riskScore: 55 }),
      ];
      mockFindAll.mockResolvedValue(entries);

      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('Bob')).toBeTruthy();
        expect(getByText('85 / 100')).toBeTruthy();
        expect(getByText('55 / 100')).toBeTruthy();
      });
    });

    it('displays date/time, sender, risk score, threat type, and outcome for each entry', async () => {
      const entry = makeEntry({
        id: 'full-entry',
        timestamp: new Date('2024-06-15T14:30:00Z'),
        sender: '+447911123456',
        riskScore: 72,
        threatTypes: ['urgency_language', 'impersonation'],
        outcome: 'guardian_safe',
      });
      mockFindAll.mockResolvedValue([entry]);

      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByText('+447911123456')).toBeTruthy();
        expect(getByText('72 / 100')).toBeTruthy();
        expect(getByText('urgency language, impersonation')).toBeTruthy();
        expect(getByText('Guardian marked safe')).toBeTruthy();
      });
    });

    it('displays "None detected" when threatTypes is empty', async () => {
      const entry = makeEntry({ id: 'no-threats', threatTypes: [] });
      mockFindAll.mockResolvedValue([entry]);

      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByText('None detected')).toBeTruthy();
      });
    });

    it('displays all five outcome labels correctly', async () => {
      const entries: AuditLogEntry[] = [
        makeEntry({ id: 'o1', outcome: 'user_safe' }),
        makeEntry({ id: 'o2', outcome: 'user_help' }),
        makeEntry({ id: 'o3', outcome: 'guardian_safe' }),
        makeEntry({ id: 'o4', outcome: 'guardian_scam' }),
        makeEntry({ id: 'o5', outcome: 'pending' }),
      ];
      mockFindAll.mockResolvedValue(entries);

      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByText('User marked safe')).toBeTruthy();
        expect(getByText('User asked for help')).toBeTruthy();
        expect(getByText('Guardian marked safe')).toBeTruthy();
        expect(getByText('Guardian confirmed scam')).toBeTruthy();
        expect(getByText('Pending')).toBeTruthy();
      });
    });

    it('shows error message and retry button when findAll() rejects', async () => {
      mockFindAll.mockRejectedValue(new Error('DB error'));

      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByText('Could not load audit log. Please try again.')).toBeTruthy();
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('retry button calls findAll() again', async () => {
      mockFindAll.mockRejectedValueOnce(new Error('DB error'));
      mockFindAll.mockResolvedValueOnce([makeEntry()]);

      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });

      fireEvent.press(getByText('Retry'));

      await waitFor(() => {
        expect(mockFindAll).toHaveBeenCalledTimes(2);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 7.4 — CSV export
  // -------------------------------------------------------------------------

  describe('Requirement 7.4 — CSV export', () => {
    it('renders "Export CSV" button', async () => {
      mockFindAll.mockResolvedValue([makeEntry()]);
      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );
      await waitFor(() => {
        expect(getByText('Export CSV')).toBeTruthy();
      });
    });

    it('tapping "Export CSV" calls Share.share with CSV content', async () => {
      const entries = [
        makeEntry({ id: 'csv-1', sender: 'Alice', riskScore: 80 }),
        makeEntry({ id: 'csv-2', sender: 'Bob', riskScore: 45 }),
      ];
      mockFindAll.mockResolvedValue(entries);

      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByText('Export CSV')).toBeTruthy();
      });

      fireEvent.press(getByText('Export CSV'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalledTimes(1);
      });

      const shareArg = (Share.share as jest.Mock).mock.calls[0][0];
      expect(shareArg.title).toBe('ScamGuardian Audit Log');
      expect(shareArg.message).toContain('ID,Timestamp,Sender,Risk Score');
      expect(shareArg.message).toContain('Alice');
      expect(shareArg.message).toContain('Bob');
    });

    it('export button does not trigger Share when entries list is empty', async () => {
      mockFindAll.mockResolvedValue([]);
      const { getByLabelText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByLabelText('Export audit log as CSV')).toBeTruthy();
      });

      // Button is disabled when no entries — pressing it should not call Share
      fireEvent.press(getByLabelText('Export audit log as CSV'));
      expect(Share.share).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 7.4 — PDF export placeholder
  // -------------------------------------------------------------------------

  describe('Requirement 7.4 — PDF export placeholder', () => {
    it('renders "Export PDF" button', async () => {
      mockFindAll.mockResolvedValue([makeEntry()]);
      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );
      await waitFor(() => {
        expect(getByText('Export PDF')).toBeTruthy();
      });
    });

    it('tapping "Export PDF" calls Share.share with HTML content', async () => {
      const entries = [makeEntry({ id: 'pdf-1', sender: 'Charlie' })];
      mockFindAll.mockResolvedValue(entries);

      const { getByText } = render(
        <AuditLogScreen repository={mockRepository} />,
      );

      await waitFor(() => {
        expect(getByText('Export PDF')).toBeTruthy();
      });

      fireEvent.press(getByText('Export PDF'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalledTimes(1);
      });

      const shareArg = (Share.share as jest.Mock).mock.calls[0][0];
      expect(shareArg.title).toBe('ScamGuardian Audit Log (PDF placeholder)');
      expect(shareArg.message).toContain('<html>');
      expect(shareArg.message).toContain('Charlie');
    });
  });

  // -------------------------------------------------------------------------
  // CSV serialisation helper
  // -------------------------------------------------------------------------

  describe('entriesToCsv()', () => {
    it('generates a CSV header row', () => {
      const csv = entriesToCsv([]);
      expect(csv).toContain('ID,Timestamp,Sender,Risk Score,Threat Types,Outcome,Message Preview');
    });

    it('serialises a single entry to CSV', () => {
      const entry = makeEntry({
        id: 'csv-test-1',
        sender: 'Alice',
        riskScore: 85,
        threatTypes: ['phishing_url'],
        outcome: 'pending',
        messagePreview: 'Test message',
      });
      const csv = entriesToCsv([entry]);
      expect(csv).toContain('"csv-test-1"');
      expect(csv).toContain('"Alice"');
      expect(csv).toContain('"85"');
      expect(csv).toContain('"phishing_url"');
      expect(csv).toContain('"pending"');
      expect(csv).toContain('"Test message"');
    });

    it('escapes double quotes in CSV cells', () => {
      const entry = makeEntry({
        id: 'csv-escape',
        sender: 'Alice "The Scammer"',
        messagePreview: 'She said "click here"',
      });
      const csv = entriesToCsv([entry]);
      expect(csv).toContain('"Alice ""The Scammer"""');
      expect(csv).toContain('"She said ""click here"""');
    });

    it('serialises multiple threat types separated by semicolons', () => {
      const entry = makeEntry({
        id: 'multi-threat',
        threatTypes: ['urgency_language', 'impersonation', 'investment_scam'],
      });
      const csv = entriesToCsv([entry]);
      expect(csv).toContain('"urgency_language; impersonation; investment_scam"');
    });

    it('serialises timestamp as ISO 8601', () => {
      const entry = makeEntry({
        id: 'timestamp-test',
        timestamp: new Date('2024-06-20T14:30:00.000Z'),
      });
      const csv = entriesToCsv([entry]);
      expect(csv).toContain('"2024-06-20T14:30:00.000Z"');
    });
  });
});

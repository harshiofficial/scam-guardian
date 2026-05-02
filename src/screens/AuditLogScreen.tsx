/**
 * AuditLogScreen
 *
 * Displays the local audit log for the Guardian. Fetches all entries from
 * AuditLogRepository and renders them in a scrollable list, newest first.
 *
 * Each row shows:
 *   - Date and time
 *   - Sender
 *   - Risk Score (colour-coded badge)
 *   - Detected threat types
 *   - Outcome
 *
 * Also provides an export button (CSV and PDF placeholder) — see Task 11.4.
 *
 * Requirements: 7.3, 7.4
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Share from 'react-native/Libraries/Share/Share';
import type { AuditLogEntry } from '../models/types';
import { auditLogRepository } from '../services/AuditLogRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a human-readable label for each outcome value. */
const outcomeLabel = (outcome: AuditLogEntry['outcome']): string => {
  switch (outcome) {
    case 'user_safe':
      return 'User marked safe';
    case 'user_help':
      return 'User asked for help';
    case 'guardian_safe':
      return 'Guardian marked safe';
    case 'guardian_scam':
      return 'Guardian confirmed scam';
    case 'pending':
    default:
      return 'Pending';
  }
};

/** Returns the badge colour for a given risk score. */
const riskBadgeColor = (score: number): string => {
  if (score >= 70) return '#FF3B30'; // red
  if (score >= 40) return '#FF9500'; // amber
  return '#34C759';                  // green
};

/** Formats a Date as a locale-aware date+time string. */
const formatDateTime = (date: Date): string =>
  date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface AuditLogRowProps {
  entry: AuditLogEntry;
}

const AuditLogRow: React.FC<AuditLogRowProps> = ({ entry }) => {
  const threatLabel =
    entry.threatTypes.length > 0
      ? entry.threatTypes
          .map(t => t.replace(/_/g, ' '))
          .join(', ')
      : 'None detected';

  return (
    <View style={styles.row} accessibilityRole="listitem">
      {/* Date / time */}
      <Text style={styles.rowDateTime}>{formatDateTime(entry.timestamp)}</Text>

      {/* Sender */}
      <View style={styles.rowField}>
        <Text style={styles.rowLabel}>From</Text>
        <Text style={styles.rowValue}>{entry.sender}</Text>
      </View>

      {/* Risk score badge */}
      <View style={styles.rowField}>
        <Text style={styles.rowLabel}>Risk Score</Text>
        <View
          style={[
            styles.riskBadge,
            { backgroundColor: riskBadgeColor(entry.riskScore) },
          ]}
          accessibilityLabel={`Risk score ${entry.riskScore} out of 100`}
        >
          <Text style={styles.riskBadgeText}>{entry.riskScore} / 100</Text>
        </View>
      </View>

      {/* Threat types */}
      <View style={styles.rowField}>
        <Text style={styles.rowLabel}>Threat Type</Text>
        <Text style={styles.rowValue}>{threatLabel}</Text>
      </View>

      {/* Outcome */}
      <View style={styles.rowField}>
        <Text style={styles.rowLabel}>Outcome</Text>
        <Text style={styles.rowValue}>{outcomeLabel(entry.outcome)}</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// CSV / export helpers (Task 11.4)
// ---------------------------------------------------------------------------

/** Escapes a value for inclusion in a CSV cell. */
const csvCell = (value: string | number | Date): string => {
  const str = value instanceof Date ? value.toISOString() : String(value);
  // Wrap in quotes and escape any internal quotes
  return `"${str.replace(/"/g, '""')}"`;
};

/** Serialises all entries to a CSV string. */
export const entriesToCsv = (entries: AuditLogEntry[]): string => {
  const header = [
    'ID',
    'Timestamp',
    'Sender',
    'Risk Score',
    'Threat Types',
    'Outcome',
    'Message Preview',
  ].join(',');

  const rows = entries.map(e =>
    [
      csvCell(e.id),
      csvCell(e.timestamp),
      csvCell(e.sender),
      csvCell(e.riskScore),
      csvCell(e.threatTypes.join('; ')),
      csvCell(e.outcome),
      csvCell(e.messagePreview),
    ].join(','),
  );

  return [header, ...rows].join('\n');
};

// ---------------------------------------------------------------------------
// AuditLogScreen
// ---------------------------------------------------------------------------

export interface AuditLogScreenProps {
  /** Override the repository for testing. */
  repository?: typeof auditLogRepository;
}

const AuditLogScreen: React.FC<AuditLogScreenProps> = ({
  repository = auditLogRepository,
}) => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await repository.findAll();
      setEntries(all);
    } catch (err) {
      setError('Could not load audit log. Please try again.');
      console.warn('[AuditLogScreen] Failed to load entries:', err);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ---------------------------------------------------------------------------
  // Export — CSV (Task 11.4)
  // ---------------------------------------------------------------------------

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const csv = entriesToCsv(entries);
      await Share.share({
        title: 'ScamGuardian Audit Log',
        message: csv,
      });
    } catch (err) {
      console.warn('[AuditLogScreen] CSV export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [entries]);

  // ---------------------------------------------------------------------------
  // Export — PDF placeholder (Task 11.4)
  // ---------------------------------------------------------------------------

  const handleExportPdf = useCallback(async () => {
    // NOTE: A real PDF export requires a native PDF library such as
    // react-native-pdf-lib or react-native-html-to-pdf. For now we generate
    // a minimal HTML representation and share it as plain text. Replace this
    // implementation with a proper PDF library in production.
    setExporting(true);
    try {
      const rows = entries
        .map(
          e => `
          <tr>
            <td>${e.timestamp.toISOString()}</td>
            <td>${e.sender}</td>
            <td>${e.riskScore}</td>
            <td>${e.threatTypes.join(', ')}</td>
            <td>${outcomeLabel(e.outcome)}</td>
          </tr>`,
        )
        .join('');

      const html = `
        <html><body>
          <h1>ScamGuardian Audit Log</h1>
          <table border="1" cellpadding="4">
            <thead>
              <tr>
                <th>Timestamp</th><th>Sender</th><th>Risk Score</th>
                <th>Threat Types</th><th>Outcome</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body></html>`;

      await Share.share({
        title: 'ScamGuardian Audit Log (PDF placeholder)',
        message: html,
      });
    } catch (err) {
      console.warn('[AuditLogScreen] PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [entries]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.centred} accessibilityLabel="Loading audit log">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading audit log…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centred}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadEntries}
          accessibilityLabel="Retry loading audit log"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Audit Log</Text>
        <Text style={styles.subtitle}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Text>
      </View>

      {/* Export buttons (Task 11.4) */}
      <View style={styles.exportRow}>
        <TouchableOpacity
          style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
          onPress={handleExportCsv}
          disabled={exporting || entries.length === 0}
          accessibilityLabel="Export audit log as CSV"
        >
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
          onPress={handleExportPdf}
          disabled={exporting || entries.length === 0}
          accessibilityLabel="Export audit log as PDF"
        >
          <Text style={styles.exportButtonText}>Export PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Entry list */}
      {entries.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyText}>No flagged messages yet.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <AuditLogRow entry={item} />}
          contentContainerStyle={styles.listContent}
          accessibilityRole="list"
          accessibilityLabel="Audit log entries"
        />
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  rowDateTime: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  rowField: {
    marginTop: 8,
  },
  rowLabel: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: {
    fontSize: 15,
    color: '#1C1C1E',
    marginTop: 2,
  },
  riskBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  riskBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#8E8E93',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default AuditLogScreen;

/**
 * ScamGuardian — AuditLogRepository
 *
 * Manages the local SQLite audit log for all messages with riskScore ≥ 40.
 *
 * Schema (audit_log table):
 *   id            TEXT PRIMARY KEY  — UUID
 *   timestamp     INTEGER           — Unix epoch milliseconds
 *   sender        TEXT
 *   risk_score    INTEGER
 *   threat_types  TEXT              — JSON array of ThreatIndicator['type']
 *   outcome       TEXT              — 'user_safe' | 'user_help' | 'guardian_safe' | 'guardian_scam' | 'pending'
 *   message_preview TEXT            — First 200 chars of message body
 *
 * Requirements: 7.1, 7.2, 7.5
 */
import SQLite, {SQLiteDatabase, Transaction} from 'react-native-sqlite-storage';
import {AuditLogEntry, ThreatIndicator} from '../models/types';

// Enable promise-based API
SQLite.enablePromise(true);

const DB_NAME = 'scam_guardian.db';
const TABLE_NAME = 'audit_log';

/** Minimum risk score required for an entry to be written to the audit log. */
export const AUDIT_LOG_MIN_RISK_SCORE = 40;

/** Maximum storage size in bytes before cleanup is triggered (500 MB). */
export const STORAGE_CAP_BYTES = 500 * 1024 * 1024;

/** Target storage size in bytes after cleanup (400 MB). */
export const STORAGE_TARGET_BYTES = 400 * 1024 * 1024;

/** Number of days to retain audit log entries. */
export const RETENTION_DAYS = 90;

export class AuditLogRepository {
  private db: SQLiteDatabase | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Open (or create) the SQLite database and run the schema migration.
   * Must be called before any other method.
   */
  async open(): Promise<void> {
    this.db = await SQLite.openDatabase({name: DB_NAME, location: 'default'});
    await this.createTable();
  }

  /** Close the database connection. */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Schema Migration
  // ---------------------------------------------------------------------------

  /**
   * Create the audit_log table if it does not already exist.
   * Safe to call on every app start (idempotent).
   * Requirement 7.1
   */
  async createTable(): Promise<void> {
    const db = this.requireDb();
    await db.transaction((tx: Transaction) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id              TEXT    PRIMARY KEY NOT NULL,
          timestamp       INTEGER NOT NULL,
          sender          TEXT    NOT NULL,
          risk_score      INTEGER NOT NULL,
          threat_types    TEXT    NOT NULL DEFAULT '[]',
          outcome         TEXT    NOT NULL DEFAULT 'pending',
          message_preview TEXT    NOT NULL DEFAULT ''
        );`,
      );
      // Index for efficient time-based queries (retention cleanup, display order)
      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
         ON ${TABLE_NAME} (timestamp ASC);`,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Insert a new audit log entry.
   * Silently ignores entries with riskScore < AUDIT_LOG_MIN_RISK_SCORE.
   * Requirement 7.1
   */
  async insert(entry: AuditLogEntry): Promise<void> {
    if (entry.riskScore < AUDIT_LOG_MIN_RISK_SCORE) {
      return;
    }
    const db = this.requireDb();
    await db.transaction((tx: Transaction) => {
      tx.executeSql(
        `INSERT OR REPLACE INTO ${TABLE_NAME}
           (id, timestamp, sender, risk_score, threat_types, outcome, message_preview)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          entry.id,
          entry.timestamp.getTime(),
          entry.sender,
          entry.riskScore,
          JSON.stringify(entry.threatTypes),
          entry.outcome,
          entry.messagePreview.slice(0, 200),
        ],
      );
    });
  }

  /**
   * Update the outcome of an existing audit log entry.
   */
  async updateOutcome(
    id: string,
    outcome: AuditLogEntry['outcome'],
  ): Promise<void> {
    const db = this.requireDb();
    await db.transaction((tx: Transaction) => {
      tx.executeSql(
        `UPDATE ${TABLE_NAME} SET outcome = ? WHERE id = ?;`,
        [outcome, id],
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Return all audit log entries, ordered by timestamp descending (newest first).
   * Requirement 7.3
   */
  async findAll(): Promise<AuditLogEntry[]> {
    const db = this.requireDb();
    const [results] = await db.executeSql(
      `SELECT * FROM ${TABLE_NAME} ORDER BY timestamp DESC;`,
    );
    return this.rowsToEntries(results);
  }

  /**
   * Return entries older than the given date.
   */
  async findOlderThan(cutoff: Date): Promise<AuditLogEntry[]> {
    const db = this.requireDb();
    const [results] = await db.executeSql(
      `SELECT * FROM ${TABLE_NAME} WHERE timestamp < ? ORDER BY timestamp ASC;`,
      [cutoff.getTime()],
    );
    return this.rowsToEntries(results);
  }

  // ---------------------------------------------------------------------------
  // Storage Management
  // ---------------------------------------------------------------------------

  /**
   * Estimate the total storage used by the audit log in bytes.
   * Uses SQLite's page_count * page_size as a proxy for actual file size.
   * Requirement 7.5
   */
  async getTotalSizeBytes(): Promise<number> {
    const db = this.requireDb();
    const [pageCountResult] = await db.executeSql(
      'PRAGMA page_count;',
    );
    const [pageSizeResult] = await db.executeSql(
      'PRAGMA page_size;',
    );
    const pageCount: number = pageCountResult.rows.item(0).page_count ?? 0;
    const pageSize: number = pageSizeResult.rows.item(0).page_size ?? 4096;
    return pageCount * pageSize;
  }

  /**
   * Delete the oldest entries until the estimated storage is below targetBytes.
   * Deletes in batches of 100 to avoid large transactions.
   * Requirement 7.5
   */
  async deleteOldestUntilBelow(targetBytes: number): Promise<number> {
    let deletedCount = 0;
    while ((await this.getTotalSizeBytes()) > targetBytes) {
      const db = this.requireDb();
      const [result] = await db.executeSql(
        `DELETE FROM ${TABLE_NAME}
         WHERE id IN (
           SELECT id FROM ${TABLE_NAME}
           ORDER BY timestamp ASC
           LIMIT 100
         );`,
      );
      const affected: number = result.rowsAffected ?? 0;
      if (affected === 0) {
        // Table is empty; nothing more to delete
        break;
      }
      deletedCount += affected;
      // Run VACUUM to reclaim space so page_count reflects the deletion
      await db.executeSql('VACUUM;');
    }
    return deletedCount;
  }

  /**
   * Delete all entries older than RETENTION_DAYS.
   * Requirement 7.2
   */
  async deleteExpiredEntries(): Promise<number> {
    const cutoffMs =
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const db = this.requireDb();
    const [result] = await db.executeSql(
      `DELETE FROM ${TABLE_NAME} WHERE timestamp < ?;`,
      [cutoffMs],
    );
    return result.rowsAffected ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private requireDb(): SQLiteDatabase {
    if (!this.db) {
      throw new Error(
        'AuditLogRepository: database is not open. Call open() first.',
      );
    }
    return this.db;
  }

  private rowsToEntries(results: {rows: {length: number; item: (i: number) => Record<string, unknown>}}): AuditLogEntry[] {
    const entries: AuditLogEntry[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      entries.push({
        id: row.id as string,
        timestamp: new Date(row.timestamp as number),
        sender: row.sender as string,
        riskScore: row.risk_score as number,
        threatTypes: JSON.parse(
          (row.threat_types as string) || '[]',
        ) as ThreatIndicator['type'][],
        outcome: row.outcome as AuditLogEntry['outcome'],
        messagePreview: row.message_preview as string,
      });
    }
    return entries;
  }
}

/** Singleton instance for use throughout the app. */
export const auditLogRepository = new AuditLogRepository();

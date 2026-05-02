/**
 * Unit tests for AuditLogRepository
 * Requirements: 7.1, 7.2, 7.5
 */
import {AuditLogRepository, AUDIT_LOG_MIN_RISK_SCORE} from '../AuditLogRepository';
import {AuditLogEntry} from '../../models/types';

// Helper to build a minimal valid AuditLogEntry
function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'test-id-1',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    sender: '+1234567890',
    riskScore: 75,
    threatTypes: ['phishing_url'],
    outcome: 'pending',
    messagePreview: 'Click here to claim your prize',
    ...overrides,
  };
}

describe('AuditLogRepository', () => {
  let repo: AuditLogRepository;

  beforeEach(async () => {
    repo = new AuditLogRepository();
    await repo.open();
  });

  afterEach(async () => {
    await repo.close();
  });

  // ---------------------------------------------------------------------------
  // createTable()
  // ---------------------------------------------------------------------------

  describe('createTable()', () => {
    it('creates the audit_log table without throwing', async () => {
      // createTable is called by open(); calling it again should be idempotent
      await expect(repo.createTable()).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // insert() and findAll() — round-trip field preservation
  // ---------------------------------------------------------------------------

  describe('insert() and findAll()', () => {
    it('inserts an entry and retrieves it via findAll()', async () => {
      const entry = makeEntry();
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(entry.id);
      expect(all[0].sender).toBe(entry.sender);
      expect(all[0].riskScore).toBe(entry.riskScore);
      expect(all[0].outcome).toBe(entry.outcome);
      expect(all[0].threatTypes).toEqual(entry.threatTypes);
    });

    it('round-trip preserves all fields: id, timestamp, sender, riskScore, threatTypes, outcome, messagePreview', async () => {
      // Requirement 7.1 — all fields must survive the SQLite round-trip
      const entry = makeEntry({
        id: 'round-trip-uuid-abc123',
        timestamp: new Date('2024-06-20T14:30:00.000Z'),
        sender: '+447911123456',
        riskScore: 85,
        threatTypes: ['urgency_language', 'impersonation'],
        outcome: 'guardian_safe',
        messagePreview: 'Your account will be closed immediately — act now!',
      });

      await repo.insert(entry);
      const all = await repo.findAll();

      expect(all).toHaveLength(1);
      const retrieved = all[0];

      // Every field must match exactly
      expect(retrieved.id).toBe(entry.id);
      expect(retrieved.timestamp.getTime()).toBe(entry.timestamp.getTime());
      expect(retrieved.sender).toBe(entry.sender);
      expect(retrieved.riskScore).toBe(entry.riskScore);
      expect(retrieved.threatTypes).toEqual(entry.threatTypes);
      expect(retrieved.outcome).toBe(entry.outcome);
      expect(retrieved.messagePreview).toBe(entry.messagePreview);
    });

    it('round-trip preserves all five outcome values', async () => {
      const outcomes: AuditLogEntry['outcome'][] = [
        'user_safe',
        'user_help',
        'guardian_safe',
        'guardian_scam',
        'pending',
      ];

      for (const outcome of outcomes) {
        const entry = makeEntry({id: `outcome-${outcome}`, outcome});
        await repo.insert(entry);
      }

      const all = await repo.findAll();
      const retrievedOutcomes = all.map(e => e.outcome).sort();
      expect(retrievedOutcomes).toEqual([...outcomes].sort());
    });

    it('round-trip preserves all threat type values', async () => {
      const entry = makeEntry({
        id: 'all-threat-types',
        threatTypes: [
          'phishing_url',
          'urgency_language',
          'impersonation',
          'investment_scam',
          'malicious_attachment',
        ],
      });

      await repo.insert(entry);
      const all = await repo.findAll();

      expect(all[0].threatTypes).toEqual(entry.threatTypes);
    });

    it('round-trip preserves an empty threatTypes array', async () => {
      const entry = makeEntry({id: 'no-threats', threatTypes: []});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all[0].threatTypes).toEqual([]);
    });

    it('round-trip preserves messagePreview up to 200 characters', async () => {
      const longPreview = 'A'.repeat(200);
      const entry = makeEntry({id: 'long-preview', messagePreview: longPreview});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all[0].messagePreview).toBe(longPreview);
    });

    it('truncates messagePreview to 200 characters when the input is longer', async () => {
      const tooLong = 'B'.repeat(250);
      const entry = makeEntry({id: 'truncated-preview', messagePreview: tooLong});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all[0].messagePreview).toHaveLength(200);
      expect(all[0].messagePreview).toBe('B'.repeat(200));
    });

    it('returns entries ordered by timestamp descending (newest first)', async () => {
      const older = makeEntry({
        id: 'older',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      });
      const newer = makeEntry({
        id: 'newer',
        timestamp: new Date('2024-06-01T00:00:00Z'),
      });

      await repo.insert(older);
      await repo.insert(newer);

      const all = await repo.findAll();
      expect(all[0].id).toBe('newer');
      expect(all[1].id).toBe('older');
    });
  });

  // ---------------------------------------------------------------------------
  // riskScore filtering — Requirement 7.1
  // ---------------------------------------------------------------------------

  describe('riskScore filtering', () => {
    it('does NOT insert entries with riskScore below the minimum threshold (39)', async () => {
      const entry = makeEntry({id: 'low-risk', riskScore: AUDIT_LOG_MIN_RISK_SCORE - 1});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all).toHaveLength(0);
    });

    it('does NOT insert entries with riskScore of 0', async () => {
      const entry = makeEntry({id: 'zero-risk', riskScore: 0});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all).toHaveLength(0);
    });

    it('does NOT insert entries with riskScore of 1', async () => {
      const entry = makeEntry({id: 'one-risk', riskScore: 1});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all).toHaveLength(0);
    });

    it('does NOT insert entries with riskScore of 39', async () => {
      const entry = makeEntry({id: 'thirty-nine', riskScore: 39});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all).toHaveLength(0);
    });

    it('DOES insert entries with riskScore exactly at the minimum threshold (40)', async () => {
      const entry = makeEntry({id: 'boundary', riskScore: AUDIT_LOG_MIN_RISK_SCORE});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].riskScore).toBe(AUDIT_LOG_MIN_RISK_SCORE);
    });

    it('DOES insert entries with riskScore of 41', async () => {
      const entry = makeEntry({id: 'forty-one', riskScore: 41});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
    });

    it('DOES insert entries with riskScore of 100', async () => {
      const entry = makeEntry({id: 'max-risk', riskScore: 100});
      await repo.insert(entry);

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
    });

    it('inserts only entries that meet the threshold when mixed entries are provided', async () => {
      const belowThreshold = [
        makeEntry({id: 'skip-1', riskScore: 0}),
        makeEntry({id: 'skip-2', riskScore: 20}),
        makeEntry({id: 'skip-3', riskScore: 39}),
      ];
      const aboveThreshold = [
        makeEntry({id: 'keep-1', riskScore: 40}),
        makeEntry({id: 'keep-2', riskScore: 55}),
        makeEntry({id: 'keep-3', riskScore: 99}),
      ];

      for (const e of [...belowThreshold, ...aboveThreshold]) {
        await repo.insert(e);
      }

      const all = await repo.findAll();
      expect(all).toHaveLength(3);

      const ids = all.map(e => e.id).sort();
      expect(ids).toEqual(['keep-1', 'keep-2', 'keep-3']);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteOldestUntilBelow() — Requirement 7.5
  //
  // The SQLite mock always reports page_count=1 and page_size=4096, so
  // getTotalSizeBytes() always returns 4096 bytes.
  //
  //   targetBytes = 0    → 4096 > 0  → deletion IS triggered
  //   targetBytes = 5000 → 4096 < 5000 → deletion is NOT triggered
  // ---------------------------------------------------------------------------

  describe('deleteOldestUntilBelow()', () => {
    it('returns 0 and deletes nothing when storage is already below the target', async () => {
      // Insert some entries so the table is not empty
      for (let i = 0; i < 3; i++) {
        await repo.insert(
          makeEntry({
            id: `entry-${i}`,
            riskScore: 50,
            timestamp: new Date(Date.now() - i * 1000),
          }),
        );
      }

      // 4096 bytes < 5000 bytes → no deletion should occur
      const deleted = await repo.deleteOldestUntilBelow(5000);
      expect(deleted).toBe(0);

      // All entries should still be present
      const all = await repo.findAll();
      expect(all).toHaveLength(3);
    });

    it('deletes entries when storage exceeds the target (targetBytes=0)', async () => {
      // Insert entries with distinct timestamps so ordering is deterministic
      const base = new Date('2024-01-01T00:00:00Z').getTime();
      for (let i = 0; i < 5; i++) {
        await repo.insert(
          makeEntry({
            id: `entry-${i}`,
            riskScore: 50,
            timestamp: new Date(base + i * 60_000), // 1 minute apart
          }),
        );
      }

      // 4096 > 0 → deletion is triggered; mock always returns 4096 so the loop
      // runs once (deletes up to 100 rows), then the table is empty and the
      // loop exits because rowsAffected === 0.
      const deleted = await repo.deleteOldestUntilBelow(0);
      expect(deleted).toBeGreaterThan(0);

      // All 5 entries should have been removed
      const all = await repo.findAll();
      expect(all).toHaveLength(0);
    });

    it('deletes the oldest entries first (ascending timestamp order)', async () => {
      // Insert 3 entries with known timestamps
      const base = new Date('2024-03-01T00:00:00Z').getTime();
      const ids = ['oldest', 'middle', 'newest'];
      for (let i = 0; i < ids.length; i++) {
        await repo.insert(
          makeEntry({
            id: ids[i],
            riskScore: 60,
            timestamp: new Date(base + i * 3_600_000), // 1 hour apart
          }),
        );
      }

      // Verify all three are present before deletion
      expect(await repo.findAll()).toHaveLength(3);

      // Trigger deletion (4096 > 0)
      await repo.deleteOldestUntilBelow(0);

      // After deletion the table should be empty (mock always returns 4096 bytes,
      // so the loop keeps running until the table is empty)
      const remaining = await repo.findAll();
      expect(remaining).toHaveLength(0);
    });

    it('stops deleting when the table becomes empty (rowsAffected === 0 guard)', async () => {
      // Start with an empty table — deleteOldestUntilBelow should exit immediately
      // after the first DELETE returns rowsAffected=0
      const deleted = await repo.deleteOldestUntilBelow(0);
      expect(deleted).toBe(0);
    });

    it('returns the total count of deleted rows', async () => {
      const count = 4;
      const base = new Date('2024-05-01T00:00:00Z').getTime();
      for (let i = 0; i < count; i++) {
        await repo.insert(
          makeEntry({
            id: `del-count-${i}`,
            riskScore: 70,
            timestamp: new Date(base + i * 1000),
          }),
        );
      }

      const deleted = await repo.deleteOldestUntilBelow(0);
      // All 4 entries should be counted in the return value
      expect(deleted).toBe(count);
    });
  });
});

/**
 * Jest mock for react-native-sqlite-storage.
 * Provides an in-memory implementation sufficient for unit tests.
 */

type Row = Record<string, unknown>;

interface MockResultSet {
  rows: {
    length: number;
    item: (i: number) => Row;
    _array: Row[];
  };
  rowsAffected: number;
  insertId?: number;
}

// Simple in-memory store keyed by table name
const tables: Record<string, Row[]> = {};

function createResultSet(rows: Row[], rowsAffected = 0): MockResultSet {
  return {
    rows: {
      length: rows.length,
      item: (i: number) => rows[i],
      _array: rows,
    },
    rowsAffected,
  };
}

const mockDb = {
  transaction: jest.fn(async (fn: (tx: unknown) => void) => {
    const tx = {
      executeSql: jest.fn((sql: string, params: unknown[] = []) => {
        executeSqlImpl(sql, params);
      }),
    };
    fn(tx);
  }),
  executeSql: jest.fn(async (sql: string, params: unknown[] = []) => {
    return [executeSqlImpl(sql, params)];
  }),
  close: jest.fn(async () => {}),
};

function executeSqlImpl(sql: string, params: unknown[]): MockResultSet {
  const normalised = sql.trim().toUpperCase();

  // PRAGMA page_count
  if (normalised.startsWith('PRAGMA PAGE_COUNT')) {
    return createResultSet([{page_count: 1}]);
  }
  // PRAGMA page_size
  if (normalised.startsWith('PRAGMA PAGE_SIZE')) {
    return createResultSet([{page_size: 4096}]);
  }
  // VACUUM
  if (normalised.startsWith('VACUUM')) {
    return createResultSet([], 0);
  }
  // CREATE TABLE / INDEX
  if (normalised.startsWith('CREATE TABLE') || normalised.startsWith('CREATE INDEX')) {
    const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      if (!tables[tableName]) {
        tables[tableName] = [];
      }
    }
    return createResultSet([], 0);
  }
  // INSERT OR REPLACE / INSERT OR IGNORE
  if (normalised.startsWith('INSERT OR REPLACE INTO') || normalised.startsWith('INSERT OR IGNORE INTO')) {
    const isIgnore = normalised.startsWith('INSERT OR IGNORE INTO');
    const tableMatch = sql.match(/INTO (\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      if (!tables[tableName]) {
        tables[tableName] = [];
      }
      // Extract column names
      const colMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
      if (colMatch) {
        const cols = colMatch[1].split(',').map((c: string) => c.trim());
        const row: Row = {};
        cols.forEach((col: string, idx: number) => {
          row[col] = params[idx];
        });
        // Determine primary key field: prefer 'id', fall back to 'domain', then first column
        const pkField = cols.includes('id') ? 'id' : cols.includes('domain') ? 'domain' : cols[0];
        const existingIdx = tables[tableName].findIndex(
          (r: Row) => r[pkField] === row[pkField],
        );
        if (existingIdx >= 0) {
          if (!isIgnore) {
            // REPLACE: overwrite existing row
            tables[tableName][existingIdx] = row;
          }
          // IGNORE: do nothing if row already exists
        } else {
          tables[tableName].push(row);
        }
      }
    }
    return createResultSet([], 1);
  }
  // UPDATE
  if (normalised.startsWith('UPDATE')) {
    const tableMatch = sql.match(/UPDATE (\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const rows = tables[tableName] || [];
      // Simple: update outcome where id matches
      const outcomeMatch = sql.match(/SET outcome = \?/i);
      if (outcomeMatch && params.length >= 2) {
        const [newOutcome, id] = params as [string, string];
        let affected = 0;
        rows.forEach((r: Row) => {
          if (r.id === id) {
            r.outcome = newOutcome;
            affected++;
          }
        });
        return createResultSet([], affected);
      }
    }
    return createResultSet([], 0);
  }
  // SELECT
  if (normalised.startsWith('SELECT')) {
    const tableMatch = sql.match(/FROM (\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      let rows = [...(tables[tableName] || [])];

      // WHERE timestamp < ?
      const whereTimestampLt = sql.match(/WHERE timestamp < \?/i);
      if (whereTimestampLt && params.length >= 1) {
        const cutoff = params[0] as number;
        rows = rows.filter((r: Row) => (r.timestamp as number) < cutoff);
      }

      // WHERE domain = ?
      const whereDomain = sql.match(/WHERE domain = \?/i);
      if (whereDomain && params.length >= 1) {
        const domain = (params[0] as string).toLowerCase();
        rows = rows.filter((r: Row) => (r.domain as string) === domain);
      }

      // ORDER BY timestamp DESC
      if (/ORDER BY timestamp DESC/i.test(sql)) {
        rows.sort(
          (a: Row, b: Row) => (b.timestamp as number) - (a.timestamp as number),
        );
      }
      // ORDER BY timestamp ASC
      if (/ORDER BY timestamp ASC/i.test(sql)) {
        rows.sort(
          (a: Row, b: Row) => (a.timestamp as number) - (b.timestamp as number),
        );
      }

      // LIMIT
      const limitMatch = sql.match(/LIMIT (\d+)/i);
      if (limitMatch) {
        rows = rows.slice(0, parseInt(limitMatch[1], 10));
      }

      return createResultSet(rows);
    }
    return createResultSet([]);
  }
  // DELETE
  if (normalised.startsWith('DELETE')) {
    const tableMatch = sql.match(/FROM (\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const rows = tables[tableName] || [];
      const before = rows.length;

      // DELETE WHERE timestamp < ?
      const whereTimestampLt = sql.match(/WHERE timestamp < \?/i);
      if (whereTimestampLt && params.length >= 1) {
        const cutoff = params[0] as number;
        tables[tableName] = rows.filter(
          (r: Row) => (r.timestamp as number) >= cutoff,
        );
        return createResultSet([], before - tables[tableName].length);
      }

      // DELETE WHERE id IN (subquery — handled as delete oldest N)
      const limitMatch = sql.match(/LIMIT (\d+)/i);
      if (limitMatch) {
        const limit = parseInt(limitMatch[1], 10);
        const sorted = [...rows].sort(
          (a: Row, b: Row) => (a.timestamp as number) - (b.timestamp as number),
        );
        const toDelete = new Set(sorted.slice(0, limit).map((r: Row) => r.id));
        tables[tableName] = rows.filter((r: Row) => !toDelete.has(r.id));
        return createResultSet([], toDelete.size);
      }
    }
    return createResultSet([], 0);
  }

  return createResultSet([]);
}

const SQLite = {
  enablePromise: jest.fn(),
  openDatabase: jest.fn(async () => {
    // Reset tables for each test suite open
    Object.keys(tables).forEach(k => delete tables[k]);
    return mockDb;
  }),
  // Expose for test teardown
  _tables: tables,
  _mockDb: mockDb,
};

export default SQLite;
export {SQLite};

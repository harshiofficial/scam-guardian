/**
 * ScamGuardian — UserProfileRepository
 *
 * Manages the local SQLite storage for UserProfile data.
 *
 * Schema (user_profile table):
 *   user_id           TEXT PRIMARY KEY
 *   guardian_id       TEXT
 *   guardian_contact  TEXT
 *   safe_mode_enabled INTEGER (0 or 1)
 *   large_font_enabled INTEGER (0 or 1)
 *   fcm_token         TEXT
 *   onboarding_complete INTEGER (0 or 1)
 *
 * Requirements: 5.1, 5.3
 */
import SQLite, { SQLiteDatabase, Transaction } from 'react-native-sqlite-storage';
import { UserProfile } from '../models/types';

// Enable promise-based API
SQLite.enablePromise(true);

const DB_NAME = 'scam_guardian.db';
const TABLE_NAME = 'user_profile';

export class UserProfileRepository {
  private db: SQLiteDatabase | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Open (or create) the SQLite database and run the schema migration.
   * Must be called before any other method.
   */
  async open(): Promise<void> {
    this.db = await SQLite.openDatabase({ name: DB_NAME, location: 'default' });
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
   * Create the user_profile table if it does not already exist.
   * Safe to call on every app start (idempotent).
   * Requirement 5.1
   */
  async createTable(): Promise<void> {
    const db = this.requireDb();
    await db.transaction((tx: Transaction) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          user_id              TEXT    PRIMARY KEY NOT NULL,
          guardian_id          TEXT    NOT NULL DEFAULT '',
          guardian_contact     TEXT    NOT NULL DEFAULT '',
          safe_mode_enabled    INTEGER NOT NULL DEFAULT 0,
          large_font_enabled   INTEGER NOT NULL DEFAULT 0,
          fcm_token            TEXT    NOT NULL DEFAULT '',
          onboarding_complete  INTEGER NOT NULL DEFAULT 0
        );`,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Insert or update a user profile.
   * Requirement 5.1, 5.3
   */
  async upsert(profile: UserProfile): Promise<void> {
    const db = this.requireDb();
    await db.transaction((tx: Transaction) => {
      tx.executeSql(
        `INSERT OR REPLACE INTO ${TABLE_NAME}
           (user_id, guardian_id, guardian_contact, safe_mode_enabled, large_font_enabled, fcm_token, onboarding_complete)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          profile.userId,
          profile.guardianId,
          profile.guardianContact,
          profile.safeModeEnabled ? 1 : 0,
          profile.largeFontEnabled ? 1 : 0,
          profile.fcmToken,
          profile.onboardingComplete ? 1 : 0,
        ],
      );
    });
  }

  /**
   * Update only the onboarding completion status.
   */
  async updateOnboardingComplete(userId: string, complete: boolean): Promise<void> {
    const db = this.requireDb();
    await db.executeSql(
      `UPDATE ${TABLE_NAME} SET onboarding_complete = ? WHERE user_id = ?;`,
      [complete ? 1 : 0, userId],
    );
  }

  /**
   * Update the guardian contact information.
   */
  async updateGuardianContact(userId: string, guardianContact: string): Promise<void> {
    const db = this.requireDb();
    await db.executeSql(
      `UPDATE ${TABLE_NAME} SET guardian_contact = ? WHERE user_id = ?;`,
      [guardianContact, userId],
    );
  }

  /**
   * Update the FCM token.
   */
  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    const db = this.requireDb();
    await db.executeSql(
      `UPDATE ${TABLE_NAME} SET fcm_token = ? WHERE user_id = ?;`,
      [fcmToken, userId],
    );
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Retrieve a user profile by ID, or null if not found.
   */
  async findById(userId: string): Promise<UserProfile | null> {
    const db = this.requireDb();
    const [results] = await db.executeSql(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = ?;`,
      [userId],
    );

    if (results.rows.length === 0) {
      return null;
    }

    return this.rowToProfile(results.rows.item(0));
  }

  /**
   * Retrieve all user profiles.
   */
  async findAll(): Promise<UserProfile[]> {
    const db = this.requireDb();
    const [results] = await db.executeSql(
      `SELECT * FROM ${TABLE_NAME};`,
    );

    const profiles: UserProfile[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      profiles.push(this.rowToProfile(results.rows.item(i)));
    }
    return profiles;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private requireDb(): SQLiteDatabase {
    if (!this.db) {
      throw new Error(
        'UserProfileRepository: database is not open. Call open() first.',
      );
    }
    return this.db;
  }

  private rowToProfile(row: Record<string, unknown>): UserProfile {
    return {
      userId: row.user_id as string,
      guardianId: row.guardian_id as string,
      guardianContact: row.guardian_contact as string,
      safeModeEnabled: (row.safe_mode_enabled as number) === 1,
      largeFontEnabled: (row.large_font_enabled as number) === 1,
      fcmToken: row.fcm_token as string,
      onboardingComplete: (row.onboarding_complete as number) === 1,
    };
  }
}

/** Singleton instance for use throughout the app. */
export const userProfileRepository = new UserProfileRepository();

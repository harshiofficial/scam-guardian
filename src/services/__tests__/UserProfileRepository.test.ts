/**
 * Tests for UserProfileRepository
 *
 * Requirements: 5.1, 5.3
 */

import { UserProfileRepository } from '../UserProfileRepository';
import type { UserProfile } from '../../models/types';

describe('UserProfileRepository', () => {
  let repo: UserProfileRepository;

  beforeEach(async () => {
    repo = new UserProfileRepository();
    await repo.open();
  });

  afterEach(async () => {
    await repo.close();
  });

  describe('upsert and findById', () => {
    it('should insert and retrieve a user profile', async () => {
      const profile: UserProfile = {
        userId: 'user-123',
        guardianId: 'guardian-456',
        guardianContact: '+1234567890',
        safeModeEnabled: false,
        largeFontEnabled: false,
        fcmToken: 'fcm-token-abc',
        onboardingComplete: false,
      };

      await repo.upsert(profile);
      const retrieved = await repo.findById('user-123');

      expect(retrieved).toEqual(profile);
    });

    it('should update an existing profile', async () => {
      const profile: UserProfile = {
        userId: 'user-123',
        guardianId: 'guardian-456',
        guardianContact: '+1234567890',
        safeModeEnabled: false,
        largeFontEnabled: false,
        fcmToken: 'fcm-token-abc',
        onboardingComplete: false,
      };

      await repo.upsert(profile);

      const updated: UserProfile = {
        ...profile,
        guardianContact: 'guardian@example.com',
        onboardingComplete: true,
      };

      await repo.upsert(updated);
      const retrieved = await repo.findById('user-123');

      expect(retrieved).toEqual(updated);
    });

    it('should return null for non-existent profile', async () => {
      const retrieved = await repo.findById('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateOnboardingComplete', () => {
    it('should update onboarding completion status via upsert', async () => {
      const profile: UserProfile = {
        userId: 'user-123',
        guardianId: 'guardian-456',
        guardianContact: '+1234567890',
        safeModeEnabled: false,
        largeFontEnabled: false,
        fcmToken: 'fcm-token-abc',
        onboardingComplete: false,
      };

      await repo.upsert(profile);
      
      // Verify initial state
      let retrieved = await repo.findById('user-123');
      expect(retrieved?.onboardingComplete).toBe(false);
      
      // Update via upsert and verify
      const updated = { ...profile, onboardingComplete: true };
      await repo.upsert(updated);
      retrieved = await repo.findById('user-123');
      expect(retrieved?.onboardingComplete).toBe(true);
    });
  });

  describe('updateGuardianContact', () => {
    it('should update guardian contact via upsert', async () => {
      const profile: UserProfile = {
        userId: 'user-123',
        guardianId: 'guardian-456',
        guardianContact: '+1234567890',
        safeModeEnabled: false,
        largeFontEnabled: false,
        fcmToken: 'fcm-token-abc',
        onboardingComplete: false,
      };

      await repo.upsert(profile);
      
      // Verify initial state
      let retrieved = await repo.findById('user-123');
      expect(retrieved?.guardianContact).toBe('+1234567890');
      
      // Update via upsert and verify
      const updated = { ...profile, guardianContact: 'guardian@example.com' };
      await repo.upsert(updated);
      retrieved = await repo.findById('user-123');
      expect(retrieved?.guardianContact).toBe('guardian@example.com');
    });
  });

  describe('updateFcmToken', () => {
    it('should update FCM token via upsert', async () => {
      const profile: UserProfile = {
        userId: 'user-123',
        guardianId: 'guardian-456',
        guardianContact: '+1234567890',
        safeModeEnabled: false,
        largeFontEnabled: false,
        fcmToken: 'old-token',
        onboardingComplete: false,
      };

      await repo.upsert(profile);
      
      // Verify initial state
      let retrieved = await repo.findById('user-123');
      expect(retrieved?.fcmToken).toBe('old-token');
      
      // Update via upsert and verify
      const updated = { ...profile, fcmToken: 'new-token' };
      await repo.upsert(updated);
      retrieved = await repo.findById('user-123');
      expect(retrieved?.fcmToken).toBe('new-token');
    });
  });

  describe('findAll', () => {
    it('should retrieve all profiles', async () => {
      const profile1: UserProfile = {
        userId: 'user-1',
        guardianId: 'guardian-1',
        guardianContact: '+1111111111',
        safeModeEnabled: false,
        largeFontEnabled: false,
        fcmToken: 'token-1',
        onboardingComplete: false,
      };

      const profile2: UserProfile = {
        userId: 'user-2',
        guardianId: 'guardian-2',
        guardianContact: '+2222222222',
        safeModeEnabled: true,
        largeFontEnabled: true,
        fcmToken: 'token-2',
        onboardingComplete: true,
      };

      await repo.upsert(profile1);
      await repo.upsert(profile2);

      const all = await repo.findAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(profile1);
      expect(all).toContainEqual(profile2);
    });

    it('should return empty array when no profiles exist', async () => {
      const all = await repo.findAll();
      expect(all).toEqual([]);
    });
  });

  describe('boolean field persistence', () => {
    it('should correctly persist and retrieve boolean flags', async () => {
      const profile: UserProfile = {
        userId: 'user-123',
        guardianId: 'guardian-456',
        guardianContact: '+1234567890',
        safeModeEnabled: true,
        largeFontEnabled: true,
        fcmToken: 'fcm-token-abc',
        onboardingComplete: true,
      };

      await repo.upsert(profile);
      const retrieved = await repo.findById('user-123');

      expect(retrieved?.safeModeEnabled).toBe(true);
      expect(retrieved?.largeFontEnabled).toBe(true);
      expect(retrieved?.onboardingComplete).toBe(true);
    });

    it('should correctly persist false boolean values', async () => {
      const profile: UserProfile = {
        userId: 'user-123',
        guardianId: 'guardian-456',
        guardianContact: '+1234567890',
        safeModeEnabled: false,
        largeFontEnabled: false,
        fcmToken: 'fcm-token-abc',
        onboardingComplete: false,
      };

      await repo.upsert(profile);
      const retrieved = await repo.findById('user-123');

      expect(retrieved?.safeModeEnabled).toBe(false);
      expect(retrieved?.largeFontEnabled).toBe(false);
      expect(retrieved?.onboardingComplete).toBe(false);
    });
  });
});

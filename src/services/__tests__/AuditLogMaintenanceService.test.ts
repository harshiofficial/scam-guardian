/**
 * Unit tests for AuditLogMaintenanceService
 * Requirements: 7.2, 7.5
 */

import { AppState } from 'react-native';
import { AuditLogMaintenanceServiceClass } from '../AuditLogMaintenanceService';
import * as AuditLogRepositoryModule from '../AuditLogRepository';
import {
  STORAGE_CAP_BYTES,
  STORAGE_TARGET_BYTES,
} from '../AuditLogRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(notifyFn?: jest.Mock) {
  return new AuditLogMaintenanceServiceClass(notifyFn);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogMaintenanceService', () => {
  let deleteExpiredSpy: jest.SpyInstance;
  let getTotalSizeSpy: jest.SpyInstance;
  let deleteOldestSpy: jest.SpyInstance;
  let notifyMock: jest.Mock;

  beforeEach(() => {
    deleteExpiredSpy = jest
      .spyOn(AuditLogRepositoryModule.auditLogRepository, 'deleteExpiredEntries')
      .mockResolvedValue(0);

    getTotalSizeSpy = jest
      .spyOn(AuditLogRepositoryModule.auditLogRepository, 'getTotalSizeBytes')
      .mockResolvedValue(0);

    deleteOldestSpy = jest
      .spyOn(AuditLogRepositoryModule.auditLogRepository, 'deleteOldestUntilBelow')
      .mockResolvedValue(0);

    notifyMock = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // runMaintenance()
  // -------------------------------------------------------------------------

  describe('runMaintenance()', () => {
    it('calls deleteExpiredEntries() on every run (Requirement 7.2)', async () => {
      const service = makeService(notifyMock);
      await service.runMaintenance();
      expect(deleteExpiredSpy).toHaveBeenCalledTimes(1);
    });

    it('calls getTotalSizeBytes() on every run', async () => {
      const service = makeService(notifyMock);
      await service.runMaintenance();
      expect(getTotalSizeSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT call deleteOldestUntilBelow() when storage is within cap', async () => {
      getTotalSizeSpy.mockResolvedValue(STORAGE_CAP_BYTES - 1);
      const service = makeService(notifyMock);
      await service.runMaintenance();
      expect(deleteOldestSpy).not.toHaveBeenCalled();
    });

    it('calls deleteOldestUntilBelow(STORAGE_TARGET_BYTES) when storage exceeds cap (Requirement 7.5)', async () => {
      getTotalSizeSpy.mockResolvedValue(STORAGE_CAP_BYTES + 1);
      deleteOldestSpy.mockResolvedValue(10);
      const service = makeService(notifyMock);
      await service.runMaintenance();
      expect(deleteOldestSpy).toHaveBeenCalledWith(STORAGE_TARGET_BYTES);
    });

    it('does NOT send notification when no entries were deleted', async () => {
      getTotalSizeSpy.mockResolvedValue(STORAGE_CAP_BYTES + 1);
      deleteOldestSpy.mockResolvedValue(0);
      const service = makeService(notifyMock);
      await service.runMaintenance();
      expect(notifyMock).not.toHaveBeenCalled();
    });

    it('sends notification after storage cap deletion when entries were deleted (Requirement 7.5)', async () => {
      getTotalSizeSpy.mockResolvedValue(STORAGE_CAP_BYTES + 1);
      deleteOldestSpy.mockResolvedValue(5);
      const service = makeService(notifyMock);
      await service.runMaintenance();
      expect(notifyMock).toHaveBeenCalledTimes(1);
    });

    it('does not throw when deleteExpiredEntries() rejects', async () => {
      deleteExpiredSpy.mockRejectedValue(new Error('DB error'));
      const service = makeService(notifyMock);
      await expect(service.runMaintenance()).resolves.not.toThrow();
    });

    it('does not throw when getTotalSizeBytes() rejects', async () => {
      getTotalSizeSpy.mockRejectedValue(new Error('DB error'));
      const service = makeService(notifyMock);
      await expect(service.runMaintenance()).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // startMaintenanceOnForeground()
  // -------------------------------------------------------------------------

  describe('startMaintenanceOnForeground()', () => {
    it('returns an unsubscribe function', () => {
      const service = makeService(notifyMock);
      const stop = service.startMaintenanceOnForeground();
      expect(typeof stop).toBe('function');
      stop();
    });

    it('calls runMaintenance() when AppState transitions to "active"', async () => {
      const service = makeService(notifyMock);

      // Capture the listener registered with AppState — spy BEFORE calling start
      const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');

      const stop = service.startMaintenanceOnForeground();

      // Verify the listener was registered
      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));

      // Directly invoke the registered handler with 'active'
      const registeredHandler = addEventListenerSpy.mock.calls[0][1] as (
        state: string,
      ) => void;
      registeredHandler('active');

      // Allow the async call to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify that maintenance ran (deleteExpiredEntries is called by runMaintenance)
      expect(deleteExpiredSpy).toHaveBeenCalledTimes(1);
      stop();
    });

    it('does NOT call runMaintenance() for non-active AppState transitions', async () => {
      const service = makeService(notifyMock);

      const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');
      const runMaintenanceSpy = jest
        .spyOn(service, 'runMaintenance')
        .mockResolvedValue(undefined);

      const stop = service.startMaintenanceOnForeground();

      const handler = addEventListenerSpy.mock.calls[0][1] as (
        state: string,
      ) => void;
      handler('background');
      handler('inactive');

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(runMaintenanceSpy).not.toHaveBeenCalled();
      stop();
    });

    it('removes the AppState listener when the returned function is called', () => {
      const service = makeService(notifyMock);
      const mockRemove = jest.fn();
      jest.spyOn(AppState, 'addEventListener').mockReturnValue({
        remove: mockRemove,
      } as ReturnType<typeof AppState.addEventListener>);

      const stop = service.startMaintenanceOnForeground();
      stop();

      expect(mockRemove).toHaveBeenCalledTimes(1);
    });
  });
});

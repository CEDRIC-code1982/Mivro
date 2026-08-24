/**
 * @file TrackParticipantsUseCase.test.ts
 * @description Tests unitaires du use case TrackParticipantsUseCase (F4).
 *              Unit tests for the TrackParticipantsUseCase (F4).
 *
 * @module services/domain/realtime/TrackParticipantsUseCase.test
 */

// [ADDED] F4 — Tests unitaires TrackParticipantsUseCase
import { mock } from 'jest-mock-extended';
import type { RealtimeLocationUpdate, RealtimeParticipant } from '@entities/RealtimeParticipant';
import { RealtimeError } from '@services/domain/realtime/IRealtimeService';
import type { IRealtimeService } from '@services/domain/realtime/IRealtimeService';
import { TrackParticipantsUseCase } from '@services/domain/realtime/TrackParticipantsUseCase';

const SESSION_ID = 'session-001';
const PARTICIPANT_ID = '550e8400-e29b-41d4-a716-446655440000';

const validLocation: RealtimeLocationUpdate = {
  latitude: 48.8566,
  longitude: 2.3522,
  speed: 10,
  heading: 90,
};

describe('TrackParticipantsUseCase', () => {
  // ─── subscribe ────────────────────────────────────────────
  describe('subscribe', () => {
    it('delegates to realtimeService.subscribeToSession', () => {
      const service = mock<IRealtimeService>();
      const unsubscribe = jest.fn();
      service.subscribeToSession.mockReturnValue(unsubscribe);
      const useCase = new TrackParticipantsUseCase(service);
      const onUpdate = jest.fn();

      const result = useCase.subscribe(SESSION_ID, onUpdate);

      expect(service.subscribeToSession).toHaveBeenCalledWith(SESSION_ID, onUpdate);
      expect(result).toBe(unsubscribe);
    });

    it('propagates the unsubscribe function from the service', () => {
      const service = mock<IRealtimeService>();
      const unsubscribe = jest.fn();
      service.subscribeToSession.mockReturnValue(unsubscribe);
      const useCase = new TrackParticipantsUseCase(service);

      const result = useCase.subscribe(SESSION_ID, jest.fn());
      result();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('forwards participants to the handler (onUpdate path)', () => {
      const service = mock<IRealtimeService>();
      const participants: RealtimeParticipant[] = [
        {
          participantId: PARTICIPANT_ID,
          latitude: 48.8,
          longitude: 2.3,
          updatedAt: 1,
          speed: 5,
          heading: 0,
          isOnline: true,
        },
      ];
      service.subscribeToSession.mockImplementation((_id, handler) => {
        handler(participants);
        return jest.fn();
      });
      const useCase = new TrackParticipantsUseCase(service);
      const onUpdate = jest.fn();

      useCase.subscribe(SESSION_ID, onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(participants);
    });

    it('throws RealtimeError when sessionId is empty', () => {
      const service = mock<IRealtimeService>();
      const useCase = new TrackParticipantsUseCase(service);

      expect(() => useCase.subscribe('   ', jest.fn())).toThrow(RealtimeError);
      expect(service.subscribeToSession).not.toHaveBeenCalled();
    });
  });

  // ─── publish ──────────────────────────────────────────────
  describe('publish', () => {
    it('delegates to realtimeService.publishLocation with validated data', async () => {
      const service = mock<IRealtimeService>();
      service.publishLocation.mockResolvedValue(undefined);
      const useCase = new TrackParticipantsUseCase(service);

      await useCase.publish(SESSION_ID, PARTICIPANT_ID, validLocation);

      expect(service.publishLocation).toHaveBeenCalledWith(
        SESSION_ID,
        PARTICIPANT_ID,
        validLocation,
      );
    });

    it('throws invalid_data when location fails Zod validation', async () => {
      const service = mock<IRealtimeService>();
      const useCase = new TrackParticipantsUseCase(service);
      // latitude hors bornes
      const bad = { ...validLocation, latitude: 200 };

      await expect(useCase.publish(SESSION_ID, PARTICIPANT_ID, bad)).rejects.toMatchObject({
        code: 'invalid_data',
      });
      expect(service.publishLocation).not.toHaveBeenCalled();
    });

    it('throws when sessionId is empty', async () => {
      const service = mock<IRealtimeService>();
      const useCase = new TrackParticipantsUseCase(service);

      await expect(useCase.publish('', PARTICIPANT_ID, validLocation)).rejects.toBeInstanceOf(
        RealtimeError,
      );
    });

    it('throws when participantId is empty', async () => {
      const service = mock<IRealtimeService>();
      const useCase = new TrackParticipantsUseCase(service);

      await expect(useCase.publish(SESSION_ID, '  ', validLocation)).rejects.toBeInstanceOf(
        RealtimeError,
      );
    });

    it('propagates RealtimeError from the service', async () => {
      const service = mock<IRealtimeService>();
      service.publishLocation.mockRejectedValue(new RealtimeError('net', 'network'));
      const useCase = new TrackParticipantsUseCase(service);

      await expect(
        useCase.publish(SESSION_ID, PARTICIPANT_ID, validLocation),
      ).rejects.toMatchObject({ code: 'network' });
    });
  });

  // ─── leave ────────────────────────────────────────────────
  describe('leave', () => {
    it('delegates to realtimeService.leaveSession', async () => {
      const service = mock<IRealtimeService>();
      service.leaveSession.mockResolvedValue(undefined);
      const useCase = new TrackParticipantsUseCase(service);

      await useCase.leave(SESSION_ID, PARTICIPANT_ID);

      expect(service.leaveSession).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID);
    });

    it('throws when sessionId is empty', async () => {
      const service = mock<IRealtimeService>();
      const useCase = new TrackParticipantsUseCase(service);

      await expect(useCase.leave('', PARTICIPANT_ID)).rejects.toBeInstanceOf(RealtimeError);
      expect(service.leaveSession).not.toHaveBeenCalled();
    });

    it('throws when participantId is empty', async () => {
      const service = mock<IRealtimeService>();
      const useCase = new TrackParticipantsUseCase(service);

      await expect(useCase.leave(SESSION_ID, '')).rejects.toBeInstanceOf(RealtimeError);
    });

    it('propagates RealtimeError from the service', async () => {
      const service = mock<IRealtimeService>();
      service.leaveSession.mockRejectedValue(new RealtimeError('denied', 'permission_denied'));
      const useCase = new TrackParticipantsUseCase(service);

      await expect(useCase.leave(SESSION_ID, PARTICIPANT_ID)).rejects.toMatchObject({
        code: 'permission_denied',
      });
    });
  });
});

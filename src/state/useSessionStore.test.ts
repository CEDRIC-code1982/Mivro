/**
 * @file useSessionStore.test.ts
 * @description Tests unitaires du store useSessionStore.
 *              Unit tests for the useSessionStore.
 *
 * @module state/useSessionStore.test
 */

// [ADDED] Tests unitaires useSessionStore

// Mock uuid pour des résultats déterministes
let mockUuidCounter = 0;

jest.mock('uuid', () => ({
  v4: () => {
    mockUuidCounter++;
    return `550e8400-e29b-41d4-a716-44665544000${String(mockUuidCounter)}`;
  },
}));

import type { Location } from '@entities/Location';
import type { Participant } from '@entities/MidpointSession';
import { useSessionStore } from '@state/useSessionStore';

const makeLocation = (lat: number, lng: number): Location => ({
  id: '550e8400-e29b-41d4-a716-446655440099',
  coordinates: { latitude: lat, longitude: lng },
  formattedAddress: `${String(lat)}, ${String(lng)}`,
});

const makeParticipantData = (name: string): Omit<Participant, 'id'> => ({
  displayName: name,
  startLocation: makeLocation(48.8566, 2.3522),
});

describe('useSessionStore', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    useSessionStore.setState({ session: null });
  });

  // ─── Initial state ────────────────────────────────────────
  describe('initial state', () => {
    it('has session set to null', () => {
      expect(useSessionStore.getState().session).toBeNull();
    });
  });

  // ─── createSession ────────────────────────────────────────
  describe('createSession', () => {
    it('creates a session with draft status', () => {
      useSessionStore.getState().createSession();

      const session = useSessionStore.getState().session;
      expect(session).not.toBeNull();
      expect(session?.status).toBe('draft');
    });

    it('creates a session with empty participants', () => {
      useSessionStore.getState().createSession();

      expect(useSessionStore.getState().session?.participants).toEqual([]);
    });

    it('creates a session with valid UUID', () => {
      useSessionStore.getState().createSession();

      expect(useSessionStore.getState().session?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12,}$/i,
      );
    });

    it('creates a session with createdAt and updatedAt set', () => {
      useSessionStore.getState().createSession();

      const session = useSessionStore.getState().session;
      expect(session?.createdAt).toBeTruthy();
      expect(session?.updatedAt).toBeTruthy();
      expect(session?.createdAt).toBe(session?.updatedAt);
    });
  });

  // ─── addParticipant ───────────────────────────────────────
  describe('addParticipant', () => {
    it('adds a participant with a generated UUID', () => {
      useSessionStore.getState().createSession();
      useSessionStore.getState().addParticipant(makeParticipantData('Alice'));

      const participants = useSessionStore.getState().session?.participants ?? [];
      expect(participants).toHaveLength(1);
      expect(participants[0]?.displayName).toBe('Alice');
      expect(participants[0]?.id).toBeTruthy();
    });

    it('does nothing if no session exists', () => {
      useSessionStore.getState().addParticipant(makeParticipantData('Alice'));

      expect(useSessionStore.getState().session).toBeNull();
    });

    it('refuses to add more than 5 participants', () => {
      useSessionStore.getState().createSession();

      // Ajouter 5 participants
      for (let i = 0; i < 5; i++) {
        useSessionStore.getState().addParticipant(makeParticipantData(`P${String(i)}`));
      }

      expect(useSessionStore.getState().session?.participants).toHaveLength(5);

      // Le 6ème est refusé
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      useSessionStore.getState().addParticipant(makeParticipantData('P5'));

      expect(useSessionStore.getState().session?.participants).toHaveLength(5);
      warnSpy.mockRestore();
    });

    it('updates updatedAt when adding a participant', () => {
      useSessionStore.getState().createSession();
      const createdAt = useSessionStore.getState().session?.createdAt;

      useSessionStore.getState().addParticipant(makeParticipantData('Alice'));

      const updatedAt = useSessionStore.getState().session?.updatedAt;
      expect(updatedAt).toBeTruthy();
      // updatedAt devrait être >= createdAt
      // Les deux valeurs sont définies car la session vient d'être créée + participant ajouté
      expect(updatedAt ?? '').not.toBe('');
      expect(createdAt ?? '').not.toBe('');
      expect((updatedAt ?? '') >= (createdAt ?? '')).toBe(true);
    });
  });

  // ─── removeParticipant ────────────────────────────────────
  describe('removeParticipant', () => {
    it('removes the correct participant by id', () => {
      useSessionStore.getState().createSession();
      useSessionStore.getState().addParticipant(makeParticipantData('Alice'));
      useSessionStore.getState().addParticipant(makeParticipantData('Bob'));

      const participants = useSessionStore.getState().session?.participants ?? [];
      const aliceId = participants[0]?.id ?? '';

      useSessionStore.getState().removeParticipant(aliceId);

      const remaining = useSessionStore.getState().session?.participants ?? [];
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.displayName).toBe('Bob');
    });

    it('does nothing if no session exists', () => {
      useSessionStore.getState().removeParticipant('some-id');

      expect(useSessionStore.getState().session).toBeNull();
    });
  });

  // ─── setMidpoint ──────────────────────────────────────────
  describe('setMidpoint', () => {
    it('sets midpoint and transitions status to computed', () => {
      useSessionStore.getState().createSession();

      useSessionStore.getState().setMidpoint({ latitude: 48.85, longitude: 2.35 }, 500);

      const session = useSessionStore.getState().session;
      expect(session?.midpoint).toEqual({
        latitude: 48.85,
        longitude: 2.35,
      });
      expect(session?.midpointRadius).toBe(500);
      expect(session?.status).toBe('computed');
    });

    it('does nothing if no session exists', () => {
      useSessionStore.getState().setMidpoint({ latitude: 48.85, longitude: 2.35 }, 500);

      expect(useSessionStore.getState().session).toBeNull();
    });
  });

  // ─── setStatus ────────────────────────────────────────────
  describe('setStatus', () => {
    it('changes the session status', () => {
      useSessionStore.getState().createSession();

      useSessionStore.getState().setStatus('active');

      expect(useSessionStore.getState().session?.status).toBe('active');
    });
  });

  // ─── resetSession ─────────────────────────────────────────
  describe('resetSession', () => {
    it('resets session to null', () => {
      useSessionStore.getState().createSession();
      expect(useSessionStore.getState().session).not.toBeNull();

      useSessionStore.getState().resetSession();

      expect(useSessionStore.getState().session).toBeNull();
    });
  });
});

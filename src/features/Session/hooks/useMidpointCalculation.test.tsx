/**
 * @file useMidpointCalculation.test.tsx
 * @description Tests unitaires du hook useMidpointCalculation.
 *              Unit tests for the useMidpointCalculation hook.
 *
 * @module features/Session/hooks/useMidpointCalculation.test
 */

// [ADDED] Tests unitaires useMidpointCalculation

import { renderHook, act } from '@testing-library/react-native';
import { useMidpointCalculation } from '@features/Session/hooks/useMidpointCalculation';
import { CalculateMidpointError } from '@services/domain/midpoint/CalculateMidpointUseCase';
import type { CalculateMidpointResult } from '@services/domain/midpoint/CalculateMidpointUseCase';
import { useSessionStore } from '@state/useSessionStore';

// ─── Mock uuid ──────────────────────────────────────────────
let mockUuidCounter = 0;

jest.mock('uuid', () => ({
  v4: () => {
    mockUuidCounter++;
    return `test-uuid-${String(mockUuidCounter).padStart(4, '0')}`;
  },
}));

// ─── Mock DI container ──────────────────────────────────────
const mockExecute = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    calculateMidpointUseCase: { execute: mockExecute },
  })),
}));

// ─── Helpers ────────────────────────────────────────────────

/**
 * Crée une session avec N participants dans le store.
 * Creates a session with N participants in the store.
 *
 * @param count — nombre de participants / number of participants
 */
const setupSessionWithParticipants = (count: number): void => {
  useSessionStore.getState().createSession();
  for (let i = 0; i < count; i++) {
    useSessionStore.getState().addParticipant({
      displayName: `Participant ${String(i + 1)}`,
      startLocation: {
        id: `loc-${String(i + 1).padStart(4, '0')}`,
        coordinates: { latitude: 48 + i, longitude: 2 + i },
        formattedAddress: `Address ${String(i + 1)}`,
      },
    });
  }
};

const mockResult: CalculateMidpointResult = {
  midpoint: { latitude: 48.5, longitude: 2.5 },
  radius: 50000,
  participantsCount: 2,
};

// ─── Tests ──────────────────────────────────────────────────

describe('useMidpointCalculation', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
    useSessionStore.setState({ session: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('no session', () => {
    it('should return error no_session when session is null', () => {
      const { result } = renderHook(() => useMidpointCalculation());

      let calcResult: CalculateMidpointResult | null = null;
      act(() => {
        calcResult = result.current.calculate();
      });

      expect(calcResult).toBeNull();
      expect(result.current.error).toEqual({ code: 'no_session' });
    });
  });

  describe('valid session', () => {
    it('should call useCase and return result on success', () => {
      setupSessionWithParticipants(2);
      mockExecute.mockReturnValue(mockResult);

      const { result } = renderHook(() => useMidpointCalculation());

      let calcResult: CalculateMidpointResult | null = null;
      act(() => {
        calcResult = result.current.calculate();
      });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(calcResult).toEqual(mockResult);
      expect(result.current.error).toBeNull();
      expect(result.current.isCalculating).toBe(false);
    });

    it('should call setMidpoint on the store after successful calculation', () => {
      setupSessionWithParticipants(2);
      mockExecute.mockReturnValue(mockResult);

      const { result } = renderHook(() => useMidpointCalculation());

      act(() => {
        result.current.calculate();
      });

      const session = useSessionStore.getState().session;
      expect(session?.midpoint).toEqual(mockResult.midpoint);
      expect(session?.midpointRadius).toBe(mockResult.radius);
      expect(session?.status).toBe('computed');
    });
  });

  describe('useCase errors', () => {
    it('should map too_few_participants error', () => {
      setupSessionWithParticipants(2);
      mockExecute.mockImplementation(() => {
        throw new CalculateMidpointError(
          'At least 2 participants required',
          'too_few_participants',
        );
      });

      const { result } = renderHook(() => useMidpointCalculation());

      let calcResult: CalculateMidpointResult | null = null;
      act(() => {
        calcResult = result.current.calculate();
      });

      expect(calcResult).toBeNull();
      expect(result.current.error).toEqual({ code: 'too_few_participants' });
    });

    it('should map too_many_participants error', () => {
      setupSessionWithParticipants(2);
      mockExecute.mockImplementation(() => {
        throw new CalculateMidpointError('Max 5 participants allowed', 'too_many_participants');
      });

      const { result } = renderHook(() => useMidpointCalculation());

      let calcResult: CalculateMidpointResult | null = null;
      act(() => {
        calcResult = result.current.calculate();
      });

      expect(calcResult).toBeNull();
      expect(result.current.error).toEqual({ code: 'too_many_participants' });
    });

    it('should map unknown errors', () => {
      setupSessionWithParticipants(2);
      mockExecute.mockImplementation(() => {
        throw new Error('Something unexpected');
      });

      const { result } = renderHook(() => useMidpointCalculation());

      let calcResult: CalculateMidpointResult | null = null;
      act(() => {
        calcResult = result.current.calculate();
      });

      expect(calcResult).toBeNull();
      expect(result.current.error).toEqual({
        code: 'unknown',
        message: 'Something unexpected',
      });
    });
  });

  describe('clearError', () => {
    it('should reset error to null', () => {
      const { result } = renderHook(() => useMidpointCalculation());

      // Provoquer une erreur
      // Trigger an error
      act(() => {
        result.current.calculate();
      });
      expect(result.current.error).toEqual({ code: 'no_session' });

      // Effacer l'erreur
      // Clear the error
      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });
});

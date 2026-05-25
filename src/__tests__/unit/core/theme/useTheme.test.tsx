/**
 * @file useTheme.test.tsx
 * @description Tests unitaires du hook useTheme avec ThemeModeProvider.
 *              Unit tests for useTheme hook with ThemeModeProvider.
 *
 * @module __tests__/unit/core/theme/useTheme
 */

// [ADDED] Tests pour P0-6 — theme toggle via context

import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { ThemeModeProvider, useTheme } from '@core/theme';

describe('useTheme', () => {
  // ─── Default behavior (no provider) ───────────────────────
  it('returns light theme by default (no provider, system undefined)', () => {
    const { result } = renderHook(() => useTheme());

    // useColorScheme returns undefined in test env → defaults to light
    expect(result.current.mode).toBe('light');
  });

  // ─── With ThemeModeProvider (P0-6) ────────────────────────
  describe('with ThemeModeProvider (P0-6)', () => {
    it('returns dark theme when provider value is dark', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeModeProvider value="dark">{children}</ThemeModeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.mode).toBe('dark');
    });

    it('returns light theme when provider value is light', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeModeProvider value="light">{children}</ThemeModeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.mode).toBe('light');
    });

    it('follows system scheme when provider value is system', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeModeProvider value="system">{children}</ThemeModeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // useColorScheme returns undefined in test env → fallback light
      expect(result.current.mode).toBe('light');
    });

    it('overrides system scheme with explicit dark mode', () => {
      // System is undefined (light) but user chose dark
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeModeProvider value="dark">{children}</ThemeModeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.mode).toBe('dark');
      expect(result.current.color.surface.primary).toBeDefined();
    });
  });
});

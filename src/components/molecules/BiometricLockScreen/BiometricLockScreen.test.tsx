/**
 * @file BiometricLockScreen.test.tsx
 * @description Tests unitaires de la molecule BiometricLockScreen (F8).
 *              Unit tests for the BiometricLockScreen molecule (F8).
 *
 *              Couvre : auto-prompt DIFFÉRÉ jusqu'à supportedType !== null, bouton
 *              Déverrouiller / Réessayer, message d'erreur localisé par code,
 *              accessibilité (modal, header, live region), raison construite avec
 *              le type biométrique, échappatoire showDisableEscape /
 *              onDisableAndContinue (bouton visible seulement si activée).
 *
 * @module components/molecules/BiometricLockScreen/BiometricLockScreen.test
 */

// [ADDED] F8 — Tests unitaires BiometricLockScreen
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import BiometricLockScreen from '@components/molecules/BiometricLockScreen/BiometricLockScreen';

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        'lock.title': 'Mivro est verrouillé',
        'lock.subtitle': "Déverrouille l'app pour continuer.",
        'lock.unlock': 'Déverrouiller',
        'lock.retry': 'Réessayer',
        'lock.unlockHint': "Lance l'authentification biométrique",
        'lock.disableAndContinue': 'Désactiver le verrou et continuer',
        'lock.disableAndContinueHint': "Ouvre l'app sans authentification",
        'lock.errors.cancelled': 'Authentification annulée.',
        'lock.errors.failed': 'Authentification échouée.',
        'lock.errors.not_available': "La biométrie n'est pas disponible.",
        'lock.errors.not_enrolled': 'Aucune biométrie configurée.',
        'lock.errors.unknown': 'Une erreur est survenue.',
        'settings.types.face': 'Face ID',
        'settings.types.fingerprint': 'Touch ID',
        'settings.types.iris': "la reconnaissance de l'iris",
        'settings.types.generic': 'la biométrie',
      };
      if (key === 'lock.reason') return `Déverrouille Mivro avec ${params?.type ?? ''}`;
      return map[key] ?? key;
    },
  }),
}));

describe('BiometricLockScreen', () => {
  // ─── Auto-prompt DIFFÉRÉ jusqu'à supportedType !== null ────
  it('auto-prompts once on mount with the reason built from the type', () => {
    const onUnlock = jest.fn();
    render(<BiometricLockScreen supportedType="face" errorCode={null} onUnlock={onUnlock} />);

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith('Déverrouille Mivro avec Face ID');
  });

  it('does NOT auto-prompt while supportedType is still null (deferred)', () => {
    const onUnlock = jest.fn();
    render(<BiometricLockScreen supportedType={null} errorCode={null} onUnlock={onUnlock} />);

    // Le prompt est différé jusqu'à résolution du type (bon libellé natif) ;
    // si aucun type ne se résout, le hook auto-désactive le verrou.
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('auto-prompts once the type resolves from null to a real value', () => {
    const onUnlock = jest.fn();
    const { rerender } = render(
      <BiometricLockScreen supportedType={null} errorCode={null} onUnlock={onUnlock} />,
    );
    expect(onUnlock).not.toHaveBeenCalled();

    // Le type se résout (détection async terminée) → l'auto-prompt se déclenche.
    rerender(<BiometricLockScreen supportedType="face" errorCode={null} onUnlock={onUnlock} />);

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith('Déverrouille Mivro avec Face ID');
  });

  it('does not auto-prompt twice across re-renders', () => {
    const onUnlock = jest.fn();
    const { rerender } = render(
      <BiometricLockScreen supportedType="fingerprint" errorCode={null} onUnlock={onUnlock} />,
    );
    rerender(
      <BiometricLockScreen supportedType="fingerprint" errorCode={null} onUnlock={onUnlock} />,
    );

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  // ─── Rendu de base ────────────────────────────────────────
  it('renders the title and subtitle', () => {
    const { getByText } = render(
      <BiometricLockScreen supportedType="face" errorCode={null} onUnlock={jest.fn()} />,
    );

    expect(getByText('Mivro est verrouillé')).toBeTruthy();
    expect(getByText("Déverrouille l'app pour continuer.")).toBeTruthy();
  });

  // ─── Bouton Déverrouiller / Réessayer ─────────────────────
  it('shows "Déverrouiller" when there is no error', () => {
    const { getByText, queryByText } = render(
      <BiometricLockScreen
        supportedType="face"
        errorCode={null}
        onUnlock={jest.fn()}
        testID="lock"
      />,
    );

    expect(getByText('Déverrouiller')).toBeTruthy();
    expect(queryByText('Réessayer')).toBeNull();
  });

  it('shows "Réessayer" when an error is present', () => {
    const { getByText } = render(
      <BiometricLockScreen supportedType="face" errorCode="failed" onUnlock={jest.fn()} />,
    );

    expect(getByText('Réessayer')).toBeTruthy();
  });

  it('calls onUnlock again when the button is pressed', () => {
    const onUnlock = jest.fn();
    const { getByTestId } = render(
      <BiometricLockScreen
        supportedType="face"
        errorCode={null}
        onUnlock={onUnlock}
        testID="lock"
      />,
    );

    fireEvent.press(getByTestId('lock-unlock'));

    // 1 fois auto-prompt + 1 fois sur tap.
    expect(onUnlock).toHaveBeenCalledTimes(2);
    expect(onUnlock).toHaveBeenLastCalledWith('Déverrouille Mivro avec Face ID');
  });

  // ─── Message d'erreur par code ────────────────────────────
  describe('error message by code', () => {
    it.each([
      ['cancelled', 'Authentification annulée.'],
      ['failed', 'Authentification échouée.'],
      ['not_available', "La biométrie n'est pas disponible."],
      ['not_enrolled', 'Aucune biométrie configurée.'],
      ['unknown', 'Une erreur est survenue.'],
    ] as const)('renders the localized message for code "%s"', (code, message) => {
      const { getByTestId, getByText } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode={code}
          onUnlock={jest.fn()}
          testID="lock"
        />,
      );

      expect(getByTestId('lock-error')).toBeTruthy();
      expect(getByText(message)).toBeTruthy();
    });

    it('does not render the error block when errorCode is null', () => {
      const { queryByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode={null}
          onUnlock={jest.fn()}
          testID="lock"
        />,
      );

      expect(queryByTestId('lock-error')).toBeNull();
    });
  });

  // ─── Accessibilité ────────────────────────────────────────
  describe('accessibility', () => {
    it('marks the backdrop as an accessible modal labelled by the title', () => {
      const { getByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode={null}
          onUnlock={jest.fn()}
          testID="lock"
        />,
      );

      const backdrop = getByTestId('lock');
      expect(backdrop.props.accessibilityViewIsModal).toBe(true);
      expect(backdrop.props.accessibilityLabel).toBe('Mivro est verrouillé');
    });

    it('exposes the unlock button with a button role and a hint', () => {
      const { getByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode={null}
          onUnlock={jest.fn()}
          testID="lock"
        />,
      );

      const button = getByTestId('lock-unlock');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('Déverrouiller');
      expect(button.props.accessibilityHint).toBe("Lance l'authentification biométrique");
    });

    it('announces the error via a polite live region', () => {
      const { getByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode="failed"
          onUnlock={jest.fn()}
          testID="lock"
        />,
      );

      expect(getByTestId('lock-error').props.accessibilityLiveRegion).toBe('polite');
    });
  });

  // ─── Échappatoire « Désactiver le verrou et continuer » ───
  describe('disable escape hatch', () => {
    it('does not render the escape button by default (showDisableEscape omitted)', () => {
      const { queryByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode={null}
          onUnlock={jest.fn()}
          testID="lock"
        />,
      );

      expect(queryByTestId('lock-disable-escape')).toBeNull();
    });

    it('does not render the escape button when showDisableEscape is false', () => {
      const { queryByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode="failed"
          showDisableEscape={false}
          onUnlock={jest.fn()}
          onDisableAndContinue={jest.fn()}
          testID="lock"
        />,
      );

      expect(queryByTestId('lock-disable-escape')).toBeNull();
    });

    it('renders the escape button only when showDisableEscape is true', () => {
      const { getByTestId, getByText } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode="not_enrolled"
          showDisableEscape
          onUnlock={jest.fn()}
          onDisableAndContinue={jest.fn()}
          testID="lock"
        />,
      );

      expect(getByTestId('lock-disable-escape')).toBeTruthy();
      expect(getByText('Désactiver le verrou et continuer')).toBeTruthy();
    });

    it('calls onDisableAndContinue when the escape button is pressed', () => {
      const onDisableAndContinue = jest.fn();
      const { getByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode="not_enrolled"
          showDisableEscape
          onUnlock={jest.fn()}
          onDisableAndContinue={onDisableAndContinue}
          testID="lock"
        />,
      );

      fireEvent.press(getByTestId('lock-disable-escape'));

      expect(onDisableAndContinue).toHaveBeenCalledTimes(1);
    });

    it('exposes the escape button with a button role, label and hint (a11y)', () => {
      const { getByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode="not_enrolled"
          showDisableEscape
          onUnlock={jest.fn()}
          onDisableAndContinue={jest.fn()}
          testID="lock"
        />,
      );

      const escape = getByTestId('lock-disable-escape');
      expect(escape.props.accessibilityRole).toBe('button');
      expect(escape.props.accessibilityLabel).toBe('Désactiver le verrou et continuer');
      expect(escape.props.accessibilityHint).toBe("Ouvre l'app sans authentification");
    });

    it('does not crash when the escape button is pressed without a handler', () => {
      const { getByTestId } = render(
        <BiometricLockScreen
          supportedType="face"
          errorCode="not_enrolled"
          showDisableEscape
          onUnlock={jest.fn()}
          testID="lock"
        />,
      );

      expect(() => fireEvent.press(getByTestId('lock-disable-escape'))).not.toThrow();
    });
  });
});

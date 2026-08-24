/**
 * @file RealtimeConsentModal.test.tsx
 * @description Tests unitaires de la molecule RealtimeConsentModal (F4 — RGPD).
 *              Unit tests for the RealtimeConsentModal molecule (F4 — GDPR).
 *
 * @module components/molecules/RealtimeConsentModal/RealtimeConsentModal.test
 */

// [ADDED] F4 — Tests unitaires RealtimeConsentModal
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import RealtimeConsentModal from '@components/molecules/RealtimeConsentModal';

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'consent.title': 'Partager ma position',
        'consent.question': 'Acceptes-tu de partager ta position avec les participants ?',
        'consent.description': 'Ta position sera visible en temps réel.',
        'consent.note': 'Tu peux arrêter le partage à tout moment.',
        'consent.accept': 'Accepter et partager',
        'consent.decline': 'Non, juste voir les autres',
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('RealtimeConsentModal', () => {
  it('renders title, question and action labels when visible', () => {
    const { getByText, getByTestId } = render(
      <RealtimeConsentModal visible onAccept={jest.fn()} onDecline={jest.fn()} testID="consent" />,
    );

    expect(getByTestId('consent-card')).toBeTruthy();
    expect(getByText('Partager ma position')).toBeTruthy();
    expect(getByText('Acceptes-tu de partager ta position avec les participants ?')).toBeTruthy();
    expect(getByText('Accepter et partager')).toBeTruthy();
    expect(getByText('Non, juste voir les autres')).toBeTruthy();
  });

  it('calls onAccept when the accept button is pressed', () => {
    const onAccept = jest.fn();
    const { getByTestId } = render(
      <RealtimeConsentModal visible onAccept={onAccept} onDecline={jest.fn()} testID="consent" />,
    );

    fireEvent.press(getByTestId('consent-accept'));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onDecline when the decline button is pressed', () => {
    const onDecline = jest.fn();
    const { getByTestId } = render(
      <RealtimeConsentModal visible onAccept={jest.fn()} onDecline={onDecline} testID="consent" />,
    );

    fireEvent.press(getByTestId('consent-decline'));

    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('marks the card as an accessible modal', () => {
    const { getByTestId } = render(
      <RealtimeConsentModal visible onAccept={jest.fn()} onDecline={jest.fn()} testID="consent" />,
    );

    const card = getByTestId('consent-card');
    expect(card.props.accessibilityViewIsModal).toBe(true);
    expect(card.props.accessibilityLabel).toBe('Partager ma position');
  });

  it('sets accessibility roles and hints on action buttons', () => {
    const { getByTestId } = render(
      <RealtimeConsentModal visible onAccept={jest.fn()} onDecline={jest.fn()} testID="consent" />,
    );

    const accept = getByTestId('consent-accept');
    expect(accept.props.accessibilityRole).toBe('button');
    expect(accept.props.accessibilityLabel).toBe('Accepter et partager');
    expect(accept.props.accessibilityHint).toBe(
      'Acceptes-tu de partager ta position avec les participants ?',
    );
  });
});

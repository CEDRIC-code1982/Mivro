/**
 * @file SessionsScreen.tsx
 * @description Écran Sessions (placeholder MVP).
 *              Sessions screen (MVP placeholder).
 *
 * @module features/Session/screens/SessionsScreen/SessionsScreen
 */

// [ADDED] Écran placeholder SessionsScreen avec i18n + theme + a11y
import { useTheme, type Theme } from '@theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen, Text } from '@components/atoms';

/**
 * Écran placeholder de l'historique des sessions.
 * Placeholder screen for the session history.
 *
 * @returns Composant SessionsScreen / SessionsScreen component
 */
const SessionsScreen: React.FC = () => {
  const { t } = useTranslation('sessions');
  const theme = useTheme();
  const styles = buildStyles(theme);

  return (
    <Screen background="primary">
      <View style={styles.container}>
        <Text variant="h1" weight="bold" accessibilityRole="header">
          {t('title')}
        </Text>
        <Text variant="body" color="secondary" style={styles.description}>
          {t('placeholder')}
        </Text>
        <Pressable
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.continue')}
          accessibilityHint={t('common:actions.continue')}
          onPress={() => {
            /* TODO */
          }}
        >
          <Text variant="body" weight="semibold" color="onBrand">
            {t('common:actions.continue')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
};

// [ADDED] Styles via tokens — zéro magic number (DS-001)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    description: {
      textAlign: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    button: {
      backgroundColor: theme.color.interactive.brand.default,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default SessionsScreen;

/**
 * @file ProfileScreen.tsx
 * @description Écran Profil — édition de l'identité utilisateur (F7).
 *              Profile screen — user identity editing (F7).
 *
 *              Permet (utilisateur connecté) :
 *              - Éditer le nom affiché (displayName) avec validation.
 *              - Choisir / prendre / supprimer une photo de profil.
 *              - Choisir un avatar parmi 20 avatars emoji prédéfinis.
 *              - Cycler le thème, se connecter en invité, se déconnecter.
 *
 *              F7 passe 2 : photo de profil via IProfilePhotoService (port DI).
 *              L'écran n'importe PAS image-picker ni le FileSystem directement.
 *              F7 pass 2: profile photo via IProfilePhotoService (DI port).
 *              The screen does NOT import image-picker nor FileSystem directly.
 *
 * @module features/Profile/screens/ProfileScreen/ProfileScreen
 */

// [MODIFIED] F7 passe 2 — photo de profil + édition displayName + grille d'avatars
import { useTheme, type Theme } from '@theme';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Avatar, Screen, Text } from '@components/atoms';
import AvatarPicker from '@components/molecules/AvatarPicker';
import type { AvatarId } from '@entities/Avatar';
import { useBiometricLock } from '@features/Biometric/hooks/useBiometricLock'; // [ADDED] F8
import {
  useAuthUser,
  useIsAuthenticated,
  useIsGuest,
  useAuthActions,
} from '@features/Profile/hooks/useAuth';
import { useProfilePhoto } from '@features/Profile/hooks/useProfilePhoto';
import { usePreferencesStore, type ThemeMode } from '@state/usePreferencesStore';

// [ADDED] Ordre de cycle du thème / Theme cycle order
const THEME_CYCLE: readonly ThemeMode[] = ['system', 'light', 'dark'];

/** Contraintes de longueur du nom (alignées sur l'entité User) / Name length bounds */
const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 50;

/** Diamètre de l'avatar courant en en-tête / Current avatar diameter in header */
const HEADER_AVATAR_SIZE = 88;

/**
 * Retourne le ThemeMode suivant dans le cycle.
 * Returns the next ThemeMode in the cycle.
 *
 * @param current - Mode actuel / Current mode
 * @returns Mode suivant / Next mode
 */
const nextThemeMode = (current: ThemeMode): ThemeMode => {
  const idx = THEME_CYCLE.indexOf(current);
  const nextIdx = (idx + 1) % THEME_CYCLE.length;
  return THEME_CYCLE[nextIdx] ?? 'system';
};

/**
 * Écran de profil : identité, avatar, thème, verrou biométrique.
 * Profile screen: identity, avatar, theme, biometric lock.
 *
 * @returns Composant ProfileScreen / ProfileScreen component
 */
const ProfileScreen: React.FC = () => {
  const { t } = useTranslation('profile');
  const { t: tBio } = useTranslation('biometric'); // [ADDED] F8
  const theme = useTheme();
  const styles = buildStyles(theme);

  // [ADDED] Sélecteurs auth
  const user = useAuthUser();
  const isAuthenticated = useIsAuthenticated();
  const isGuest = useIsGuest();
  const { signInAsGuest, signOut, updateProfile } = useAuthActions();

  // [ADDED] F7 passe 2 — orchestration photo de profil (port DI, jamais image-picker direct)
  const {
    photoUri,
    isBusy: isPhotoBusy,
    error: photoError,
    pickPhoto,
    removePhoto,
  } = useProfilePhoto();

  // [ADDED] Sélecteurs préférences
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  // [ADDED] F8 — verrou biométrique (opt-in). Passe par le hook (port DI).
  const {
    biometricEnabled,
    supportedType: biometricType,
    enableLock,
    disableLock,
  } = useBiometricLock();
  const [biometricBusy, setBiometricBusy] = useState<boolean>(false);
  const [biometricErrorCode, setBiometricErrorCode] = useState<string | null>(null);

  // [ADDED] F7 — état local d'édition du nom (brouillon avant validation)
  const [nameDraft, setNameDraft] = useState<string>(user?.displayName ?? '');

  // [ADDED] F7 — resynchronise le brouillon quand l'utilisateur change (login/logout)
  useEffect(() => {
    setNameDraft(user?.displayName ?? '');
  }, [user?.id, user?.displayName]);

  // [ADDED] F7 — validité du nom (trim, bornes) → état error (ERR-003)
  const trimmedName = nameDraft.trim();
  const isNameValid =
    trimmedName.length >= DISPLAY_NAME_MIN && trimmedName.length <= DISPLAY_NAME_MAX;
  const isNameDirty = user != null && trimmedName !== user.displayName;
  const showNameError = nameDraft.length > 0 && !isNameValid;

  // [ADDED] Handlers
  const handleCycleTheme = useCallback(() => {
    setThemeMode(nextThemeMode(themeMode));
  }, [themeMode, setThemeMode]);

  const handleSignInGuest = useCallback(() => {
    signInAsGuest();
  }, [signInAsGuest]);

  const handleSignOut = useCallback(() => {
    signOut();
  }, [signOut]);

  // [ADDED] F7 — sauvegarde du nom (no-op si invalide / inchangé)
  const handleSaveName = useCallback(() => {
    if (!isNameValid || !isNameDirty) return;
    updateProfile({ displayName: trimmedName });
  }, [isNameValid, isNameDirty, trimmedName, updateProfile]);

  // [ADDED] F7 — sélection d'un avatar (persistance immédiate)
  const handleSelectAvatar = useCallback(
    (avatarId: AvatarId) => {
      updateProfile({ avatarId });
    },
    [updateProfile],
  );

  // [ADDED] F8 — bascule du verrou biométrique. À l'activation, le hook vérifie
  // la disponibilité + l'enrôlement et fait une auth de confirmation AVANT de
  // poser le flag ; à la désactivation, il retire la sentinelle keychain.
  const handleToggleBiometric = useCallback(
    (next: boolean): void => {
      if (biometricBusy) return;
      setBiometricBusy(true);
      setBiometricErrorCode(null);

      const typeLabel = tBio(`settings.types.${biometricType ?? 'generic'}`);
      const reason = tBio('settings.confirmReason', { type: typeLabel });

      const run = async (): Promise<void> => {
        try {
          const result = next ? await enableLock(reason) : await disableLock();
          if (!result.success) {
            setBiometricErrorCode(result.errorCode ?? 'unknown');
          }
        } finally {
          setBiometricBusy(false);
        }
      };
      // enableLock/disableLock capturent leurs erreurs (jamais de rejet) ;
      // fire-and-forget sûr.
      run().catch(() => setBiometricBusy(false));
    },
    [biometricBusy, biometricType, tBio, enableLock, disableLock],
  );

  // [ADDED] F8 — message d'erreur localisé (ERR-003) + libellé du type biométrique
  const biometricTypeLabel = tBio(`settings.types.${biometricType ?? 'generic'}`);
  const biometricErrorMessage =
    biometricErrorCode != null ? tBio(`settings.errors.${biometricErrorCode}`) : null;

  // [ADDED] F7 passe 2 — handlers photo (galerie / caméra / suppression).
  // pickPhoto/removePhoto capturent toutes leurs erreurs en interne (état error),
  // la promesse ne rejette jamais : fire-and-forget sûr.
  const handlePickFromLibrary = useCallback((): void => {
    pickPhoto('library').catch(() => undefined);
  }, [pickPhoto]);

  const handlePickFromCamera = useCallback((): void => {
    pickPhoto('camera').catch(() => undefined);
  }, [pickPhoto]);

  const handleRemovePhoto = useCallback((): void => {
    removePhoto().catch(() => undefined);
  }, [removePhoto]);

  // [ADDED] F7 passe 2 — message d'erreur localisé selon le code (ERR-003)
  const photoErrorMessage = photoError != null ? t(`photo.errors.${photoError}`) : null;

  // [ADDED] Label localisé du thème courant
  const themeModeLabel = t(`themeLabels.${themeMode}`);
  // [REVIEW P1] Primitive directe — pas de useMemo (rien à mémoïser)
  const currentAvatarId: AvatarId | undefined = user?.avatarId;

  return (
    <Screen background="primary">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text variant="h1" weight="bold" accessibilityRole="header">
          {t('title')}
        </Text>

        {/* [ADDED] F7 — Section édition profil (utilisateur connecté uniquement) */}
        {isAuthenticated && user ? (
          <>
            {/* Avatar courant + statut */}
            <View
              style={styles.identity}
              accessibilityRole="text"
              accessibilityLabel={t('signedInAs', { name: user.displayName })}
            >
              <Avatar
                photoUri={photoUri ?? undefined}
                avatarId={currentAvatarId}
                fallbackName={user.displayName}
                size={HEADER_AVATAR_SIZE}
                testID="profile-current-avatar"
              />
              <Text variant="bodyLg" weight="semibold" align="center">
                {user.displayName}
              </Text>
              {isGuest ? (
                <View style={styles.badge}>
                  {/* onAccent : badge sur remplissage teal */}
                  <Text variant="caption" weight="medium" color="onAccent">
                    {t('guestBadge')}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* [ADDED] F7 passe 2 — Section photo de profil */}
            <View style={styles.field}>
              <Text variant="small" weight="semibold" color="secondary" accessibilityRole="header">
                {t('photo.label')}
              </Text>

              <View style={styles.photoActions}>
                <Pressable
                  onPress={handlePickFromLibrary}
                  disabled={isPhotoBusy}
                  style={({ pressed }) => [
                    styles.buttonSecondary,
                    isPhotoBusy ? styles.buttonDisabled : undefined,
                    pressed ? styles.buttonPressed : undefined,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isPhotoBusy, busy: isPhotoBusy }}
                  accessibilityLabel={t('photo.choose')}
                  accessibilityHint={t('photo.chooseHint')}
                  testID="profile-photo-library"
                >
                  <Text variant="body" weight="semibold">
                    {t('photo.choose')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handlePickFromCamera}
                  disabled={isPhotoBusy}
                  style={({ pressed }) => [
                    styles.buttonSecondary,
                    isPhotoBusy ? styles.buttonDisabled : undefined,
                    pressed ? styles.buttonPressed : undefined,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isPhotoBusy, busy: isPhotoBusy }}
                  accessibilityLabel={t('photo.take')}
                  accessibilityHint={t('photo.takeHint')}
                  testID="profile-photo-camera"
                >
                  <Text variant="body" weight="semibold">
                    {t('photo.take')}
                  </Text>
                </Pressable>

                {photoUri != null ? (
                  <Pressable
                    onPress={handleRemovePhoto}
                    disabled={isPhotoBusy}
                    style={({ pressed }) => [
                      styles.buttonDanger,
                      isPhotoBusy ? styles.buttonDisabled : undefined,
                      pressed ? styles.buttonPressed : undefined,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isPhotoBusy, busy: isPhotoBusy }}
                    accessibilityLabel={t('photo.remove')}
                    accessibilityHint={t('photo.removeHint')}
                    testID="profile-photo-remove"
                  >
                    <Text variant="body" weight="semibold" color="onBrand">
                      {t('photo.remove')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* État loading (ERR-003) */}
              {isPhotoBusy ? (
                <View style={styles.photoStatus} accessibilityLiveRegion="polite">
                  <ActivityIndicator
                    color={theme.color.interactive.brand.default}
                    accessibilityLabel={t('photo.loading')}
                    testID="profile-photo-loading"
                  />
                  <Text variant="caption" color="secondary">
                    {t('photo.loading')}
                  </Text>
                </View>
              ) : null}

              {/* État erreur (ERR-003) */}
              {!isPhotoBusy && photoErrorMessage != null ? (
                <Text
                  variant="caption"
                  color="error"
                  accessibilityLiveRegion="polite"
                  testID="profile-photo-error"
                >
                  {photoErrorMessage}
                </Text>
              ) : null}
            </View>

            {/* Édition du nom */}
            <View style={styles.field}>
              <Text
                variant="small"
                weight="semibold"
                color="secondary"
                accessibilityRole="text"
                nativeID="profile-name-label"
              >
                {t('displayName.label')}
              </Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder={t('displayName.placeholder')}
                placeholderTextColor={theme.color.text.tertiary}
                maxLength={DISPLAY_NAME_MAX}
                style={[styles.input, showNameError ? styles.inputError : undefined]}
                accessibilityLabel={t('displayName.label')}
                accessibilityHint={t('displayName.hint')}
                aria-labelledby="profile-name-label"
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                testID="profile-name-input"
              />
              {showNameError ? (
                <Text variant="caption" color="error" accessibilityLiveRegion="polite">
                  {t('displayName.error')}
                </Text>
              ) : null}

              <Pressable
                onPress={handleSaveName}
                disabled={!isNameValid || !isNameDirty}
                style={({ pressed }) => [
                  styles.buttonPrimary,
                  !isNameValid || !isNameDirty ? styles.buttonDisabled : undefined,
                  pressed ? styles.buttonPressed : undefined,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !isNameValid || !isNameDirty }}
                accessibilityLabel={t('displayName.save')}
                accessibilityHint={t('displayName.saveHint')}
                testID="profile-name-save"
              >
                <Text variant="body" weight="semibold" color="onBrand">
                  {t('displayName.save')}
                </Text>
              </Pressable>
            </View>

            {/* Grille d'avatars */}
            <View style={styles.field}>
              <Text variant="small" weight="semibold" color="secondary" accessibilityRole="header">
                {t('avatarPicker.label')}
              </Text>
              <AvatarPicker
                selectedAvatarId={currentAvatarId}
                onSelect={handleSelectAvatar}
                testID="profile-avatar-picker"
              />
            </View>

            {/* [ADDED] F8 — Section verrou biométrique (opt-in) */}
            <View style={styles.field}>
              <Text variant="small" weight="semibold" color="secondary" accessibilityRole="header">
                {tBio('settings.label')}
              </Text>

              <View style={styles.biometricRow}>
                <View style={styles.biometricText}>
                  <Text variant="body" weight="semibold">
                    {tBio('settings.label')}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {tBio('settings.description', { type: biometricTypeLabel })}
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  disabled={biometricBusy}
                  trackColor={{
                    false: theme.color.interactive.neutral.default,
                    true: theme.color.interactive.brand.default,
                  }}
                  accessibilityRole="switch"
                  accessibilityLabel={tBio('settings.label')}
                  accessibilityHint={tBio('settings.toggleHint')}
                  accessibilityState={{ checked: biometricEnabled, disabled: biometricBusy }}
                  testID="profile-biometric-toggle"
                />
              </View>

              {/* État loading (ERR-003) */}
              {biometricBusy ? (
                <View style={styles.photoStatus} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={theme.color.interactive.brand.default} />
                </View>
              ) : null}

              {/* État erreur (ERR-003) */}
              {!biometricBusy && biometricErrorMessage != null ? (
                <Text
                  variant="caption"
                  color="error"
                  accessibilityLiveRegion="polite"
                  testID="profile-biometric-error"
                >
                  {biometricErrorMessage}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          // [ADDED] F7 — État non connecté (empty state — ERR-003)
          <Text variant="body" color="secondary" align="center">
            {t('notSignedIn')}
          </Text>
        )}

        {/* Thème courant */}
        <Text
          variant="body"
          color="secondary"
          accessibilityRole="text"
          accessibilityLabel={t('currentTheme', { mode: themeModeLabel })}
        >
          {t('currentTheme', { mode: themeModeLabel })}
        </Text>

        {/* Actions globales */}
        <View style={styles.actions}>
          {!isAuthenticated ? (
            <Pressable
              style={({ pressed }) => [
                styles.buttonPrimary,
                pressed ? styles.buttonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('actions.signInGuest')}
              accessibilityHint={t('hints.signInGuest')}
              onPress={handleSignInGuest}
            >
              <Text variant="body" weight="semibold" color="onBrand">
                {t('actions.signInGuest')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.buttonDanger,
                pressed ? styles.buttonPressed : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('actions.signOut')}
              accessibilityHint={t('hints.signOut')}
              onPress={handleSignOut}
            >
              <Text variant="body" weight="semibold" color="onBrand">
                {t('actions.signOut')}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.buttonSecondary,
              pressed ? styles.buttonPressed : undefined,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('actions.cycleTheme')}
            accessibilityHint={t('hints.cycleTheme')}
            onPress={handleCycleTheme}
          >
            <Text variant="body" weight="semibold">
              {t('actions.cycleTheme')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
};

// [MODIFIED] F7 — styles via tokens (DS-001/002)
const buildStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      gap: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xl,
    },
    identity: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    badge: {
      backgroundColor: theme.color.interactive.accent.default,
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.full,
    },
    field: {
      width: '100%',
      gap: theme.spacing.sm,
    },
    // [ADDED] F7 passe 2 — boutons photo empilés (robuste Dynamic Type) / stacked photo buttons
    photoActions: {
      gap: theme.spacing.sm,
    },
    // [ADDED] F7 passe 2 — ligne d'état loading photo / photo loading status row
    photoStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    // [ADDED] F8 — ligne du toggle biométrique (libellé + switch) / biometric toggle row
    biometricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      minHeight: theme.touchTarget.min,
    },
    // [ADDED] F8 — colonne texte du toggle (prend l'espace restant) / toggle text column
    biometricText: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    input: {
      minHeight: theme.touchTarget.min,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.color.surface.secondary,
      color: theme.color.text.primary,
      fontFamily: theme.typography.fontFamily.sans,
      fontSize: theme.typography.fontSize.body,
    },
    inputError: {
      borderColor: theme.color.border.error,
    },
    actions: {
      width: '100%',
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    buttonPrimary: {
      backgroundColor: theme.color.interactive.brand.default,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonDanger: {
      backgroundColor: theme.color.interactive.danger.default,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonSecondary: {
      backgroundColor: theme.color.interactive.neutral.default,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonDisabled: {
      backgroundColor: theme.color.interactive.brand.disabled,
    },
    buttonPressed: {
      opacity: 0.8,
    },
  });

export default ProfileScreen;

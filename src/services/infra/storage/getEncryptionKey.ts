/**
 * @file getEncryptionKey.ts
 * @description Récupère ou génère la clé de chiffrement MMKV,
 *              persistée de façon sécurisée dans le Keychain
 *              (iOS Keychain / Android Keystore).
 *
 *              Retrieves or generates the MMKV encryption key,
 *              securely persisted in the Keychain
 *              (iOS Keychain / Android Keystore).
 *
 *              La clé est générée UNE FOIS au premier lancement
 *              et réutilisée à chaque démarrage suivant.
 *              The key is generated ONCE on first launch
 *              and reused on every subsequent startup.
 *
 * @module infrastructure/storage/getEncryptionKey
 */

// [ADDED] Gestion de la clé de chiffrement MMKV via Keychain
import * as Keychain from 'react-native-keychain';
import { v4 as uuidv4 } from 'uuid';

const KEYCHAIN_SERVICE = 'com.cedricpineau.mivro.mmkv'; // [MODIFIED] MidPoint → Mivro
const KEYCHAIN_USERNAME = 'mmkv-encryption-key';

/**
 * Récupère la clé MMKV depuis le Keychain.
 * Si absente (premier lancement), génère une clé aléatoire et la stocke.
 *
 * Retrieves the MMKV key from the Keychain.
 * If absent (first launch), generates a random key and stores it.
 *
 * @returns La clé de chiffrement / The encryption key
 * @throws Error si l'accès au Keychain échoue / if Keychain access fails
 */
export const getEncryptionKey = async (): Promise<string> => {
  const fnName = 'getEncryptionKey';

  try {
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });

    if (credentials && credentials.username === KEYCHAIN_USERNAME) {
      console.log(
        `[INFO][getEncryptionKey][${fnName}][?][${new Date().toISOString().slice(11, 19)}] ` +
          'Encryption key retrieved from Keychain',
      );
      return credentials.password;
    }

    // Premier lancement : génère et stocke une nouvelle clé
    // First launch: generate and store a new key
    const newKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');

    await Keychain.setGenericPassword(KEYCHAIN_USERNAME, newKey, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });

    console.log(
      `[INFO][getEncryptionKey][${fnName}][?][${new Date().toISOString().slice(11, 19)}] ` +
        'New encryption key generated and stored',
    );
    return newKey;
  } catch (error) {
    console.error(
      `[ERROR][getEncryptionKey][${fnName}][?][${new Date().toISOString().slice(11, 19)}] ` +
        'Failed to access Keychain',
      error,
    );
    throw error;
  }
};

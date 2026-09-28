import * as SecureStore from 'expo-secure-store';

import { ApplicationFailure } from '../../application/errors/ApplicationFailure';
import type { SessionSecretStore } from '../../application/session/SessionSecretStore';

const SESSION_KEY = 'campusops.session.access-token';
const STORAGE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Device-protected secret storage; no login flow consumes this port before Week 06. */
export class ExpoSecureSessionSecretStore implements SessionSecretStore {
  async save(secret: string): Promise<void> {
    if (typeof secret !== 'string' || secret.trim().length === 0) {
      throw new ApplicationFailure('INVALID_SESSION_SECRET', 'El secreto de sesión no es válido.');
    }
    try {
      await SecureStore.setItemAsync(SESSION_KEY, secret, STORAGE_OPTIONS);
    } catch {
      throw new ApplicationFailure(
        'SECURE_STORAGE_UNAVAILABLE',
        'No fue posible guardar la sesión de forma segura.',
      );
    }
  }

  async read(): Promise<string | null> {
    try {
      const secret = await SecureStore.getItemAsync(SESSION_KEY, STORAGE_OPTIONS);
      if (secret !== null && typeof secret !== 'string') {
        throw new Error('Unexpected secure storage value');
      }
      return secret;
    } catch {
      throw new ApplicationFailure(
        'SECURE_STORAGE_UNAVAILABLE',
        'No fue posible leer la sesión de forma segura.',
      );
    }
  }

  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY, STORAGE_OPTIONS);
    } catch {
      throw new ApplicationFailure(
        'SECURE_STORAGE_UNAVAILABLE',
        'No fue posible borrar la sesión de forma segura.',
      );
    }
  }
}

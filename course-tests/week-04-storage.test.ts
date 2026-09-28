import * as SecureStore from 'expo-secure-store';

import { ApplicationFailure } from '../src/application/errors/ApplicationFailure';
import { ExpoSecureSessionSecretStore } from '../src/infrastructure/session/ExpoSecureSessionSecretStore';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const setItem = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const getItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const deleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;

beforeEach(() => {
  jest.resetAllMocks();
});

test('stores, reads and deletes only through the device-protected provider', async () => {
  const store = new ExpoSecureSessionSecretStore();
  const secret = 'synthetic-session-value';
  getItem.mockResolvedValueOnce(secret).mockResolvedValueOnce(null);

  await store.save(secret);
  await expect(store.read()).resolves.toBe(secret);
  await store.clear();
  await expect(store.read()).resolves.toBeNull();

  expect(setItem).toHaveBeenCalledWith('campusops.session.access-token', secret, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  expect(getItem).toHaveBeenCalledTimes(2);
  expect(deleteItem).toHaveBeenCalledWith('campusops.session.access-token', {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
});

test('rejects an empty secret before writing to the provider', async () => {
  const store = new ExpoSecureSessionSecretStore();
  await expect(store.save('  ')).rejects.toMatchObject({
    code: 'INVALID_SESSION_SECRET',
    message: 'El secreto de sesión no es válido.',
  });
  expect(setItem).not.toHaveBeenCalled();
});

test.each(['save', 'read', 'clear'] as const)(
  '%s maps provider failures to a safe application error',
  async (operation) => {
    const store = new ExpoSecureSessionSecretStore();
    const providerSecret = 'synthetic-provider-secret';
    if (operation === 'save') setItem.mockRejectedValueOnce(new Error(providerSecret));
    if (operation === 'read') getItem.mockRejectedValueOnce(new Error(providerSecret));
    if (operation === 'clear') deleteItem.mockRejectedValueOnce(new Error(providerSecret));

    let failure: unknown;
    try {
      if (operation === 'save') await store.save('synthetic-session-value');
      if (operation === 'read') await store.read();
      if (operation === 'clear') await store.clear();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(ApplicationFailure);
    expect(failure).toMatchObject({ code: 'SECURE_STORAGE_UNAVAILABLE' });
    expect(String(failure)).not.toContain(providerSecret);
    expect((failure as Error & { cause?: unknown }).cause).toBeUndefined();
  },
);

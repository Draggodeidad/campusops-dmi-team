import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LookupIncidentLocation } from '../src/application/location/LookupIncidentLocation';
import { MemoryLocationCache } from '../src/infrastructure/location/MemoryLocationCache';
import {
  PhotonLocationProvider,
  parseLocationRetryAfter,
} from '../src/infrastructure/location/PhotonLocationProvider';
import {
  evaluateIncidentLocation,
  manualIncidentLocation,
  selectIncidentLocation,
  validateProviderLocation,
} from '../src/application/location/selectIncidentLocation';
import type { LocationCache, LocationCacheEntry } from '../src/application/location/LocationCache';
import type { LocationProvider } from '../src/application/location/LocationProvider';
import type { IncidentTransport } from '../src/infrastructure/http/IncidentTransport';
import { CreateIncidentScreen } from '../src/ui/incidents/CreateIncidentScreen';
import {
  createLocationFixture,
  createLocationProviderDouble,
  LOCATION_QUERY,
  MANUAL_LOCATION_LABEL,
  NORMALIZED_LOCATION_QUERY,
} from './fixtures/week-09/scenario';
import { createVirtualClock } from './fixtures/week-09/virtualClock';

describe('Week 09 — Issue #64: Proveedor, Caché y Alternativa Manual', () => {
  // =========================================================================
  // GRUPO 1: Proveedor y validación de coordenadas
  // =========================================================================

  test('Escenario 1: Consulta exitosa de ubicación mediante proveedor retorna datos válidos', async () => {
    const rawSuccess = { label: 'Campus Central - Edificio A', latitude: 18.4625, longitude: -97.3921 };
    const provider: LocationProvider = { lookup: jest.fn(async () => rawSuccess) };
    const cache = new MemoryLocationCache();
    const clock = createVirtualClock(1000);
    const lookupUseCase = new LookupIncidentLocation(provider, cache, clock);

    const result = await lookupUseCase.execute({
      query: 'Campus Central',
      manualLabel: MANUAL_LOCATION_LABEL,
    });

    expect(result.cacheHit).toBe(false);
    expect(result.location).toEqual({
      source: 'provider',
      label: 'Campus Central - Edificio A',
      latitude: 18.4625,
      longitude: -97.3921,
    });
  });

  test('Escenario 2: Coordenadas válidas en el origen (0, 0) son reconocidas como válidas', () => {
    const originLocation = { label: 'Punto Cero Campus', latitude: 0, longitude: 0 };
    const validated = validateProviderLocation(originLocation);

    expect(validated.location).toEqual({
      source: 'provider',
      label: 'Punto Cero Campus',
      latitude: 0,
      longitude: 0,
    });
    expect(selectIncidentLocation(originLocation, MANUAL_LOCATION_LABEL)).toEqual({
      source: 'provider',
      label: 'Punto Cero Campus',
      latitude: 0,
      longitude: 0,
    });
  });

  test('Escenario 3: Límites geográficos extremos (±90 latitud, ±180 longitud) son aceptados', () => {
    const boundaries = [
      { latitude: 90, longitude: 180 },
      { latitude: -90, longitude: -180 },
      { latitude: 90, longitude: -180 },
      { latitude: -90, longitude: 180 },
    ];

    for (const coords of boundaries) {
      const payload = { label: `Límite ${coords.latitude}/${coords.longitude}`, ...coords };
      const validated = validateProviderLocation(payload);
      expect(validated.location).toEqual({
        source: 'provider',
        label: payload.label,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      expect(selectIncidentLocation(payload, MANUAL_LOCATION_LABEL)).toEqual({
        source: 'provider',
        label: payload.label,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    }
  });

  test('Escenario 4: Coordenadas fuera de rango son rechazadas con invalid_coordinates y degradan a manual', () => {
    const outOfBounds = [
      { latitude: 90.0001, longitude: 0 },
      { latitude: -90.0001, longitude: 0 },
      { latitude: 0, longitude: 180.0001 },
      { latitude: 0, longitude: -180.0001 },
      { latitude: 999, longitude: 10 },
      { latitude: 10, longitude: -999 },
    ];

    for (const coords of outOfBounds) {
      const payload = { label: 'Zona fuera de rango', ...coords };
      const validated = validateProviderLocation(payload);
      expect(validated.failure).toEqual({ kind: 'invalid_coordinates' });
      expect(selectIncidentLocation(payload, MANUAL_LOCATION_LABEL)).toEqual({
        source: 'manual',
        label: MANUAL_LOCATION_LABEL,
      });
    }
  });

  test('Escenario 5: Valores NaN e Infinity son rechazados estrictamente', () => {
    const nonFiniteCoords = [
      { latitude: NaN, longitude: 0 },
      { latitude: 0, longitude: NaN },
      { latitude: NaN, longitude: NaN },
      { latitude: Infinity, longitude: 0 },
      { latitude: -Infinity, longitude: 0 },
      { latitude: 0, longitude: Infinity },
      { latitude: 0, longitude: -Infinity },
    ];

    for (const coords of nonFiniteCoords) {
      const payload = { label: 'Zona no finita', ...coords };
      const validated = validateProviderLocation(payload);
      expect(validated.failure).toEqual({ kind: 'invalid_coordinates' });
      expect(selectIncidentLocation(payload, MANUAL_LOCATION_LABEL)).toEqual({
        source: 'manual',
        label: MANUAL_LOCATION_LABEL,
      });
    }
  });

  test('Escenario 6: Etiquetas vacías o compuestas exclusivamente de espacios son rechazadas', () => {
    const emptyLabels = ['', '   ', '\t\n'];

    for (const label of emptyLabels) {
      const payload = { label, latitude: 18.4, longitude: -97.3 };
      const validated = validateProviderLocation(payload);
      expect(validated.failure).toEqual({ kind: 'invalid_response' });
      expect(selectIncidentLocation(payload, MANUAL_LOCATION_LABEL)).toEqual({
        source: 'manual',
        label: MANUAL_LOCATION_LABEL,
      });
    }
  });

  test('Escenario 7: Respuestas incompletas o sin coordenadas son tratadas de forma segura', () => {
    const incompletePayloads = [
      { label: 'Zona sin coordenadas' },
      { latitude: 18.4, longitude: -97.3 }, // Falta label
      { label: 'Zona con latitud nula', latitude: null, longitude: -97.3 },
      { label: 'Zona con longitud indefinida', latitude: 18.4, longitude: undefined },
      null,
      undefined,
      {},
      [],
    ];

    for (const payload of incompletePayloads) {
      const validated = validateProviderLocation(payload);
      expect(validated.location).toBeUndefined();
      expect(validated.failure).toBeDefined();
      expect(selectIncidentLocation(payload, MANUAL_LOCATION_LABEL)).toEqual({
        source: 'manual',
        label: MANUAL_LOCATION_LABEL,
      });
    }
  });

  // =========================================================================
  // GRUPO 2: Caché y políticas de expiración / normalización
  // =========================================================================

  test('Escenario 8: Caché MISS consulta al proveedor y almacena la entrada para el futuro', async () => {
    const clock = createVirtualClock(1000);
    const entries = new Map<string, LocationCacheEntry>();
    const cache: LocationCache = {
      get: jest.fn(async (key: string) => entries.get(key) ?? null),
      put: jest.fn(async (key: string, value: LocationCacheEntry) => { entries.set(key, value); }),
    };
    const provider: LocationProvider = {
      lookup: jest.fn(async () => ({ label: 'Zona Auditorio', latitude: 18.46, longitude: -97.39 })),
    };
    const lookupUseCase = new LookupIncidentLocation(provider, cache, clock, { cacheTtlMs: 300000, timeoutMs: 1000 });

    const result = await lookupUseCase.execute({ query: 'Auditorio', manualLabel: MANUAL_LOCATION_LABEL });

    expect(result.cacheHit).toBe(false);
    expect(cache.get).toHaveBeenCalledWith('auditorio');
    expect(provider.lookup).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledWith('auditorio', expect.objectContaining({
      location: { source: 'provider', label: 'Zona Auditorio', latitude: 18.46, longitude: -97.39 },
      storedAtMs: 1000,
      expiresAtMs: 301000,
    }));
  });

  test('Escenario 9: Caché HIT reutiliza la entrada almacenada sin realizar una segunda consulta de red', async () => {
    const clock = createVirtualClock(1000);
    const cache = new MemoryLocationCache();
    const provider: LocationProvider = {
      lookup: jest.fn(async () => ({ label: 'Zona Biblioteca', latitude: 18.461, longitude: -97.391 })),
    };
    const lookupUseCase = new LookupIncidentLocation(provider, cache, clock, { cacheTtlMs: 300000, timeoutMs: 1000 });

    const first = await lookupUseCase.execute({ query: 'Biblioteca', manualLabel: MANUAL_LOCATION_LABEL });
    expect(first.cacheHit).toBe(false);
    expect(provider.lookup).toHaveBeenCalledTimes(1);

    // Segunda consulta idéntica (y con variaciones de espacios/mayúsculas)
    const second = await lookupUseCase.execute({ query: '  BIBLIOTECA  ', manualLabel: MANUAL_LOCATION_LABEL });
    expect(second.cacheHit).toBe(true);
    expect(second.location).toEqual(first.location);
    expect(provider.lookup).toHaveBeenCalledTimes(1); // No incrementó llamadas al proveedor
  });

  test('Escenario 10: Expiración TTL de 300 segundos descarta la entrada y provoca una nueva consulta al proveedor', async () => {
    const clock = createVirtualClock(1000);
    const cache = new MemoryLocationCache();
    const provider: LocationProvider = {
      lookup: jest.fn(async () => ({ label: 'Laboratorio 1', latitude: 18.462, longitude: -97.392 })),
    };
    const lookupUseCase = new LookupIncidentLocation(provider, cache, clock, { cacheTtlMs: 300000, timeoutMs: 1000 });

    // Consulta inicial en t = 1000 -> expiresAt = 301000
    await lookupUseCase.execute({ query: 'Laboratorio 1', manualLabel: MANUAL_LOCATION_LABEL });
    expect(provider.lookup).toHaveBeenCalledTimes(1);

    // Consulta en t = 300000 (dentro de TTL) -> HIT
    clock.advance(299000);
    const hit = await lookupUseCase.execute({ query: 'Laboratorio 1', manualLabel: MANUAL_LOCATION_LABEL });
    expect(hit.cacheHit).toBe(true);
    expect(provider.lookup).toHaveBeenCalledTimes(1);

    // Avanzamos el reloj más allá de TTL: t = 301001 (expirado) -> MISS
    clock.advance(2001);
    const expiredMiss = await lookupUseCase.execute({ query: 'Laboratorio 1', manualLabel: MANUAL_LOCATION_LABEL });
    expect(expiredMiss.cacheHit).toBe(false);
    expect(provider.lookup).toHaveBeenCalledTimes(2); // Se llamó de nuevo al proveedor
  });

  test('Escenario 11: Normalización de clave Unicode NFC y descarte de entradas corruptas en caché', async () => {
    const clock = createVirtualClock(1000);
    const entries = new Map<string, LocationCacheEntry>();
    const cache: LocationCache = {
      get: jest.fn(async (key: string) => entries.get(key) ?? null),
      put: jest.fn(async (key: string, value: LocationCacheEntry) => { entries.set(key, value); }),
    };
    const provider: LocationProvider = {
      lookup: jest.fn(async () => ({ label: 'Cafetería Central', latitude: 18.46, longitude: -97.39 })),
    };
    const lookupUseCase = new LookupIncidentLocation(provider, cache, clock, { cacheTtlMs: 300000, timeoutMs: 1000 });

    // Inyectamos entrada corrupta en la clave normalizada (coordenadas inválidas)
    entries.set('cafetería', {
      location: { source: 'provider', label: 'Café corrupto', latitude: 999, longitude: 999 } as any,
      storedAtMs: 1000,
      expiresAtMs: 301000,
    });

    // Búsqueda con string descompuesto NFD: "CAFETERI\u0301A"
    const result = await lookupUseCase.execute({
      query: '  CAFETERI\u0301A  ',
      manualLabel: MANUAL_LOCATION_LABEL,
    });

    // Detecta corrupción en caché, descarta el valor corrupto y consulta al proveedor
    expect(result.cacheHit).toBe(false);
    expect(provider.lookup).toHaveBeenCalledWith('cafetería');
    expect(result.location.label).toBe('Cafetería Central');
  });

  // =========================================================================
  // GRUPO 3: Resiliencia ante fallos de red y control de velocidad
  // =========================================================================

  test('Escenario 12: Falla por Timeout en proveedor es interceptada y permite fallback manual', async () => {
    const clock = createVirtualClock(1000);
    const timeoutFixture = createLocationFixture('timeout');
    const provider = createLocationProviderDouble(timeoutFixture, clock.sleep);
    const cache = new MemoryLocationCache();
    const lookupUseCase = new LookupIncidentLocation(provider, cache, clock);

    const result = await lookupUseCase.execute({ query: LOCATION_QUERY, manualLabel: MANUAL_LOCATION_LABEL });

    expect(result.cacheHit).toBe(false);
    expect(result.failure).toEqual({ kind: 'timeout' });
    expect(result.location).toEqual({ source: 'manual', label: MANUAL_LOCATION_LABEL });
  });

  test('Escenario 13: HTTP 429 Rate Limit y Retry-After impiden llamadas redundantes durante la ventana', async () => {
    let currentTime = 1000;
    const sendMock = jest.fn(async () => ({
      status: 429,
      headers: { 'Retry-After': '2' }, // 2 segundos = 2000 ms
      bodyText: JSON.stringify({ error: 'rate limited' }),
    }));
    const transport: IncidentTransport = { send: sendMock };
    const provider = new PhotonLocationProvider(transport, { now: () => currentTime }, { timeoutMs: 500, cacheTtlMs: 0 });

    // Primera llamada en t = 1000: recibe 429 con delay de 2000 ms -> nextAllowedMs = 3000
    const first = await provider.lookup('Edificio A');
    expect(first).toEqual({ available: false, failure: { kind: 'rate_limited', retryAfterMs: 2000 } });
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Segunda llamada en t = 2000 (aún dentro de la ventana de bloqueo): interceptada localmente
    currentTime = 2000;
    const second = await provider.lookup('Edificio A');
    expect(second).toEqual({ available: false, failure: { kind: 'rate_limited', retryAfterMs: 1000 } });
    expect(sendMock).toHaveBeenCalledTimes(1); // No envió solicitud HTTP

    // Tercera llamada en t = 3001 (tiempo expirado): se permite nueva solicitud HTTP
    currentTime = 3001;
    await provider.lookup('Edificio A');
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  test('Escenario 14: Desconexión y errores de red mapean a offline preservando la referencia manual', async () => {
    const sendMock = jest.fn(async () => {
      throw new Error('Network request failed: Connection refused');
    });
    const transport: IncidentTransport = { send: sendMock };
    const provider = new PhotonLocationProvider(transport, { now: () => 1000 });

    const raw = await provider.lookup('Edificio C');
    expect(raw).toEqual({ available: false, failure: { kind: 'offline' } });

    // Al evaluar con la referencia manual, devuelve la ubicación manual con la falla asociada
    const evaluated = evaluateIncidentLocation(raw, 'Cerca de caseta 2');
    expect(evaluated.failure).toEqual({ kind: 'offline' });
    expect(evaluated.location).toEqual({ source: 'manual', label: 'Cerca de caseta 2' });
  });

  // =========================================================================
  // GRUPO 4: Interfaz de usuario (CreateIncidentScreen) y continuidad manual
  // =========================================================================

  test('Escenario 15: Alternativa manual funcional registra la incidencia sin interactuar con el proveedor', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const providerMock = jest.fn();
    const useCase = new LookupIncidentLocation({ lookup: providerMock }, new MemoryLocationCache(), { now: () => 1000 });

    const view = await render(
      <CreateIncidentScreen
        loading={false}
        error={null}
        lookupIncidentLocation={useCase}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    await fireEvent.changeText(view.getByTestId('create-description-input'), 'Lámpara fundida en pasillo');
    await fireEvent.changeText(view.getByTestId('create-location-input'), 'Pasillo Edificio C planta baja');

    await fireEvent.press(view.getByTestId('create-submit-button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      category: 'connectivity', // Valor por defecto
      description: 'Lámpara fundida en pasillo',
      locationLabel: 'Pasillo Edificio C planta baja',
    });
    expect(providerMock).not.toHaveBeenCalled();
  });

  test('Escenario 16: Preservación de locationLabel tras fallo de búsqueda en Photon', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const failingProvider: LocationProvider = {
      lookup: jest.fn(async () => ({ available: false, failure: { kind: 'timeout' } })),
    };
    const useCase = new LookupIncidentLocation(failingProvider, new MemoryLocationCache(), { now: () => 1000 });

    const view = await render(
      <CreateIncidentScreen
        loading={false}
        error={null}
        lookupIncidentLocation={useCase}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    // El usuario ingresa su referencia manual
    await fireEvent.changeText(view.getByTestId('create-description-input'), 'Fuga menor en lavabo');
    await fireEvent.changeText(view.getByTestId('create-location-input'), 'Baños de planta alta aula magna');

    // Intenta buscar en Photon una consulta que hace timeout
    await fireEvent.changeText(view.getByTestId('location-query-input'), 'Aula Magna');
    await fireEvent.press(view.getByTestId('location-search-button'));

    // Espera a que termine la búsqueda y se muestre el mensaje de error/fallback
    await waitFor(() => {
      expect(view.getByTestId('location-status')).toHaveTextContent(/tardó demasiado/i);
    });

    // La referencia manual en el input permanece inalterada
    expect(view.getByTestId('create-location-input').props.value).toBe('Baños de planta alta aula magna');

    // Envía el formulario
    await fireEvent.press(view.getByTestId('create-submit-button'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      locationLabel: 'Baños de planta alta aula magna',
    }));
  });

  test('Escenario 17: Envío de ubicación manual sin coordenadas inventadas tras rechazar candidato', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const validProvider: LocationProvider = {
      lookup: jest.fn(async () => ({ label: 'Zona Geocodificada 123', latitude: 18.5, longitude: -97.4 })),
    };
    const useCase = new LookupIncidentLocation(validProvider, new MemoryLocationCache(), { now: () => 1000 });

    const view = await render(
      <CreateIncidentScreen
        loading={false}
        error={null}
        lookupIncidentLocation={useCase}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    await fireEvent.changeText(view.getByTestId('create-description-input'), 'Proyector sin señal HDMI');
    await fireEvent.changeText(view.getByTestId('create-location-input'), 'Laboratorio de Cómputo 3');

    // Busca ubicación en el proveedor
    await fireEvent.changeText(view.getByTestId('location-query-input'), 'Computo 3');
    await fireEvent.press(view.getByTestId('location-search-button'));

    await waitFor(() => {
      expect(view.getByTestId('location-candidate')).toHaveTextContent('Zona Geocodificada 123');
    });

    // El usuario decide explícitamente usar la ubicación manual
    await fireEvent.press(view.getByTestId('location-manual-button'));

    // Envía el formulario
    await fireEvent.press(view.getByTestId('create-submit-button'));

    expect(onSubmit).toHaveBeenCalledWith({
      category: 'connectivity',
      description: 'Proyector sin señal HDMI',
      locationLabel: 'Laboratorio de Cómputo 3',
    });
  });

  test('Escenario 18: Estado de error visible y recuperación mediante cambio de consulta o manual', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    let shouldFail = true;
    const dynamicProvider: LocationProvider = {
      lookup: jest.fn(async (q: string) => {
        if (shouldFail) return { available: false, failure: { kind: 'offline' } };
        return { label: `Resultado para ${q}`, latitude: 18.46, longitude: -97.39 };
      }),
    };
    const useCase = new LookupIncidentLocation(dynamicProvider, new MemoryLocationCache(), { now: () => 1000 });

    const view = await render(
      <CreateIncidentScreen
        loading={false}
        error={null}
        lookupIncidentLocation={useCase}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    await fireEvent.changeText(view.getByTestId('create-description-input'), 'Falla de energía');
    await fireEvent.changeText(view.getByTestId('create-location-input'), 'Edificio D');

    // 1. Intento fallido
    await fireEvent.changeText(view.getByTestId('location-query-input'), 'Zona Sin Red');
    await fireEvent.press(view.getByTestId('location-search-button'));

    await waitFor(() => {
      expect(view.getByTestId('location-status')).toHaveTextContent(/conexión/i);
    });
    expect(view.queryByTestId('location-candidate')).toBeNull();

    // 2. Recuperación: el proveedor vuelve a estar disponible y el usuario realiza otra búsqueda
    shouldFail = false;
    await fireEvent.changeText(view.getByTestId('location-query-input'), 'Zona Conectada');
    await fireEvent.press(view.getByTestId('location-search-button'));

    await waitFor(() => {
      expect(view.getByTestId('location-candidate')).toHaveTextContent('Resultado para zona conectada');
    });
    expect(view.getByTestId('location-status')).toHaveTextContent(/resultado disponible/i);

    // Acepta el candidato recuperado y envía
    await fireEvent.press(view.getByTestId('location-accept-button'));
    await fireEvent.press(view.getByTestId('create-submit-button'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      locationLabel: 'Resultado para zona conectada',
    }));
  });
});

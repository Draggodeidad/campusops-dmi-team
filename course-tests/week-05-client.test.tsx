import { fireEvent, render, waitFor } from '@testing-library/react-native';

import App from '../App';
import { ApplicationFailure } from '../src/application/errors/ApplicationFailure';
import { CreateIncident } from '../src/application/incidents/CreateIncident';
import { parseRemoteResource } from '../src/course-evaluation';
import type {
  IncidentTransport,
  TransportRequest,
  TransportResponse,
} from '../src/infrastructure/http/IncidentTransport';
import { mapDtoToIncident } from '../src/infrastructure/incidents/dto/IncidentDtoMapper';
import { FakeIncidentRepository } from '../src/infrastructure/incidents/FakeIncidentRepository';
import { HttpIncidentRepository } from '../src/infrastructure/incidents/HttpIncidentRepository';
import { CreateIncidentScreen } from '../src/ui/incidents/CreateIncidentScreen';

jest.mock('../src/api/courseBackend', () => ({
  getBackendHealth: jest.fn().mockResolvedValue({
    ok: true,
    service: 'dmi-controlled-backend',
    contractVersion: 1,
  }),
}));

describe('HU #28 — Contrato y Cliente Remoto', () => {
  describe('A. parseRemoteResource', () => {
    it('acepta sobre válido con payload objeto', () => {
      const res = parseRemoteResource({
        id: 'inc-100',
        version: 1,
        status: 'open',
        payload: { category: 'connectivity', description: 'Sin wifi' },
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.id).toBe('inc-100');
        expect(res.value.version).toBe(1);
        expect(res.value.status).toBe('open');
        expect(res.value.payload).toEqual({ category: 'connectivity', description: 'Sin wifi' });
      }
    });

    it('acepta sobre válido con payload null', () => {
      const res = parseRemoteResource({
        id: 'inc-101',
        version: 0,
        status: 'closed',
        payload: null,
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.payload).toBeNull();
      }
    });

    it('ignora campos adicionales futuros en el sobre (forward-compatible)', () => {
      const res = parseRemoteResource({
        id: 'inc-102',
        version: 4,
        status: 'in_progress',
        payload: { category: 'water' },
        extraMeta: 'futuro',
        nestedFuture: { code: 99 },
      });
      expect(res.ok).toBe(true);
    });

    it('rechaza sobres con id vacío o no textual', () => {
      expect(parseRemoteResource({ id: '', version: 1, status: 'open', payload: null }).ok).toBe(
        false,
      );
      expect(parseRemoteResource({ id: '   ', version: 1, status: 'open', payload: null }).ok).toBe(
        false,
      );
      expect(parseRemoteResource({ id: 123, version: 1, status: 'open', payload: null }).ok).toBe(
        false,
      );
    });

    it('rechaza sobres con status vacío o no textual', () => {
      expect(parseRemoteResource({ id: 'inc-1', version: 1, status: '', payload: null }).ok).toBe(
        false,
      );
      expect(parseRemoteResource({ id: 'inc-1', version: 1, status: null, payload: null }).ok).toBe(
        false,
      );
    });

    it('rechaza sobres con version negativa, decimal o string', () => {
      expect(parseRemoteResource({ id: 'inc-1', version: -1, status: 'open', payload: null }).ok).toBe(
        false,
      );
      expect(parseRemoteResource({ id: 'inc-1', version: 1.5, status: 'open', payload: null }).ok).toBe(
        false,
      );
      expect(parseRemoteResource({ id: 'inc-1', version: '2', status: 'open', payload: null }).ok).toBe(
        false,
      );
    });

    it('rechaza entradas nulas, arreglos o primitivos', () => {
      expect(parseRemoteResource(null).ok).toBe(false);
      expect(parseRemoteResource(undefined).ok).toBe(false);
      expect(parseRemoteResource([]).ok).toBe(false);
      expect(parseRemoteResource('texto-plano').ok).toBe(false);
      expect(parseRemoteResource(42).ok).toBe(false);
    });

    it('rechaza sobre con payload que no sea objeto o null (e.g. array o número)', () => {
      expect(parseRemoteResource({ id: 'inc-1', version: 1, status: 'open', payload: [1, 2] }).ok).toBe(
        false,
      );
      expect(parseRemoteResource({ id: 'inc-1', version: 1, status: 'open', payload: 123 }).ok).toBe(
        false,
      );
    });
  });

  describe('B. Separación DTO vs Dominio (mapDtoToIncident)', () => {
    it('mapea correctamente un sobre completo derivando el título', () => {
      const incident = mapDtoToIncident({
        id: 'campus-inc-001',
        version: 1,
        status: 'open',
        payload: {
          category: 'electrical',
          description: 'Falla eléctrica en tablero principal',
          location: 'Edificio Central',
        },
      });

      expect(incident).toEqual({
        id: 'campus-inc-001',
        title: 'Falla eléctrica en tablero principal',
        description: 'Falla eléctrica en tablero principal',
        category: 'electrical',
        status: 'open',
        locationLabel: 'Edificio Central',
      });
    });

    it('trunca descripciones largas al derivar el título de presentación', () => {
      const longDescription =
        'Esta es una descripción sumamente extensa que excede los cuarenta caracteres permitidos para el título';
      const incident = mapDtoToIncident({
        id: 'inc-200',
        version: 1,
        status: 'assigned',
        payload: {
          category: 'laboratory',
          description: longDescription,
          location: 'Lab 1',
        },
      });

      expect(incident?.title.length).toBeLessThanOrEqual(40);
      expect(incident?.title.endsWith('...')).toBe(true);
    });

    it('retorna null cuando el payload es null sin inventar datos falsos', () => {
      const incident = mapDtoToIncident({
        id: 'inc-null-payload',
        version: 2,
        status: 'closed',
        payload: null,
      });

      expect(incident).toBeNull();
    });

    it('retorna null si la categoría o estado no pertenecen al vocabulario del dominio', () => {
      expect(
        mapDtoToIncident({
          id: 'inc-bad-cat',
          version: 1,
          status: 'open',
          payload: { category: 'categoria_inexistente', description: 'Desc', location: 'Loc' },
        }),
      ).toBeNull();

      expect(
        mapDtoToIncident({
          id: 'inc-bad-status',
          version: 1,
          status: 'status_invalido',
          payload: { category: 'water', description: 'Desc', location: 'Loc' },
        }),
      ).toBeNull();
    });
  });

  describe('C. HttpIncidentRepository con transporte controlado', () => {
    it('findAll devuelve lista de incidencias válidas ignorando sobres corruptos', async () => {
      const stubTransport: IncidentTransport = {
        send: async () => ({
          status: 200,
          headers: { 'content-type': 'application/json' },
          bodyText: JSON.stringify({
            items: [
              {
                id: 'inc-1',
                version: 1,
                status: 'open',
                payload: { category: 'water', description: 'Fuga', location: 'Patio' },
              },
              {
                id: 'inc-corrupt',
                version: -5,
                status: 'open',
                payload: null,
              },
            ],
          }),
        }),
      };

      const repo = new HttpIncidentRepository(stubTransport);
      const items = await repo.findAll();

      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe('inc-1');
      expect(items[0]?.category).toBe('water');
    });

    it('findById retorna null ante código HTTP 404', async () => {
      const stubTransport: IncidentTransport = {
        send: async () => ({
          status: 404,
          headers: {},
          bodyText: JSON.stringify({ code: 'not_found' }),
        }),
      };

      const repo = new HttpIncidentRepository(stubTransport);
      const result = await repo.findById('inc-inexistente');
      expect(result).toBeNull();
    });

    it('lanza ApplicationFailure ante error 500 del servidor', async () => {
      const stubTransport: IncidentTransport = {
        send: async () => ({
          status: 500,
          headers: {},
          bodyText: JSON.stringify({ code: 'controlled_failure' }),
        }),
      };

      const repo = new HttpIncidentRepository(stubTransport);
      await expect(repo.findAll()).rejects.toThrow(ApplicationFailure);
    });

    it('captura timeout y lanza ApplicationFailure con código INCIDENT_TIMEOUT', async () => {
      const stubTransport: IncidentTransport = {
        send: async () => {
          const timeoutErr = new Error('Timed out');
          timeoutErr.name = 'TimeoutError';
          throw timeoutErr;
        },
      };

      const repo = new HttpIncidentRepository(stubTransport);
      await expect(repo.findById('inc-1')).rejects.toMatchObject({
        code: 'INCIDENT_TIMEOUT',
      });
    });

    it('preserva la misma Idempotency-Key en create si es provista', async () => {
      let recordedKey = '';
      const stubTransport: IncidentTransport = {
        send: async (req: TransportRequest): Promise<TransportResponse> => {
          recordedKey = req.headers?.['idempotency-key'] ?? '';
          return {
            status: 201,
            headers: {},
            bodyText: JSON.stringify({
              incident: {
                id: 'inc-new-1',
                version: 1,
                status: 'open',
                payload: {
                  category: 'connectivity',
                  description: 'Wifi caído',
                  location: 'Lab A',
                },
              },
              operationId: recordedKey,
              duplicate: false,
            }),
          };
        },
      };

      const repo = new HttpIncidentRepository(stubTransport);
      const providedKey = 'mi-clave-estable-12345';
      const created = await repo.create({
        category: 'connectivity',
        description: 'Wifi caído',
        locationLabel: 'Lab A',
        idempotencyKey: providedKey,
      });

      expect(recordedKey).toBe(providedKey);
      expect(created.id).toBe('inc-new-1');
    });
  });
});

describe('HU #29 — Casos de Uso y UI de Creación', () => {
  describe('CreateIncident use case', () => {
    it('valida campos requeridos antes de invocar el repositorio', async () => {
      const repo = new FakeIncidentRepository();
      const useCase = new CreateIncident(repo);

      await expect(
        useCase.execute({
          category: 'water',
          description: '',
          locationLabel: 'Edificio A',
        }),
      ).rejects.toMatchObject({
        code: 'INVALID_INCIDENT_INPUT',
      });

      await expect(
        useCase.execute({
          category: 'water',
          description: 'Fuga de agua',
          locationLabel: '   ',
        }),
      ).rejects.toMatchObject({
        code: 'INVALID_INCIDENT_INPUT',
      });
    });

    it('crea exitosamente una incidencia con FakeIncidentRepository', async () => {
      const repo = new FakeIncidentRepository();
      const useCase = new CreateIncident(repo);

      const created = await useCase.execute({
        category: 'equipment',
        description: 'Computadora no enciende',
        locationLabel: 'Taller 3',
      });

      expect(created.id).toBeTruthy();
      expect(created.category).toBe('equipment');
      expect(created.description).toBe('Computadora no enciende');

      const all = await repo.findAll();
      expect(all.some((inc) => inc.id === created.id)).toBe(true);
    });
  });

  describe('CreateIncidentScreen UI', () => {
    it('valida campos y llama a onSubmit al enviar', async () => {
      const mockSubmit = jest.fn();
      const mockCancel = jest.fn();

      const view = await render(
        <CreateIncidentScreen
          error={null}
          loading={false}
          onCancel={mockCancel}
          onSubmit={mockSubmit}
        />,
      );

      // Intento enviar sin llenar
      await fireEvent.press(view.getByTestId('create-submit-button'));
      await waitFor(() => expect(view.getByTestId('create-incident-error')).toBeTruthy());
      expect(mockSubmit).not.toHaveBeenCalled();

      // Llenar campos
      fireEvent.changeText(view.getByTestId('create-description-input'), 'Fuga en el baño');
      await waitFor(() =>
        expect(view.getByTestId('create-description-input').props.value).toBe('Fuga en el baño'),
      );

      fireEvent.changeText(view.getByTestId('create-location-input'), 'Piso 2');
      await waitFor(() =>
        expect(view.getByTestId('create-location-input').props.value).toBe('Piso 2'),
      );

      await fireEvent.press(view.getByTestId('category-water'));

      await fireEvent.press(view.getByTestId('create-submit-button'));
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          category: 'water',
          description: 'Fuga en el baño',
          locationLabel: 'Piso 2',
        });
      });
    });

    it('muestra indicador de carga mientras se procesa', async () => {
      const view = await render(
        <CreateIncidentScreen
          error={null}
          loading={true}
          onCancel={jest.fn()}
          onSubmit={jest.fn()}
        />,
      );

      expect(view.getByTestId('create-loading-indicator')).toBeTruthy();
    });
  });

  describe('CampusOpsApp e integración de creación con App', () => {
    it('permite abrir el formulario de creación, reportar y volver a la lista actualizada', async () => {
      const view = await render(<App />);

      await waitFor(() =>
        expect(view.getByText('Fuga de agua en laboratorio')).toBeTruthy(),
      );

      // Abrir formulario
      await fireEvent.press(view.getByTestId('open-create-incident'));
      await waitFor(() =>
        expect(view.getByText('Reportar Incidencia')).toBeTruthy(),
      );

      // Llenar y enviar
      fireEvent.changeText(
        view.getByTestId('create-description-input'),
        'Nueva incidencia reportada',
      );
      await waitFor(() =>
        expect(view.getByTestId('create-description-input').props.value).toBe(
          'Nueva incidencia reportada',
        ),
      );

      fireEvent.changeText(view.getByTestId('create-location-input'), 'Canchas');
      await waitFor(() =>
        expect(view.getByTestId('create-location-input').props.value).toBe('Canchas'),
      );

      await fireEvent.press(view.getByTestId('create-submit-button'));

      // Regresa a lista y contiene el nuevo ítem
      await waitFor(() =>
        expect(view.getByText('Nueva incidencia reportada')).toBeTruthy(),
      );
    });
  });
});

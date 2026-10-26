import { deduplicateOperations } from '../src/application/sync/deduplicateOperations';
import { resolveSync } from '../src/application/sync/resolveSync';
import type { SyncRecord } from '../src/domain/sync/SyncRecord';
import { createWeek08Scenario } from './fixtures/week-08/scenario';

/**
 * Suite de pruebas complementaria e independiente para la Issue #48 (Semana 08)
 * Responsable: osbaldoXxC
 *
 * Valida de forma exhaustiva, determinista y pura:
 * - Algoritmo de Three-Way Merge de campos (`resolveSync`).
 * - Detección atómica de conflictos sin Last-Write-Wins (LWW) silencioso.
 * - Equivalencia por contenido JSON profundo e indiferencia al orden de propiedades.
 * - Deduplicación estable y preservación del primer objeto y orden FIFO (`deduplicateOperations`).
 * - Inmutabilidad estricta de todas las estructuras de entrada (`base`, `local`, `remote`).
 */

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function createRecord(fields: SyncRecord['fields'], version = 1, id = 'campus-inc-001'): SyncRecord {
  return { id, version, fields };
}

describe('CampusOps W08 — Issue #48: Pruebas de merge, conflictos y deduplicación sin mutaciones', () => {

  describe('Grupo A: Merge sin modificaciones (No-op merge)', () => {
    test('A1: base, local y remote con campos equivalentes resuelven en merged sin conflicto', () => {
      const fields = { category: 'electric', priority: 2, meta: { tags: ['urgent'] } };
      const base = deepFreeze(createRecord(fields, 1));
      const local = deepFreeze(createRecord(fields, 1));
      const remote = deepFreeze(createRecord(fields, 2));

      const before = JSON.stringify([base, local, remote]);
      const result = resolveSync(base, local, remote);

      expect(result).toEqual({ kind: 'merged', fields });
      expect(JSON.stringify([base, local, remote])).toBe(before);
    });
  });

  describe('Grupo B: Modificación exclusivamente local', () => {
    test('B1: cambio exclusivo en local preserva el valor local y no genera conflicto', () => {
      const base = deepFreeze(createRecord({ status: 'open', severity: 'low' }, 1));
      const local = deepFreeze(createRecord({ status: 'in_progress', severity: 'low' }, 1));
      const remote = deepFreeze(createRecord({ status: 'open', severity: 'low' }, 2));

      const before = JSON.stringify([base, local, remote]);
      const result = resolveSync(base, local, remote);

      expect(result).toEqual({
        kind: 'merged',
        fields: { status: 'in_progress', severity: 'low' },
      });
      expect(JSON.stringify([base, local, remote])).toBe(before);
    });

    test('B2: adición exclusiva de campo en local se incorpora en el merge', () => {
      const base = deepFreeze(createRecord({ status: 'open' }, 1));
      const local = deepFreeze(createRecord({ status: 'open', localFlag: true }, 1));
      const remote = deepFreeze(createRecord({ status: 'open' }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'merged',
        fields: { status: 'open', localFlag: true },
      });
    });

    test('B3: eliminación de campo en local se respeta cuando remote no cambió', () => {
      const base = deepFreeze(createRecord({ title: 'Gotera', legacyFlag: true }, 1));
      const local = deepFreeze(createRecord({ title: 'Gotera' }, 1));
      const remote = deepFreeze(createRecord({ title: 'Gotera', legacyFlag: true }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'merged',
        fields: { title: 'Gotera' },
      });
    });
  });

  describe('Grupo C: Modificación exclusivamente remota', () => {
    test('C1: cambio exclusivo en remote se adopta sin conflicto', () => {
      const base = deepFreeze(createRecord({ area: 'Edificio A', buildingCode: 101 }, 1));
      const local = deepFreeze(createRecord({ area: 'Edificio A', buildingCode: 101 }, 1));
      const remote = deepFreeze(createRecord({ area: 'Edificio A', buildingCode: 102 }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'merged',
        fields: { area: 'Edificio A', buildingCode: 102 },
      });
    });

    test('C2: adición exclusiva de campo en remote se incorpora sin conflicto', () => {
      const base = deepFreeze(createRecord({ title: 'Alumbrado' }, 1));
      const local = deepFreeze(createRecord({ title: 'Alumbrado' }, 1));
      const remote = deepFreeze(createRecord({ title: 'Alumbrado', remoteAuditNote: 'revisado' }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'merged',
        fields: { title: 'Alumbrado', remoteAuditNote: 'revisado' },
      });
    });

    test('C3: eliminación de campo en remote se adopta cuando local no cambió', () => {
      const base = deepFreeze(createRecord({ title: 'Fuga', tempMarker: 'obsolete' }, 1));
      const local = deepFreeze(createRecord({ title: 'Fuga', tempMarker: 'obsolete' }, 1));
      const remote = deepFreeze(createRecord({ title: 'Fuga' }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'merged',
        fields: { title: 'Fuga' },
      });
    });
  });

  describe('Grupo D: Cambios independientes combinados', () => {
    test('D1: local y remote modifican campos distintos y ambos se combinan en el resultado', () => {
      const base = deepFreeze(createRecord({ priority: 1, category: 'plumbing', notesCount: 0 }, 1));
      const local = deepFreeze(createRecord({ priority: 2, category: 'plumbing', notesCount: 0 }, 1));
      const remote = deepFreeze(createRecord({ priority: 1, category: 'maintenance', notesCount: 0 }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'merged',
        fields: { priority: 2, category: 'maintenance', notesCount: 0 },
      });
    });

    test('D2: adiciones independientes en local y remote se combinan sin colisión', () => {
      const base = deepFreeze(createRecord({ title: 'Ventana rota' }, 1));
      const local = deepFreeze(createRecord({ title: 'Ventana rota', localUrgency: 'high' }, 1));
      const remote = deepFreeze(createRecord({ title: 'Ventana rota', supervisorAck: true }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'merged',
        fields: { title: 'Ventana rota', localUrgency: 'high', supervisorAck: true },
      });
    });
  });

  describe('Grupo E: Equivalencia JSON por contenido e indiferencia al orden de claves', () => {
    test('E1: objetos anidados con orden de propiedades permutado son considerados idénticos', () => {
      const base = deepFreeze(createRecord({ payload: { x: 10, y: { a: 'foo', b: 'bar' } } }, 1));
      const local = deepFreeze(createRecord({ payload: { y: { b: 'bar', a: 'foo' }, x: 10 } }, 1));
      const remote = deepFreeze(createRecord({ payload: { x: 10, y: { a: 'foo', b: 'bar' } } }, 2));

      const result = resolveSync(base, local, remote);
      expect(result.kind).toBe('merged');
      if (result.kind === 'merged') {
        expect(result.fields.payload).toEqual({ x: 10, y: { a: 'foo', b: 'bar' } });
      }
    });

    test.each(['local/remote', 'remote/local'] as const)(
      'E4: cambios concurrentes a JSON equivalente con claves anidadas permutadas (%s)',
      order => {
        const base = deepFreeze(createRecord({ payload: { revision: 'anterior' } }, 1));
        const localPayload = {
          revision: 'nueva',
          details: { enabled: true, nested: { label: 'sintético', count: 2 } },
          items: [{ code: 'A', meta: { x: 1, y: [true, null] } }],
        };
        const remotePayload = {
          items: [{ meta: { y: [true, null], x: 1 }, code: 'A' }],
          details: { nested: { count: 2, label: 'sintético' }, enabled: true },
          revision: 'nueva',
        };
        // Referencias separadas y orden diferente incluso dentro de arrays/objetos.
        expect(localPayload).not.toBe(remotePayload);
        expect(localPayload.details.nested).not.toBe(remotePayload.details.nested);
        expect(localPayload.items[0]?.meta).not.toBe(remotePayload.items[0]?.meta);
        expect(JSON.stringify(localPayload)).not.toBe(JSON.stringify(remotePayload));
        const local = deepFreeze(createRecord({ payload: localPayload }, 1));
        const remote = deepFreeze(createRecord({ payload: remotePayload }, 2));
        const before = JSON.stringify([base, local, remote]);
        const [left, right] = order === 'local/remote' ? [local, remote] : [remote, local];

        expect(resolveSync(base, left, right)).toEqual({
          kind: 'merged',
          fields: { payload: localPayload },
        });
        expect(JSON.stringify([base, local, remote])).toBe(before);
      },
    );

    test('E2: reordenar un array sólo en local conserva ese orden en el merge', () => {
      const base = deepFreeze(createRecord({ tags: ['urgent', 'electric'] }, 1));
      const local = deepFreeze(createRecord({ tags: ['electric', 'urgent'] }, 1));
      const remote = deepFreeze(createRecord({ tags: ['urgent', 'electric'] }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'merged',
        fields: { tags: ['electric', 'urgent'] },
      });
    });

    test('E3: distingue tipos escalares estrictos (número vs string y null vs objeto vacío)', () => {
      // Caso 1: número vs string sobre el mismo campo con base null -> ambos cambian a valores distintos -> conflicto
      const baseScalar = deepFreeze(createRecord({ count: null }, 1));
      const localScalar = deepFreeze(createRecord({ count: 1 }, 1));
      const remoteScalar = deepFreeze(createRecord({ count: '1' }, 2));

      const resultScalar = resolveSync(baseScalar, localScalar, remoteScalar);
      expect(resultScalar).toEqual({
        kind: 'conflict',
        fields: ['count'],
      });

      // Caso 2: null vs objeto vacío sobre el mismo campo con base ausente -> ambos agregan valores distintos -> conflicto
      const baseEmpty = deepFreeze(createRecord({}, 1));
      const localNull = deepFreeze(createRecord({ details: null }, 1));
      const remoteObj = deepFreeze(createRecord({ details: {} }, 2));

      const resultObj = resolveSync(baseEmpty, localNull, remoteObj);
      expect(resultObj).toEqual({
        kind: 'conflict',
        fields: ['details'],
      });
    });
  });

  describe('Grupo F: Conflicto sobre el mismo campo y ausencia de Last-Write-Wins', () => {
    test('F1: mutaciones simultáneas incompatibles sobre el mismo campo reportan conflict sin LWW', () => {
      const base = deepFreeze(createRecord({ assignedTo: 'tecnico-base' }, 1));
      const local = deepFreeze(createRecord({ assignedTo: 'tecnico-local' }, 1));
      const remote = deepFreeze(createRecord({ assignedTo: 'tecnico-remoto' }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'conflict',
        fields: ['assignedTo'],
      });

      // Simetría estricta: invertir local y remote debe dar el mismo conflicto
      const symmetric = resolveSync(base, remote, local);
      expect(symmetric).toEqual({
        kind: 'conflict',
        fields: ['assignedTo'],
      });
    });

    test('F2: edición versus eliminación sobre el mismo campo genera conflicto', () => {
      const base = deepFreeze(createRecord({ description: 'Detalle inicial' }, 1));
      const local = deepFreeze(createRecord({}, 1)); // eliminado en local
      const remote = deepFreeze(createRecord({ description: 'Detalle editado remotamente' }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'conflict',
        fields: ['description'],
      });
    });
  });

  describe('Grupo G: Orden determinista de conflictos', () => {
    test('G1: múltiples campos en conflicto siempre se ordenan alfabéticamente', () => {
      const base = deepFreeze(createRecord({ z_field: 0, a_field: 0, m_field: 0, ok_field: 'same' }, 1));
      const local = deepFreeze(createRecord({ z_field: 1, a_field: 1, m_field: 1, ok_field: 'same' }, 1));
      const remote = deepFreeze(createRecord({ z_field: 2, a_field: 2, m_field: 2, ok_field: 'same' }, 2));

      const result = resolveSync(base, local, remote);
      expect(result).toEqual({
        kind: 'conflict',
        fields: ['a_field', 'm_field', 'z_field'],
      });
    });
  });

  describe('Grupo H: Escenario oficial obligatorio campus-inc-001', () => {
    test('H1: reasignación remota vs inicio local en campus-inc-001 produce conflicto atómico en work', () => {
      const scenario = deepFreeze(createWeek08Scenario('file:///synthetic.svg'));

      const beforeBase = JSON.stringify(scenario.base);
      const beforeLocal = JSON.stringify(scenario.local);
      const beforeRemote = JSON.stringify(scenario.remote);

      const result = resolveSync(scenario.base, scenario.local, scenario.remote);

      // El campo 'work' es indivisible; status y assignedTechnicianId colisionan a nivel de campo work
      expect(result).toEqual({
        kind: 'conflict',
        fields: ['work'],
      });

      // Comprobar que ninguna estructura fue mutada en memoria
      expect(JSON.stringify(scenario.base)).toBe(beforeBase);
      expect(JSON.stringify(scenario.local)).toBe(beforeLocal);
      expect(JSON.stringify(scenario.remote)).toBe(beforeRemote);
    });
  });

  describe('Grupo I: Inmutabilidad estricta y seguridad de prototipos', () => {
    test('I1: entradas profundamente congeladas no sufren mutación alguna', () => {
      const nested = { level1: { level2: { counter: 42, list: [1, 2, 3] } } };
      const base = deepFreeze(createRecord(nested, 1));
      const local = deepFreeze(createRecord({ level1: { level2: { counter: 43, list: [1, 2, 3] } } }, 1));
      const remote = deepFreeze(createRecord(nested, 2));

      expect(Object.isFrozen(base)).toBe(true);
      expect(Object.isFrozen(base.fields)).toBe(true);
      expect(Object.isFrozen((base.fields as typeof nested).level1.level2.list)).toBe(true);

      const result = resolveSync(base, local, remote);
      expect(result.kind).toBe('merged');
    });

    test('I2: campos especiales de prototipo (__proto__, constructor) sobreviven como propiedades propias', () => {
      const customPayload = JSON.parse('{"__proto__":{"sanitized":false},"constructor":"plain_string"}');
      const base = deepFreeze(createRecord({}, 1));
      const local = deepFreeze(createRecord(customPayload, 1));
      const remote = deepFreeze(createRecord({}, 2));

      const result = resolveSync(base, local, remote);
      expect(result.kind).toBe('merged');
      if (result.kind === 'merged') {
        expect(Object.getPrototypeOf(result.fields)).toBe(Object.prototype);
        expect(Object.prototype.hasOwnProperty.call(result.fields, '__proto__')).toBe(true);
      }
    });
  });

  describe('Grupo J: Deduplicación de operaciones pendientes', () => {
    test('J1: lista vacía retorna array vacío sin mutaciones', () => {
      const empty: readonly { operationId: string }[] = deepFreeze([]);
      const result = deduplicateOperations(empty);
      expect(result).toEqual([]);
      expect(result).not.toBe(empty);
    });

    test('J2: conserva el primer objeto exacto, orden de inserción y descarta repeticiones con distinto cuerpo', () => {
      const op1 = { operationId: 'op-alpha', action: 'start', payload: { step: 1 } };
      const op2 = { operationId: 'op-beta', action: 'comment', payload: { text: 'hola' } };
      const op1DuplicateWithDifferentPayload = { operationId: 'op-alpha', action: 'start', payload: { step: 999 } };
      const op3 = { operationId: 'op-gamma', action: 'resolve', payload: {} };
      const op2Duplicate = { operationId: 'op-beta', action: 'comment', payload: { text: 'hola' } };

      const input = deepFreeze([op1, op2, op1DuplicateWithDifferentPayload, op3, op2Duplicate]);
      const before = JSON.stringify(input);

      const result = deduplicateOperations(input);

      // Conserva exactamente 3 operaciones en orden alpha -> beta -> gamma
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(op1);
      expect(result[1]).toBe(op2);
      expect(result[2]).toBe(op3);

      // El payload debe ser el del primer objeto, no del duplicado
      expect(result[0]?.payload).toEqual({ step: 1 });

      // Inmutabilidad de la entrada
      expect(JSON.stringify(input)).toBe(before);
    });

    test('J3: deduplicación es idempotente y no genera IDs sintéticos', () => {
      const scenario = deepFreeze(createWeek08Scenario('file:///synthetic.svg'));
      const list = deepFreeze([scenario.operation, scenario.noteOperation, scenario.photoOperation]);

      const deduplicatedOnce = deduplicateOperations(list);
      const deduplicatedTwice = deduplicateOperations(deduplicatedOnce);

      expect(deduplicatedOnce).toEqual(list);
      expect(deduplicatedTwice).toEqual(deduplicatedOnce);
    });
  });
});

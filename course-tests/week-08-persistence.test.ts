import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createNodeWorkspace } from './fixtures/week-08/nodeWorkspace';
import { createTemporaryWorkspace } from './fixtures/week-08/temporaryWorkspace';
import { createWeek08Scenario, SYNTHETIC_PHOTO } from './fixtures/week-08/scenario';
import type { PendingIncidentOperation } from '../src/campusops/contracts';

/**
 * Suite de pruebas oficial para la Issue #47 (Semana 08)
 * Responsable: osbaldoXxC
 *
 * Valida:
 * Grupo A: Persistencia durable, reinicio del workspace y orden FIFO.
 * Grupo B: Migración exitosa de esquema v1 a v2.
 * Grupo C: Rollback atómico en migración ante fallas inyectadas.
 * Grupo D: Rollback atómico en operaciones de workspace (commitChange, enqueue, acknowledge).
 * Grupo E: Reglas de integridad, detección de datos inválidos y aislamiento.
 */

async function setupWorkspace(version = 2) {
  const fixture = await createTemporaryWorkspace(options => createNodeWorkspace(options, version));
  const workspace = await fixture.reopen();
  const scenario = createWeek08Scenario(fixture.photoUri);
  return { fixture, workspace, ...scenario };
}

function queryDatabaseDetails(dbPath: string) {
  const db = new DatabaseSync(dbPath);
  try {
    return {
      version: db.prepare('PRAGMA user_version').get() as { user_version: number },
      tables: db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[],
      indices: db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[],
      snapshots: db.prepare('SELECT * FROM snapshots ORDER BY incident_id').all() as Record<string, unknown>[],
      pending: db.prepare('SELECT * FROM pending_operations ORDER BY sequence').all() as Record<string, unknown>[],
    };
  } finally {
    db.close();
  }
}

describe('CampusOps W08 — Issue #47: Pruebas de reinicio, migración y rollback del almacén local', () => {

  describe('Grupo A: Persistencia y reinicio durable', () => {
    test('A1: reapertura conserva autor, versión base, notas, adjunto durable y orden exacto FIFO', async () => {
      const s = await setupWorkspace(2);
      try {
        await s.workspace.commitChange(s.snapshot, s.operation);
        await s.workspace.pending.enqueue(s.noteOperation);
        await s.workspace.pending.enqueue(s.photoOperation);

        // Reabrir en una instancia fresca de LocalWorkspace
        const reopenedWorkspace = await s.fixture.reopen();
        expect(reopenedWorkspace).not.toBe(s.workspace);

        // Validar integridad de snapshot y operaciones recuperadas
        const restoredSnapshot = await reopenedWorkspace.getSnapshot(s.base.id);
        expect(restoredSnapshot).toEqual(s.snapshot);

        const restoredPending = await reopenedWorkspace.pending.listPending();
        expect(restoredPending).toHaveLength(3);
        expect(restoredPending).toEqual([s.operation, s.noteOperation, s.photoOperation]);
        expect(restoredPending[0]?.actorId).toBe('technician-1');
        expect(restoredPending[0]?.baseVersion).toBe(1);

        // Validar integridad física del archivo de foto sintética durable
        const photoContent = await readFile(s.fixture.photoPath, 'utf8');
        expect(photoContent).toBe(SYNTHETIC_PHOTO);

        // Validar que un proceso secundario independiente de Node lee exactamente la misma cola en disco
        await reopenedWorkspace.close();
        const readScript = `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);process.stdout.write(JSON.stringify(db.prepare('SELECT operation_json FROM pending_operations ORDER BY sequence').all()));db.close();`;
        const output = execFileSync(process.execPath, ['-e', readScript, s.fixture.options.databasePath], { encoding: 'utf8' });
        const rows = JSON.parse(output) as { operation_json: string }[];
        const recoveredOperations = rows.map(r => JSON.parse(r.operation_json));
        expect(recoveredOperations).toEqual([s.operation, s.noteOperation, s.photoOperation]);
      } finally {
        await s.fixture.cleanup();
      }
    });
  });

  describe('Grupo B: Migración de esquema v1 a v2', () => {
    test('B1: migra automáticamente de v1 a v2 preservando registros, PRAGMA user_version e índices', async () => {
      // Iniciar workspace en versión 1
      const s = await setupWorkspace(1);
      try {
        await s.workspace.commitChange(s.snapshot, s.operation);
        await s.workspace.pending.enqueue(s.noteOperation);
        await s.workspace.pending.enqueue(s.photoOperation);

        const v1State = queryDatabaseDetails(s.fixture.options.databasePath);
        expect(v1State.version.user_version).toBe(1);
        expect(v1State.pending).toHaveLength(3);

        // Cerrar v1 y abrir con adaptador versión actual (v2)
        await s.workspace.close();
        const currentVersionWorkspace = createNodeWorkspace(s.fixture.options, 2);
        await currentVersionWorkspace.open();

        const v2State = queryDatabaseDetails(s.fixture.options.databasePath);
        expect(v2State.version.user_version).toBe(2);
        expect(v2State.snapshots).toEqual(v1State.snapshots);

        // Verificar que el índice de v2 fue creado
        const indexNames = v2State.indices.map(i => i.name);
        expect(indexNames).toContain('pending_actor_sequence');

        // Validar que las operaciones conservan datos y no hay duplicados
        const pendingV2 = await currentVersionWorkspace.pending.listPending();
        expect(pendingV2).toEqual([s.operation, s.noteOperation, s.photoOperation]);

        // Verificar columnas v2 pobladas correctamente a partir de operation_json
        expect(v2State.pending[0]).toMatchObject({
          sequence: 1,
          operation_id: s.operation.operationId,
          incident_id: s.operation.incidentId,
          actor_id: s.operation.actorId,
          base_version: 1,
        });

        await currentVersionWorkspace.close();
      } finally {
        await s.fixture.cleanup();
      }
    });

    test('B2: migración idempotente y rechazo de versiones inválidas o downgrades', async () => {
      const s = await setupWorkspace(2);
      try {
        // Re-migrar a versión 2 es un no-op idempotente
        await s.workspace.migrate(2);
        const state = queryDatabaseDetails(s.fixture.options.databasePath);
        expect(state.version.user_version).toBe(2);

        // Downgrade a v1 o saltos a v3 deben rechazarse con error VERSION
        await expect(s.workspace.migrate(1)).rejects.toMatchObject({ code: 'VERSION' });
        await expect(s.workspace.migrate(3)).rejects.toMatchObject({ code: 'VERSION' });
        expect(queryDatabaseDetails(s.fixture.options.databasePath).version.user_version).toBe(2);
      } finally {
        await s.fixture.cleanup();
      }
    });
  });

  describe('Grupo C: Rollback atómico en migración', () => {
    test.each(['migration.afterSchema', 'migration.afterCopy'] as const)(
      'C1: falla inyectada en %s revierte la transacción a v1 y permite recuperación posterior',
      async failurePoint => {
        const s = await setupWorkspace(1);
        try {
          await s.workspace.commitChange(s.snapshot, s.operation);
          await s.workspace.pending.enqueue(s.noteOperation);

          const stateBefore = queryDatabaseDetails(s.fixture.options.databasePath);
          expect(stateBefore.version.user_version).toBe(1);

          // Inyectar fallo en el punto de migración
          s.fixture.failNext(failurePoint);
          await expect(s.workspace.migrate(2)).rejects.toMatchObject({ code: 'STORAGE' });

          // Verificar que la base de datos sigue intacta en v1 sin tablas temporales ni corrupción
          const stateAfterFailure = queryDatabaseDetails(s.fixture.options.databasePath);
          expect(stateAfterFailure).toEqual(stateBefore);

          // Reabrir y verificar que se recupera exitosamente completando la migración
          const reopened = await s.fixture.reopen();
          await reopened.migrate(2);

          const stateAfterRecovery = queryDatabaseDetails(s.fixture.options.databasePath);
          expect(stateAfterRecovery.version.user_version).toBe(2);
          expect(await reopened.pending.listPending()).toEqual([s.operation, s.noteOperation]);
        } finally {
          await s.fixture.cleanup();
        }
      },
    );
  });

  describe('Grupo D: Rollback atómico en operaciones de workspace', () => {
    test('D1: falla en change.afterSnapshot revierte snapshot y cola, preservando adjuntos intactos', async () => {
      const s = await setupWorkspace(2);
      try {
        await s.workspace.saveSnapshot(s.snapshot);

        const tempPhotoPath = join(s.fixture.directory, 'temp-photo.svg');
        await writeFile(tempPhotoPath, SYNTHETIC_PHOTO);

        const changedSnapshot = {
          ...s.snapshot,
          local: { ...s.local, fields: { work: { status: 'resolved' } } },
          photos: [{ ...s.snapshot.photos[0]!, localUri: pathToFileURL(tempPhotoPath).href }],
        };

        s.fixture.failNext('change.afterSnapshot');
        await expect(s.workspace.commitChange(changedSnapshot, s.operation)).rejects.toMatchObject({ code: 'STORAGE' });

        // Verificar tras reapertura que el snapshot y la cola regresaron a su estado previo
        const reopened = await s.fixture.reopen();
        expect(await reopened.getSnapshot(s.base.id)).toEqual(s.snapshot);
        expect(await reopened.pending.listPending()).toEqual([]);

        // La foto sintética original permanece utilizable
        const attachments = await readdir(s.fixture.options.attachmentDirectory);
        expect(attachments).toEqual(['synthetic.svg']);
      } finally {
        await s.fixture.cleanup();
      }
    });

    test('D2: falla en enqueue.afterWrite revierte encolado atómicamente', async () => {
      const s = await setupWorkspace(2);
      try {
        await s.workspace.commitChange(s.snapshot, s.operation);

        s.fixture.failNext('enqueue.afterWrite');
        await expect(s.workspace.pending.enqueue(s.noteOperation)).rejects.toMatchObject({ code: 'STORAGE' });

        // La cola solo debe contener la operación inicial
        expect(await s.workspace.pending.listPending()).toEqual([s.operation]);
      } finally {
        await s.fixture.cleanup();
      }
    });

    test('D3: falla en acknowledge.afterDelete restaura la operación en la cola', async () => {
      const s = await setupWorkspace(2);
      try {
        await s.workspace.commitChange(s.snapshot, s.operation);
        await s.workspace.pending.enqueue(s.noteOperation);

        s.fixture.failNext('acknowledge.afterDelete');
        await expect(s.workspace.pending.acknowledge(s.operation.operationId)).rejects.toMatchObject({ code: 'STORAGE' });

        // La reapertura confirma que ambas operaciones siguen presentes
        const reopened = await s.fixture.reopen();
        expect(await reopened.pending.listPending()).toEqual([s.operation, s.noteOperation]);

        // Acknowledge nominal sin fallo elimina solo la operación indicada
        await reopened.pending.acknowledge(s.operation.operationId);
        expect(await reopened.pending.listPending()).toEqual([s.noteOperation]);
      } finally {
        await s.fixture.cleanup();
      }
    });
  });

  describe('Grupo E: Integridad, detección de datos inválidos y límites', () => {
    test('E1: idempotencia exacta ante misma identidad y rechazo con IDENTITY_CONFLICT si cambia el cuerpo', async () => {
      const s = await setupWorkspace(2);
      try {
        const baseOperation = { ...s.operation, payload: { k1: 'val1', k2: [1, 2] } };
        await s.workspace.commitChange(s.snapshot, baseOperation);

        // Mismo payload con distinto orden de llaves es idempotente
        const samePayloadDiffOrder = { ...baseOperation, payload: { k2: [1, 2], k1: 'val1' } };
        await s.workspace.pending.enqueue(samePayloadDiffOrder);

        const stateBefore = queryDatabaseDetails(s.fixture.options.databasePath);

        // Misma operationId pero cuerpo incompatible produce IDENTITY_CONFLICT
        const conflictingOp = { ...baseOperation, payload: { k1: 'modificado' } };
        await expect(s.workspace.commitChange(s.snapshot, conflictingOp)).rejects.toMatchObject({
          code: 'IDENTITY_CONFLICT',
        });

        // La base de datos no fue mutada
        expect(queryDatabaseDetails(s.fixture.options.databasePath)).toEqual(stateBefore);
      } finally {
        await s.fixture.cleanup();
      }
    });

    test('E2: rechazo atómico de datos inválidos o secretos no autorizados con INVALID_DATA', async () => {
      const s = await setupWorkspace(2);
      try {
        // Rechazo de payload con tokens/secretos
        await expect(
          s.workspace.commitChange(s.snapshot, { ...s.operation, payload: { token: 'secret-token' } }),
        ).rejects.toMatchObject({ code: 'INVALID_DATA' });

        // Rechazo de payload cíclico
        const cyclicPayload: Record<string, unknown> = {};
        cyclicPayload.self = cyclicPayload;
        await expect(
          s.workspace.commitChange(s.snapshot, { ...s.operation, payload: cyclicPayload }),
        ).rejects.toMatchObject({ code: 'INVALID_DATA' });

        // Estado permanece limpio
        expect(await s.workspace.getSnapshot(s.base.id)).toBeNull();
        expect(await s.workspace.pending.listPending()).toEqual([]);
      } finally {
        await s.fixture.cleanup();
      }
    });

    test('E3: aislamiento estricto entre fixtures en directorios temporales separados', async () => {
      const s1 = await setupWorkspace(2);
      const s2 = await setupWorkspace(2);
      try {
        await s1.workspace.commitChange(s1.snapshot, s1.operation);
        expect(await s1.workspace.pending.listPending()).toHaveLength(1);

        // s2 es independiente y no ve los cambios de s1
        expect(await s2.workspace.getSnapshot(s1.base.id)).toBeNull();
        expect(await s2.workspace.pending.listPending()).toHaveLength(0);
      } finally {
        await s1.fixture.cleanup();
        await s2.fixture.cleanup();
      }
    });
  });
});

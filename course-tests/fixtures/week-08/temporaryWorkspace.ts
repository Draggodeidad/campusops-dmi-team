import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LocalWorkspace } from '../../../src/application/persistence/LocalWorkspace';
import { SYNTHETIC_PHOTO } from './scenario';

export type TransactionFailurePoint =
  | 'enqueue.afterWrite'
  | 'change.afterSnapshot'
  | 'acknowledge.afterDelete'
  | 'migration.afterSchema'
  | 'migration.afterCopy';

export type WorkspaceFixtureOptions = Readonly<{
  databasePath: string;
  attachmentDirectory: string;
  /** Adapter calls this INSIDE the transaction, before its commit. */
  injectFailure(point: TransactionFailurePoint): void;
}>;

export type WorkspaceFactory<T = LocalWorkspace> = (options: WorkspaceFixtureOptions) => T;

/** Inject the #43 adapter here; this factory does not implement persistence. */
export async function createTemporaryWorkspace<T extends Pick<LocalWorkspace, 'open' | 'close'>>(
  createWorkspace: WorkspaceFactory<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), 'campusops-w08-'));
  const attachmentDirectory = join(directory, 'attachments');
  const photoPath = join(attachmentDirectory, 'synthetic.svg');
  try {
    await mkdir(attachmentDirectory);
    await writeFile(photoPath, SYNTHETIC_PHOTO);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  const failures = new Set<TransactionFailurePoint>();
  const options: WorkspaceFixtureOptions = {
    databasePath: join(directory, 'workspace.sqlite'), attachmentDirectory,
    injectFailure(point) {
      if (failures.delete(point)) throw new Error(`Injected W08 transaction failure: ${point}`);
    },
  };
  const instances = new Set<T>();
  let active: T | undefined;
  let disposed = false;
  return {
    directory, photoPath, photoUri: pathToFileURL(photoPath).href, options,
    failNext(point: TransactionFailurePoint) { failures.add(point); },
    async reopen(): Promise<T> {
      if (disposed) throw new Error('W08 fixture already disposed');
      if (active) {
        await active.close();
        instances.delete(active);
        active = undefined;
      }
      const next = createWorkspace(options);
      instances.add(next);
      await next.open();
      active = next;
      return next;
    },
    async cleanup(): Promise<void> {
      disposed = true;
      // Do not remove files under a resource that could not close.
      for (const instance of instances) {
        await instance.close();
        instances.delete(instance);
      }
      await rm(directory, { recursive: true, force: true });
    },
  };
}

import { SqliteLocalWorkspace } from './SqliteLocalWorkspace';
import type { WorkspaceFailurePoint } from './WorkspaceDatabase';
import { requireData } from './workspaceValidation';

/** SDKs load on open/retain, so graph construction neither opens DB nor touches files. */
export function createExpoWorkspace(options: Readonly<{
  databasePath?: string;
  attachmentDirectory?: string;
  targetVersion?: number;
  injectFailure?(point: WorkspaceFailurePoint): void;
}> = {}): SqliteLocalWorkspace {
  return new SqliteLocalWorkspace({
    ...(options.targetVersion === undefined ? {} : { targetVersion: options.targetVersion }),
    ...(options.injectFailure ? { injectFailure: options.injectFailure } : {}),
    async openDatabase() {
      const { openDatabaseAsync } = await import('expo-sqlite');
      if (!options.databasePath) return openDatabaseAsync('campusops-workspace.sqlite', { useNewConnection: true });
      const separator = options.databasePath.lastIndexOf('/');
      requireData(separator >= 0);
      return openDatabaseAsync(options.databasePath.slice(separator + 1), { useNewConnection: true }, options.databasePath.slice(0, separator));
    },
    photos: {
      async retain(photo) {
        const { File, Directory, Paths } = await import('expo-file-system');
        const { uuid } = await import('expo-modules-core');
        const directory = options.attachmentDirectory
          ? new Directory(options.attachmentDirectory) : new Directory(Paths.document, 'campusops-attachments');
        directory.create({ intermediates: true, idempotent: true });
        requireData(photo.localUri.startsWith('file://'));
        const source = new File(photo.localUri);
        requireData(source.exists && source.size === photo.byteLength);
        const prefix = `${directory.uri.replace(/\/$/, '')}/`;
        // File normalizes the URI; only direct files in our owned namespace qualify.
        if (source.uri.startsWith(prefix) && /^[0-9a-f-]+\.attachment$/i.test(source.uri.slice(prefix.length))) {
          return { photo: { ...photo, localUri: source.uri }, async rollback() {} };
        }
        const destination = new File(directory, `${uuid.v4()}.attachment`);
        try {
          await source.copy(destination);
          requireData(destination.exists && destination.size === photo.byteLength);
        } catch (error) {
          if (destination.exists) destination.delete();
          throw error;
        }
        return {
          photo: { ...photo, localUri: destination.uri },
          async rollback() { if (destination.exists) destination.delete(); },
        };
      },
    },
  });
}

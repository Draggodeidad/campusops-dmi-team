import type { SyntheticPhotoSource } from '../../application/sync/IncidentSyncGateway';

/** Explicit academic fixture. This does not capture or upload a photograph. */
export class ExpoSyntheticPhotoSource implements SyntheticPhotoSource {
  async prepare() {
    const { File, Directory, Paths } = await import('expo-file-system');
    const { uuid } = await import('expo-modules-core');
    const directory = new Directory(Paths.cache, 'campusops-synthetic');
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, `${uuid.v4()}.svg`);
    file.create();
    file.write('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="gray"/><text x="5" y="40">PRUEBA</text></svg>');
    return { localUri: file.uri, byteLength: file.size, mediaType: 'image/svg+xml' };
  }
}

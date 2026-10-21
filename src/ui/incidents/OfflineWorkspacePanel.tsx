import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ApplicationFailure } from '../../application/errors/ApplicationFailure';
import type { ConflictReview, IncidentWorkspace, LocalIncidentView } from '../../application/sync/IncidentWorkspace';
import type { Incident } from '../../domain/incidents/Incident';

type Props = Readonly<{
  workspace: IncidentWorkspace;
  incident: Incident | null;
  onRecovered: (incident: Incident) => void;
  onPendingChanged: (pending: boolean) => void;
}>;
const labels = {
  pending: 'Pendiente de sincronizar', retry: 'Sin confirmación; reintenta con la sesión original',
  conflict: 'Conflicto: requiere revisión', forbidden: 'Acceso denegado: requiere revisión autorizada',
  reviewed: 'Asignación remota conservada; intención archivada', superseded: 'Intención original conservada; reformulada con otra identidad',
};

export function OfflineWorkspacePanel({ workspace, incident, onRecovered, onPendingChanged }: Props) {
  const [views, setViews] = useState<readonly LocalIncidentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [review, setReview] = useState<ConflictReview | null>(null);
  const selected = views.find(view => view.incident.id === incident?.id);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (incident) await workspace.cache(incident);
        const recovered = await workspace.recover();
        if (active) { setViews(recovered); setError(null); setReview(null); }
      } catch (failure) {
        if (active) setError(failure instanceof ApplicationFailure ? failure.message : 'No fue posible recuperar los cambios.');
      }
    })();
    return () => { active = false; };
  }, [workspace, incident]);

  useEffect(() => {
    onPendingChanged(Boolean(selected?.operations.some(item => !['reviewed', 'superseded'].includes(item.state.state))));
  }, [selected, onPendingChanged]);

  const perform = async (task: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await task(); setViews(await workspace.recover()); }
    catch (failure) { setError(failure instanceof ApplicationFailure ? failure.message : 'No fue posible guardar los cambios.'); }
    finally { setBusy(false); }
  };
  const record = async (action: 'start' | 'comment' | 'add_evidence') => {
    if (!incident) return;
    const view = await workspace.record(incident.id, action === 'comment' ? { action, text: note } : { action });
    setNote(''); onRecovered(view.incident);
  };

  return (
    <View accessibilityLabel="Trabajo local y sincronización" testID="offline-workspace">
      <Text accessibilityRole="header">Trabajo guardado en este dispositivo</Text>
      <Text>Los cambios locales conservan su autor. Una referencia sintética no acredita una foto subida.</Text>
      {busy ? <Text accessibilityRole="progressbar">Guardando o sincronizando…</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => perform(async () => {
        const synchronized = await workspace.synchronize();
        const current = synchronized.find(view => view.incident.id === incident?.id);
        if (current) onRecovered(current.incident);
      })} testID="sync-pending">
        <Text>Sincronizar con mi sesión</Text>
      </Pressable>
      {views.map(view => (
        <Pressable accessibilityRole="button" disabled={busy} key={view.incident.id} onPress={() => onRecovered(view.incident)} testID={`recover-${view.incident.id}`}>
          <Text>{view.incident.title} · {view.operations.length} operaciones conservadas</Text>
        </Pressable>
      ))}
      {incident ? (
        <View>
          {selected ? (
            <>
              {selected.incident.status === 'assigned' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => perform(() => record('start'))} testID="local-start"><Text>Guardar inicio sin conexión</Text></Pressable> : null}
              <TextInput accessibilityLabel="Nota local" onChangeText={setNote} value={note} editable={!busy} testID="local-note-input" />
              <Pressable accessibilityRole="button" disabled={busy || !note.trim()} onPress={() => perform(() => record('comment'))} testID="local-note"><Text>Guardar nota pendiente</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => perform(() => record('add_evidence'))} testID="local-photo"><Text>Guardar referencia fotográfica sintética</Text></Pressable>
              {selected.notes.map(item => <Text key={item.noteId}>Nota guardada: {item.text}</Text>)}
              {selected.photos.map(item => <Text key={item.evidenceId}>Archivo sintético conservado: {item.evidenceId} · {item.byteLength} bytes</Text>)}
              {selected.operations.map(item => <Text key={item.operation.operationId} testID={`pending-${item.operation.operationId}`}>{item.operation.action}: {labels[item.state.state]}</Text>)}
            </>
          ) : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => perform(async () => { setReview(await workspace.inspect(incident.id)); })} testID="inspect-conflict"><Text>Consultar servidor y revisar conflicto</Text></Pressable>
          {review ? (
            <View testID="conflict-review">
              <Text>Intención local: {review.originalStatus}. Estado remoto: {review.incident.status}.</Text>
              <Text>Asignación remota: {review.incident.assignedTechnicianId ?? 'sin asignar'}. Versión: {review.incident.version}.</Text>
              <Text>Campos en conflicto: {review.fields.join(', ') || 'ninguno'}</Text>
              {!review.reviewed && review.fields.length > 0 ? <Pressable accessibilityRole="button" disabled={busy} testID="keep-remote" onPress={() => perform(async () => {
                await workspace.keepRemote(incident.id, review.incident.version!);
                onRecovered(review.incident); setReview(null);
              })}><Text>Conservar asignación remota y archivar intención sin borrarla</Text></Pressable> : null}
              {selected?.operations.filter(item => item.state.state === 'conflict').map(item => <Pressable accessibilityRole="button" disabled={busy} key={item.operation.operationId} testID={`reformulate-${item.operation.operationId}`} onPress={() => perform(async () => {
                const updated = await workspace.reformulate(incident.id, item.operation.operationId, review.incident.version!);
                onRecovered(updated.incident); setReview(null);
              })}><Text>Reformular {item.operation.action} sobre versión {review.incident.version} con nueva identidad</Text></Pressable>)}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

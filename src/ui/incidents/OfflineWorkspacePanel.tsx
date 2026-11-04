import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ApplicationFailure } from '../../application/errors/ApplicationFailure';
import type { ConflictReview, IncidentWorkspace, LocalIncidentView } from '../../application/sync/IncidentWorkspace';
import type { DiagnosticSink, DiagnosticStatus } from '../../application/telemetry/emitDiagnostic';
import { startDiagnosticRequest } from '../../application/telemetry/startDiagnosticRequest';
import { localAttentionOutcome } from '../../application/ui-state/localAttentionOutcome';
import { remoteUiActions } from '../../application/ui-state/RemoteUiState';
import type { RemoteRequestIntent } from '../../application/ui-state/RemoteUiState';
import type { Incident } from '../../domain/incidents/Incident';

type Props = Readonly<{
  workspace: IncidentWorkspace;
  diagnosticSink?: DiagnosticSink | undefined;
  incident: Incident | null;
  cacheIncident: Incident | null;
  selection: RemoteRequestIntent | null;
  views: readonly LocalIncidentView[];
  writing: boolean;
  onBusyChanged: (busy: boolean) => void;
  onViewsChanged: (views: readonly LocalIncidentView[]) => void;
  onSelect: (incident: Incident) => void;
  onRecovered: (incident: Incident, state: 'offline' | 'success', correlationId: string) => void;
}>;
const labels = {
  pending: 'Pendiente de sincronizar', retry: 'Sin confirmación; reintenta con la sesión original',
  conflict: 'Conflicto: requiere revisión', forbidden: 'Acceso denegado: requiere revisión autorizada',
  reviewed: 'Asignación remota conservada; intención archivada', superseded: 'Intención original conservada; reformulada con otra identidad',
};

export function OfflineWorkspacePanel({
  workspace, diagnosticSink, incident, cacheIncident, selection, views, writing,
  onBusyChanged, onViewsChanged, onSelect, onRecovered,
}: Props) {
  const [error, setError] = useState<{ message: string; selection?: RemoteRequestIntent | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const mounted = useRef(false);
  const [draft, setDraft] = useState<{ selection: RemoteRequestIntent | null; note: string }>();
  const [inspection, setInspection] = useState<{ selection: RemoteRequestIntent | null; review: ConflictReview }>();
  const selected = views.find(view => view.incident.id === incident?.id);
  const note = draft?.selection === selection ? draft?.note ?? '' : '';
  const review = inspection?.selection === selection ? inspection?.review : null;
  const local = localAttentionOutcome(selected);
  const recovery = local ? remoteUiActions[local.state] : null;
  const disabled = busy || writing;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const diagnostic = startDiagnosticRequest(diagnosticSink, cacheIncident?.id);
    void (async () => {
      try {
        if (cacheIncident) await workspace.cache(cacheIncident);
        const recovered = await workspace.recover();
        if (active) { onViewsChanged(recovered); setError(null); }
      } catch (failure) {
        if (active) {
          setError({ message: failure instanceof ApplicationFailure ? failure.message : 'No fue posible recuperar los cambios.' });
          diagnostic.report('error');
        }
      }
    })();
    return () => { active = false; };
  }, [workspace, cacheIncident, onViewsChanged, diagnosticSink]);

  const perform = async (task: (correlationId: string) => Promise<DiagnosticStatus | void>) => {
    if (running.current || writing) return;
    const diagnostic = startDiagnosticRequest(diagnosticSink, incident?.id);
    running.current = true;
    onBusyChanged(true);
    setBusy(true);
    setError(null);
    try {
      const status = await task(diagnostic.correlationId);
      const recovered = await workspace.recover();
      if (mounted.current) onViewsChanged(recovered);
      if (status) diagnostic.report(status);
    } catch (failure) {
      diagnostic.report('error');
      if (mounted.current) setError({
        message: failure instanceof ApplicationFailure ? failure.message : 'No fue posible guardar los cambios.',
        selection,
      });
    } finally {
      running.current = false;
      if (mounted.current) { setBusy(false); onBusyChanged(false); }
    }
  };

  const record = async (action: 'start' | 'comment' | 'add_evidence', correlationId: string) => {
    if (!incident) return;
    const view = await workspace.record(incident.id, action === 'comment' ? { action, text: note } : { action });
    if (mounted.current) onRecovered(view.incident, 'offline', correlationId);
    return 'pending' as const;
  };

  return (
    <View accessibilityLabel="Trabajo local y sincronización" testID="offline-workspace">
      <Text accessibilityRole="header">Trabajo guardado en este dispositivo</Text>
      <Text>Los cambios locales conservan su autor. Una referencia sintética no acredita una foto subida.</Text>
      {busy ? <Text accessibilityRole="progressbar">Guardando o sincronizando…</Text> : null}
      {error && (error.selection === undefined || error.selection === selection)
        ? <Text accessibilityRole="alert">{error.message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={() => perform(async correlationId => {
        const synchronized = await workspace.synchronize(correlationId);
        const current = synchronized.find(view => view.incident.id === incident?.id);
        if (current && mounted.current) {
          onRecovered(current.incident, local && !localAttentionOutcome(current) ? 'success' : 'offline', correlationId);
        }
      })} testID="sync-pending">
        <Text>Sincronizar con mi sesión</Text>
      </Pressable>
      {views.map(view => (
        <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} key={view.incident.id} onPress={() => onSelect(view.incident)} testID={`recover-${view.incident.id}`}>
          <Text>{view.incident.title} · {view.operations.length} operaciones conservadas</Text>
        </Pressable>
      ))}
      {incident ? (
        <View>
          {selected ? (
            <>
              {selected.incident.status === 'assigned' && !recovery ? <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={() => perform(correlationId => record('start', correlationId))} testID="local-start"><Text>Guardar inicio sin conexión</Text></Pressable> : null}
              <TextInput accessibilityLabel="Nota local" onChangeText={note => setDraft({ selection, note })} value={note} editable={!disabled && recovery !== 'review'} testID="local-note-input" />
              <Pressable accessibilityRole="button" disabled={disabled || recovery === 'review' || !note.trim()} accessibilityState={{ disabled: disabled || recovery === 'review' || !note.trim() }} onPress={() => perform(correlationId => record('comment', correlationId))} testID="local-note"><Text>Guardar nota pendiente</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={disabled || recovery === 'review'} accessibilityState={{ disabled: disabled || recovery === 'review' }} onPress={() => perform(correlationId => record('add_evidence', correlationId))} testID="local-photo"><Text>Guardar referencia fotográfica sintética</Text></Pressable>
              {selected.notes.map(item => <Text key={item.noteId}>Nota guardada: {item.text}</Text>)}
              {selected.photos.map(item => <Text key={item.evidenceId}>Archivo sintético conservado: {item.evidenceId} · {item.byteLength} bytes</Text>)}
              {selected.operations.map(item => <Text key={item.operation.operationId} testID={`pending-${item.operation.operationId}`}>{item.operation.action}: {labels[item.state.state]}</Text>)}
            </>
          ) : null}
          <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={() => perform(async correlationId => {
            const review = await workspace.inspect(incident.id, correlationId);
            if (mounted.current) setInspection({ selection, review });
            return !review.reviewed && review.fields.length > 0 ? 'conflict' : 'success';
          })} testID="inspect-conflict"><Text>Consultar servidor y revisar conflicto</Text></Pressable>
          {review ? (
            <View testID="conflict-review">
              <Text>Intención local: {review.originalStatus}. Estado remoto: {review.incident.status}.</Text>
              <Text>Asignación remota: {review.incident.assignedTechnicianId ?? 'sin asignar'}. Versión: {review.incident.version}.</Text>
              <Text>Campos en conflicto: {review.fields.join(', ') || 'ninguno'}</Text>
              {!review.reviewed && review.fields.length > 0 ? <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} testID="keep-remote" onPress={() => perform(async correlationId => {
                await workspace.keepRemote(incident.id, review.incident.version!, correlationId);
                if (mounted.current) onRecovered(review.incident, 'success', correlationId);
                return 'success';
              })}><Text>Conservar asignación remota y archivar intención sin borrarla</Text></Pressable> : null}
              {selected?.operations.filter(item => item.state.state === 'conflict').map(item => <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} key={item.operation.operationId} testID={`reformulate-${item.operation.operationId}`} onPress={() => perform(async correlationId => {
                const updated = await workspace.reformulate(incident.id, item.operation.operationId, review.incident.version!, correlationId);
                if (mounted.current) onRecovered(updated.incident, 'offline', correlationId);
                return 'pending';
              })}><Text>Reformular {item.operation.action} sobre versión {review.incident.version} con nueva identidad</Text></Pressable>)}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

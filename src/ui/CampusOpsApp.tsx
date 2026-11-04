import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { CreateIncident, CreateIncidentInput } from '../application/incidents/CreateIncident';
import { ApplicationFailure } from '../application/errors/ApplicationFailure';
import type { GetIncidentById } from '../application/incidents/GetIncidentById';
import type { GetIncidents } from '../application/incidents/GetIncidents';
import type {
  PerformIncidentAction,
  AllowedIncidentAction,
} from '../application/incidents/PerformIncidentAction';
import type { SessionController } from '../application/session/SessionController';
import type { SessionSnapshot } from '../application/session/SessionSnapshot';
import type { BackendStatus, GetBackendStatus } from '../application/system/GetBackendStatus';
import type { Incident } from '../domain/incidents/Incident';
import type { IncidentWorkspace, LocalIncidentView } from '../application/sync/IncidentWorkspace';
import { OfflineWorkspacePanel } from './incidents/OfflineWorkspacePanel';
import { CreateIncidentScreen } from './incidents/CreateIncidentScreen';
import { IncidentDetailScreen } from './incidents/IncidentDetailScreen';
import { IncidentListScreen } from './incidents/IncidentListScreen';
import { useRemoteRequest } from './useRemoteRequest';
import { remoteUiActions } from '../application/ui-state/RemoteUiState';
import type { RemoteUiOutcome } from '../application/ui-state/RemoteUiState';
import { localAttentionOutcome } from '../application/ui-state/localAttentionOutcome';

import type { LookupIncidentLocation } from '../application/location/LookupIncidentLocation';

type Props = Readonly<{
  lookupIncidentLocation?: LookupIncidentLocation;
  getBackendStatus: GetBackendStatus;
  getIncidents: GetIncidents;
  getIncidentById: GetIncidentById;
  createIncident?: CreateIncident;
  sessionController?: SessionController;
  performIncidentAction?: PerformIncidentAction;
  incidentSync?: IncidentWorkspace;
}>;

type ActiveView = 'list' | 'detail' | 'create';

function presentIncidentFailure(error: unknown, operation: 'list' | 'detail' | 'create'): string {
  if (error instanceof ApplicationFailure) {
    if (error.code === 'INCIDENT_TIMEOUT') return 'El servicio tardó demasiado en responder.';
    if (error.reason === 'contract') return 'El servidor devolvió datos inválidos.';
    if (error.reason === 'payload_unavailable') return 'Los datos de la incidencia no están disponibles.';
    if (error.reason === 'server') return 'El servidor informó un error temporal (500).';
    if (error.code === 'REMOTE_COMMUNICATION_ERROR') return 'No hay conexión con el servicio.';
    if (operation === 'create') return error.message;
  }
  if (operation === 'list') return 'No fue posible cargar las incidencias.';
  if (operation === 'detail') return 'No fue posible cargar el detalle.';
  return 'No fue posible registrar la incidencia.';
}

function isConnectionFailure(error: unknown): boolean {
  return error instanceof ApplicationFailure &&
    (error.code === 'REMOTE_COMMUNICATION_ERROR' || error.code === 'INCIDENT_TIMEOUT');
}

export function CampusOpsApp({
  lookupIncidentLocation,
  getBackendStatus,
  getIncidents,
  getIncidentById,
  createIncident,
  sessionController,
  performIncidentAction,
  incidentSync,
}: Props) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | 'checking'>('checking');
  const requestSequence = useRef(0);
  const nextRequestId = useCallback(() => `w10-request-${++requestSequence.current}`, []);
  const { state: list, begin: beginList, resolve: resolveList, cancel: cancelList, clear: clearList } =
    useRemoteRequest<readonly Incident[]>(nextRequestId);
  const detail = useRemoteRequest<Incident>(nextRequestId);
  const attention = useRemoteRequest<Incident>(nextRequestId);
  const { clear: clearDetail } = detail;
  const { clear: clearAttention } = attention;
  const [localViews, setLocalViews] = useState<readonly LocalIncidentView[] | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const writeInFlight = useRef(false);
  const [activeView, setActiveView] = useState<ActiveView>('list');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [session, setSession] = useState<SessionSnapshot | null>(
    sessionController ? sessionController.getSnapshot() : null,
  );
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(Boolean(sessionController));
  const sessionUsable = !sessionController || (session !== null && ['authenticated', 'expired', 'refreshing'].includes(session.state));
  const isCurrent = (generation: number | undefined) => !sessionController || generation === sessionController.getSnapshot().generation;

  useEffect(() => {
    if (!sessionController) return;
    let active = true;
    let previousGeneration = sessionController.getSnapshot().generation;
    const unsubscribe = sessionController.subscribe((snapshot) => {
      setSession(snapshot);
      if (snapshot.generation !== previousGeneration) {
        previousGeneration = snapshot.generation;
        clearList();
        clearDetail();
        clearAttention();
        setActiveView('list');
        setLocalViews(null);
        setWorkspaceBusy(false);
        setWriting(false);
        writeInFlight.current = false;
        setCreateLoading(false);
        setCreateError(null);
      }
    });
    const timer = setInterval(() => sessionController.getSnapshot(), 1000);
    void sessionController.restore()
      .catch((error: unknown) => {
        if (active) setSessionError(error instanceof ApplicationFailure ? error.message : 'No fue posible recuperar la sesión.');
      })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; unsubscribe(); clearInterval(timer); };
  }, [sessionController, clearList, clearDetail, clearAttention]);

  useEffect(() => {
    let active = true;
    void getBackendStatus.execute().then((status) => { if (active) setBackendStatus(status); });
    return () => { active = false; };
  }, [getBackendStatus]);

  const refreshIncidents = useCallback(async () => {
    const { intent, signal } = beginList(null);
    try {
      const items = await getIncidents.execute(signal);
      resolveList(intent, items.length ? { state: 'success', value: items } : { state: 'empty' });
    } catch (error: unknown) {
      if (signal.aborted) return;
      if (incidentSync && isConnectionFailure(error)) {
        const local = await incidentSync.recover().catch(() => []);
        if (local.length) {
          resolveList(intent, { state: 'offline', value: local.map(item => item.incident) });
          return;
        }
      }
      resolveList(intent, { state: 'error', error: presentIncidentFailure(error, 'list') });
    }
  }, [beginList, resolveList, getIncidents, incidentSync]);

  useEffect(() => {
    if (sessionUsable) void refreshIncidents();
    return clearList;
  }, [session?.generation, sessionUsable, refreshIncidents, clearList]);

  const openIncident = async (id: string) => {
    attention.clear();
    const { intent, signal } = detail.begin(id);
    setActiveView('detail');
    try {
      const incident = await getIncidentById.execute(id, signal);
      detail.resolve(intent, incident ? { state: 'success', value: incident } : { state: 'empty' });
    } catch (error: unknown) {
      if (signal.aborted) return;
      if (incidentSync && isConnectionFailure(error)) {
        const local = (await incidentSync.recover().catch(() => [])).find(item => item.incident.id === id);
        if (local) {
          detail.resolve(intent, { state: 'offline', value: local.incident });
          return;
        }
      }
      detail.resolve(intent, { state: 'error', error: presentIncidentFailure(error, 'detail') });
    }
  };

  const selectLocal = (incident: Incident) => {
    if (!isCurrent(session?.generation)) return;
    attention.clear();
    const { intent } = detail.begin(incident.id);
    detail.resolve(intent, { state: 'offline', value: incident });
    setActiveView('detail');
  };

  const returnToList = () => {
    detail.clear();
    attention.clear();
    setActiveView('list');
  };

  const handleOpenCreate = () => {
    setCreateError(null);
    setActiveView('create');
  };

  const handleCancelCreate = () => {
    setCreateError(null);
    setActiveView('list');
  };

  const handleCreateSubmit = async (data: CreateIncidentInput) => {
    if (!createIncident) return;
    const generation = sessionController?.getSnapshot().generation;
    setCreateLoading(true);
    setCreateError(null);
    try {
      await createIncident.execute(data);
      if (!isCurrent(generation)) return;
      await refreshIncidents();
      if (!isCurrent(generation)) return;
      setActiveView('list');
    } catch (error: unknown) {
      if (isCurrent(generation)) setCreateError(presentIncidentFailure(error, 'create'));
    } finally {
      if (isCurrent(generation)) setCreateLoading(false);
    }
  };

  const handleLogin = async (actorId: string) => {
    if (!sessionController) return;
    setSessionError(null);
    try { await sessionController.login(actorId); }
    catch (error: unknown) {
      setSessionError(error instanceof ApplicationFailure ? error.message : 'No fue posible iniciar sesión.');
    }
  };

  const handleLogout = async () => {
    if (!sessionController) return;
    setSessionError(null);
    try { await sessionController.logout(); }
    catch (error: unknown) {
      setSessionError(error instanceof ApplicationFailure ? error.message : 'No fue posible cerrar sesión.');
    }
  };

  const handleRefresh = async () => {
    if (!sessionController) return;
    setSessionError(null);
    try { await sessionController.refresh(); }
    catch (error: unknown) {
      setSessionError(error instanceof ApplicationFailure ? error.message : 'No fue posible renovar la sesión.');
    }
  };

  const currentDetail = detail.state;
  const detailIncident = currentDetail && 'value' in currentDetail ? currentDetail.value : null;
  const currentAttention = attention.state;
  const attentionIncident = currentAttention && 'value' in currentAttention ? currentAttention.value : null;
  const remoteIncident = currentAttention?.state === 'success' ? currentAttention.value
    : currentDetail?.state === 'success' && !attentionIncident ? currentDetail.value : null;
  const incident = attentionIncident ?? detailIncident;
  const local = localAttentionOutcome(localViews?.find(view => view.incident.id === incident?.id));
  const recoveringWorkspace = Boolean(sessionController && incidentSync && !localViews);
  const visibleAttention = local && currentDetail && currentAttention?.state !== 'loading'
    ? { ...local, intent: currentAttention?.intent ?? currentDetail.intent }
    : currentAttention;

  const handlePerformAction = async (action: AllowedIncidentAction, diagnosis?: string) => {
    if (!performIncidentAction || !incident || !currentDetail || !detail.isCurrent(currentDetail.intent)
      || local || recoveringWorkspace || currentDetail.state === 'offline' || workspaceBusy || writeInFlight.current
      || (currentAttention && remoteUiActions[currentAttention.state] !== 'continue')) return;

    const generation = sessionController?.getSnapshot().generation;
    const { intent, signal } = attention.begin(incident.id);
    writeInFlight.current = true;
    setWriting(true);
    let updated: Incident | undefined;
    let failure: unknown;
    try {
      if (incident.version === undefined) throw new ApplicationFailure('VERSION_CONFLICT', 'Actualiza la incidencia antes de ejecutar la acción.');
      updated = await performIncidentAction.execute({
        incidentId: incident.id,
        action,
        baseVersion: incident.version,
        actorRole: session?.role ?? null,
        ...(diagnosis !== undefined ? { diagnosis } : {}),
      });
    } catch (error: unknown) {
      failure = error;
    } finally {
      if (isCurrent(generation) && !signal.aborted) {
        const recovered = incidentSync ? await incidentSync.recover().catch(() => null) : null;
        const saved = recovered?.find(view => view.incident.id === incident.id);
        const outcome: RemoteUiOutcome<Incident> = localAttentionOutcome(saved)
          ?? (updated && (!incidentSync || recovered) ? { state: 'success', value: updated }
            : saved && isConnectionFailure(failure) ? { state: 'offline', value: saved.incident }
            : { state: 'error', error: failure instanceof ApplicationFailure ? failure.message
              : updated ? 'No fue posible comprobar los cambios guardados.'
              : 'No fue posible ejecutar la acción.' });
        if (attention.resolve(intent, outcome)) {
          if (recovered) setLocalViews(recovered);
          if (outcome.state === 'success') void refreshIncidents();
        }
      }
      if (isCurrent(generation)) {
        writeInFlight.current = false;
        setWriting(false);
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View accessibilityRole="summary" style={styles.header}>
        <Text style={styles.brand}>CampusOps</Text>
        <Text>Incidencias del campus · entorno académico ficticio</Text>
        <Text testID="backend-status">Backend: {backendStatus}</Text>

        {session && (
          <View style={styles.sessionBox} testID="session-status-panel">
            <Text style={styles.sessionStateText} testID="session-state">
              Estado: {session.state}
              {session.actorId ? ` | ${session.actorId} (${session.role})` : ''}
            </Text>
            {sessionError ? <Text accessibilityRole="alert" testID="session-error">{sessionError}</Text> : null}
            {restoring ? <Text accessibilityRole="progressbar">Recuperando sesión…</Text> : null}
            {session.state === 'anonymous' && !restoring ? (
              <View style={styles.authButtonsRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleLogin('reporter-1')}
                  style={styles.authBtn}
                  testID="login-reporter"
                >
                  <Text style={styles.authBtnText}>Reportante</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleLogin('technician-1')}
                  style={styles.authBtn}
                  testID="login-technician"
                >
                  <Text style={styles.authBtnText}>Técnico</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleLogin('coordinator-1')}
                  style={styles.authBtn}
                  testID="login-coordinator"
                >
                  <Text style={styles.authBtnText}>Coordinador</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={restoring || session.state === 'logging-out'}
                onPress={handleLogout}
                style={styles.logoutBtn}
                testID="logout-button"
              >
                <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
              </Pressable>
            )}
            {session.state === 'expired' ? <Pressable accessibilityRole="button" onPress={handleRefresh} testID="refresh-session"><Text>Renovar sesión</Text></Pressable> : null}
            {session.state === 'anonymous' && sessionError ? <Pressable accessibilityRole="button" onPress={handleLogout} testID="retry-session-cleanup"><Text>Reintentar cierre de sesión</Text></Pressable> : null}
          </View>
        )}
      </View>

      {sessionUsable && activeView === 'create' && (
        <CreateIncidentScreen
          {...(lookupIncidentLocation ? { lookupIncidentLocation } : {})}
          error={createError}
          loading={createLoading}
          onCancel={handleCancelCreate}
          onSubmit={handleCreateSubmit}
        />
      )}

      {sessionUsable && activeView === 'detail' && currentDetail && (
        <IncidentDetailScreen
          state={currentDetail}
          incident={visibleAttention && 'value' in visibleAttention ? visibleAttention.value : incident}
          attention={visibleAttention}
          writing={writing || workspaceBusy}
          checkingWorkspace={recoveringWorkspace}
          currentRole={session?.role ?? null}
          onAction={performIncidentAction ? handlePerformAction : undefined}
          onBack={returnToList}
          onCancel={detail.cancel}
          onCancelAttention={attention.cancel}
          onRetry={() => {
            if (currentDetail.intent.selectionId) void openIncident(currentDetail.intent.selectionId);
          }}
        />
      )}

      {sessionUsable && activeView === 'list' && list && (
        <IncidentListScreen
          state={list}
          onCancel={cancelList}
          onRetry={refreshIncidents}
          onCreate={createIncident && (!sessionController || session?.role === 'reporter') ? handleOpenCreate : undefined}
          onSelect={openIncident}
        />
      )}

      {sessionController && sessionUsable && incidentSync ? (
        <OfflineWorkspacePanel
          key={session?.generation}
          workspace={incidentSync}
          incident={incident}
          cacheIncident={remoteIncident}
          selection={currentDetail?.intent ?? null}
          views={localViews ?? []}
          onViewsChanged={setLocalViews}
          writing={writing}
          onBusyChanged={setWorkspaceBusy}
          onSelect={selectLocal}
          onRecovered={(recovered, state) => {
            if (!isCurrent(session?.generation) || !currentDetail || currentDetail.intent.selectionId !== recovered.id
              || !detail.isCurrent(currentDetail.intent)) return;
            attention.clear();
            detail.resolve(detail.begin(recovered.id).intent, { state, value: recovered });
          }}
        />
      ) : null}

      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: 20, padding: 24 },
  header: { gap: 6 },
  brand: { fontSize: 26, fontWeight: '700' },
  sessionBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    gap: 8,
  },
  sessionStateText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  authButtonsRow: { flexDirection: 'row', gap: 8 },
  authBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  authBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  logoutBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
});

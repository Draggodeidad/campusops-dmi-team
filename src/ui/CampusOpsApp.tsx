import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { CreateIncident, CreateIncidentInput } from '../application/incidents/CreateIncident';
import { ApplicationFailure } from '../application/errors/ApplicationFailure';
import type { GetIncidentById } from '../application/incidents/GetIncidentById';
import type { GetIncidents } from '../application/incidents/GetIncidents';
import type {
  PerformIncidentAction,
  PerformIncidentActionInput,
} from '../application/incidents/PerformIncidentAction';
import type { SessionController } from '../application/session/SessionController';
import type { SessionSnapshot } from '../application/session/SessionSnapshot';
import type { BackendStatus, GetBackendStatus } from '../application/system/GetBackendStatus';
import type { Incident } from '../domain/incidents/Incident';
import type { IncidentWorkspace } from '../application/sync/IncidentWorkspace';
import { OfflineWorkspacePanel } from './incidents/OfflineWorkspacePanel';
import { CreateIncidentScreen } from './incidents/CreateIncidentScreen';
import { IncidentDetailScreen } from './incidents/IncidentDetailScreen';
import { IncidentListScreen } from './incidents/IncidentListScreen';

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
  const [incidents, setIncidents] = useState<readonly Incident[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hasLocalPending, setHasLocalPending] = useState(false);

  useEffect(() => {
    if (!sessionController) return;
    let active = true;
    let previousGeneration = sessionController.getSnapshot().generation;
    const unsubscribe = sessionController.subscribe((snapshot) => {
      setSession(snapshot);
      if (snapshot.generation !== previousGeneration) {
        previousGeneration = snapshot.generation;
        setSelectedIncident(null);
        setActiveView('list');
        setIncidents([]);
        setListError(null);
        setDetailError(null);
        setActionError(null);
        setActionLoading(false);
        setHasLocalPending(false);
        setCreateLoading(false);
        setListLoading(snapshot.state === 'authenticated');
      }
      if (snapshot.state === 'anonymous') setListLoading(false);
    });
    const timer = setInterval(() => sessionController.getSnapshot(), 1000);
    void sessionController.restore()
      .catch((error: unknown) => {
        if (active) setSessionError(error instanceof ApplicationFailure ? error.message : 'No fue posible recuperar la sesión.');
      })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; unsubscribe(); clearInterval(timer); };
  }, [sessionController]);

  useEffect(() => {
    let active = true;
    void getBackendStatus.execute().then((status) => { if (active) setBackendStatus(status); });
    return () => { active = false; };
  }, [getBackendStatus]);

  useEffect(() => {
    let active = true;
    if (!sessionUsable) return;
    void getIncidents.execute()
      .then((items) => { if (active) setIncidents(items); })
      .catch(async (error: unknown) => {
        if (active) setListError(presentIncidentFailure(error, 'list'));
        if (incidentSync && error instanceof ApplicationFailure && ['REMOTE_COMMUNICATION_ERROR', 'INCIDENT_TIMEOUT'].includes(error.code)) {
          try {
            const local = await incidentSync.recover();
            if (active) setIncidents(local.map(item => item.incident));
          } catch { /* The workspace panel exposes the controlled storage/session failure. */ }
        }
      })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [getIncidents, incidentSync, session?.generation, sessionUsable]);

  const refreshIncidents = async () => {
    const generation = sessionController?.getSnapshot().generation;
    setListLoading(true);
    setListError(null);
    try {
      const items = await getIncidents.execute();
      if (isCurrent(generation)) setIncidents(items);
    } catch (error: unknown) {
      if (isCurrent(generation)) setListError(presentIncidentFailure(error, 'list'));
    } finally {
      if (isCurrent(generation)) setListLoading(false);
    }
  };

  const openIncident = async (id: string) => {
    const generation = sessionController?.getSnapshot().generation;
    setActiveView('detail');
    setDetailLoading(true);
    setDetailError(null);
    setActionError(null);
    try {
      const incident = await getIncidentById.execute(id);
      if (!isCurrent(generation)) return;
      setSelectedIncident(incident);
      if (incident === null) setDetailError('La incidencia solicitada no existe.');
    } catch (error: unknown) {
      if (isCurrent(generation)) setDetailError(presentIncidentFailure(error, 'detail'));
      if (incidentSync && error instanceof ApplicationFailure && ['REMOTE_COMMUNICATION_ERROR', 'INCIDENT_TIMEOUT'].includes(error.code)) {
        try {
          const local = (await incidentSync.recover()).find(item => item.incident.id === id);
          if (local && isCurrent(generation)) { setSelectedIncident(local.incident); setDetailError('Sin conexión: copia local de esta cuenta.'); }
        } catch { /* The workspace panel exposes the controlled failure. */ }
      }
    } finally {
      if (isCurrent(generation)) setDetailLoading(false);
    }
  };

  const returnToList = () => {
    setSelectedIncident(null);
    setDetailError(null);
    setDetailLoading(false);
    setActionError(null);
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

  const handlePerformAction = async (
    action: 'start' | 'resolve' | 'close' | 'reopen',
    diagnosis?: string,
  ) => {
    if (!performIncidentAction || !selectedIncident) return;
    const generation = sessionController?.getSnapshot().generation;
    setActionLoading(true);
    setActionError(null);
    try {
      if (selectedIncident.version === undefined) throw new ApplicationFailure('VERSION_CONFLICT', 'Actualiza la incidencia antes de ejecutar la acción.');
      const actionPayload: PerformIncidentActionInput = {
        incidentId: selectedIncident.id,
        action,
        baseVersion: selectedIncident.version,
        actorRole: session?.role ?? null,
        ...(diagnosis !== undefined ? { diagnosis } : {}),
      };
      const updated = await performIncidentAction.execute(actionPayload);
      if (!isCurrent(generation)) return;
      setSelectedIncident(updated);
      await refreshIncidents();
    } catch (err: unknown) {
      if (!isCurrent(generation)) return;
      if (err instanceof ApplicationFailure) {
        setActionError(err.message);
      } else {
        setActionError('No fue posible ejecutar la acción.');
      }
    } finally {
      if (isCurrent(generation)) setActionLoading(false);
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

      {sessionUsable && activeView === 'detail' && (
        <IncidentDetailScreen
          actionError={actionError}
          actionLoading={actionLoading}
          actionsBlocked={hasLocalPending}
          currentRole={session?.role ?? null}
          error={detailError}
          incident={selectedIncident}
          loading={detailLoading}
          onAction={performIncidentAction ? handlePerformAction : undefined}
          onBack={returnToList}
        />
      )}

      {sessionUsable && activeView === 'list' && (
        <IncidentListScreen
          error={listError}
          incidents={incidents}
          loading={listLoading}
          onCreate={createIncident && (!sessionController || session?.role === 'reporter') ? handleOpenCreate : undefined}
          onSelect={openIncident}
        />
      )}

      {sessionController && sessionUsable && incidentSync ? (
        <OfflineWorkspacePanel
          key={session?.generation}
          workspace={incidentSync}
          incident={activeView === 'detail' ? selectedIncident : null}
          onPendingChanged={setHasLocalPending}
          onRecovered={(incident) => {
            if (isCurrent(session?.generation)) { setSelectedIncident(incident); setDetailError(null); setActiveView('detail'); }
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

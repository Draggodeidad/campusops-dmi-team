import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { CreateIncidentScreen } from './incidents/CreateIncidentScreen';
import { IncidentDetailScreen } from './incidents/IncidentDetailScreen';
import { IncidentListScreen } from './incidents/IncidentListScreen';

type Props = Readonly<{
  getBackendStatus: GetBackendStatus;
  getIncidents: GetIncidents;
  getIncidentById: GetIncidentById;
  createIncident?: CreateIncident;
  sessionController?: SessionController;
  performIncidentAction?: PerformIncidentAction;
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
  getBackendStatus,
  getIncidents,
  getIncidentById,
  createIncident,
  sessionController,
  performIncidentAction,
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
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionController) return;
    const unsubscribe = sessionController.subscribe((snap) => {
      setSession(snap);
    });
    return unsubscribe;
  }, [sessionController]);

  useEffect(() => {
    let active = true;
    void getBackendStatus.execute().then((status) => active && setBackendStatus(status));
    void getIncidents
      .execute()
      .then((items) => active && setIncidents(items))
      .catch((error: unknown) => active && setListError(presentIncidentFailure(error, 'list')))
      .finally(() => active && setListLoading(false));
    return () => {
      active = false;
    };
  }, [getBackendStatus, getIncidents, session?.actorId]);

  const refreshIncidents = async () => {
    setListLoading(true);
    setListError(null);
    try {
      const items = await getIncidents.execute();
      setIncidents(items);
    } catch (error: unknown) {
      setListError(presentIncidentFailure(error, 'list'));
    } finally {
      setListLoading(false);
    }
  };

  const openIncident = async (id: string) => {
    setActiveView('detail');
    setDetailLoading(true);
    setDetailError(null);
    setActionError(null);
    try {
      const incident = await getIncidentById.execute(id);
      setSelectedIncident(incident);
      if (incident === null) setDetailError('La incidencia solicitada no existe.');
    } catch (error: unknown) {
      setDetailError(presentIncidentFailure(error, 'detail'));
    } finally {
      setDetailLoading(false);
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
    setCreateLoading(true);
    setCreateError(null);
    try {
      await createIncident.execute(data);
      await refreshIncidents();
      setActiveView('list');
    } catch (error: unknown) {
      setCreateError(presentIncidentFailure(error, 'create'));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogin = async (actorId: string) => {
    if (!sessionController) return;
    try {
      await sessionController.login(actorId);
      await refreshIncidents();
    } catch {
      // Ignorar o manejar error de inicio de sesión
    }
  };

  const handleLogout = async () => {
    if (!sessionController) return;
    try {
      await sessionController.logout();
      await refreshIncidents();
    } catch {
      // Ignorar o manejar error de logout
    }
  };

  const handlePerformAction = async (
    action: 'start' | 'resolve' | 'close' | 'reopen',
    diagnosis?: string,
  ) => {
    if (!performIncidentAction || !selectedIncident) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const actionPayload: PerformIncidentActionInput = {
        incidentId: selectedIncident.id,
        action,
        baseVersion: 1, // Versión base inicial en campusops.mjs
        actorRole: session?.role ?? null,
        ...(diagnosis !== undefined ? { diagnosis } : {}),
      };
      const updated = await performIncidentAction.execute(actionPayload);
      setSelectedIncident(updated);
      await refreshIncidents();
    } catch (err: unknown) {
      if (err instanceof ApplicationFailure) {
        setActionError(err.message);
      } else {
        setActionError('No fue posible ejecutar la acción.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
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
            {session.state === 'anonymous' ? (
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
                onPress={handleLogout}
                style={styles.logoutBtn}
                testID="logout-button"
              >
                <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {activeView === 'create' && (
        <CreateIncidentScreen
          error={createError}
          loading={createLoading}
          onCancel={handleCancelCreate}
          onSubmit={handleCreateSubmit}
        />
      )}

      {activeView === 'detail' && (
        <IncidentDetailScreen
          actionError={actionError}
          actionLoading={actionLoading}
          currentRole={session?.role ?? null}
          error={detailError}
          incident={selectedIncident}
          loading={detailLoading}
          onAction={performIncidentAction ? handlePerformAction : undefined}
          onBack={returnToList}
        />
      )}

      {activeView === 'list' && (
        <IncidentListScreen
          error={listError}
          incidents={incidents}
          loading={listLoading}
          onCreate={createIncident ? handleOpenCreate : undefined}
          onSelect={openIncident}
        />
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 20, padding: 24 },
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

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { CreateIncident, CreateIncidentInput } from '../application/incidents/CreateIncident';
import { ApplicationFailure } from '../application/errors/ApplicationFailure';
import type { GetIncidentById } from '../application/incidents/GetIncidentById';
import type { GetIncidents } from '../application/incidents/GetIncidents';
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
  }, [getBackendStatus, getIncidents]);

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

  return (
    <View style={styles.screen}>
      <View accessibilityRole="summary" style={styles.header}>
        <Text style={styles.brand}>CampusOps</Text>
        <Text>Incidencias del campus · entorno académico ficticio</Text>
        <Text testID="backend-status">Backend: {backendStatus}</Text>
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
          error={detailError}
          incident={selectedIncident}
          loading={detailLoading}
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
});

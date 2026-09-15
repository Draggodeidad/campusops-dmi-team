import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { GetIncidentById } from '../application/incidents/GetIncidentById';
import type { GetIncidents } from '../application/incidents/GetIncidents';
import type { BackendStatus, GetBackendStatus } from '../application/system/GetBackendStatus';
import type { Incident } from '../domain/incidents/Incident';
import { IncidentDetailScreen } from './incidents/IncidentDetailScreen';
import { IncidentListScreen } from './incidents/IncidentListScreen';

type Props = Readonly<{
  getBackendStatus: GetBackendStatus;
  getIncidents: GetIncidents;
  getIncidentById: GetIncidentById;
}>;

export function CampusOpsApp({ getBackendStatus, getIncidents, getIncidentById }: Props) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | 'checking'>('checking');
  const [incidents, setIncidents] = useState<readonly Incident[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void getBackendStatus.execute().then((status) => active && setBackendStatus(status));
    void getIncidents
      .execute()
      .then((items) => active && setIncidents(items))
      .catch(() => active && setListError('No fue posible cargar las incidencias.'))
      .finally(() => active && setListLoading(false));
    return () => {
      active = false;
    };
  }, [getBackendStatus, getIncidents]);

  const openIncident = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const incident = await getIncidentById.execute(id);
      setSelectedIncident(incident);
      if (incident === null) setDetailError('La incidencia solicitada no existe.');
    } catch {
      setDetailError('No fue posible cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  };

  const returnToList = () => {
    setSelectedId(null);
    setSelectedIncident(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  return (
    <View style={styles.screen}>
      <View accessibilityRole="summary" style={styles.header}>
        <Text style={styles.brand}>CampusOps</Text>
        <Text>Incidencias del campus · entorno académico ficticio</Text>
        <Text testID="backend-status">Backend: {backendStatus}</Text>
      </View>
      {selectedId === null ? (
        <IncidentListScreen
          error={listError}
          incidents={incidents}
          loading={listLoading}
          onSelect={openIncident}
        />
      ) : (
        <IncidentDetailScreen
          error={detailError}
          incident={selectedIncident}
          loading={detailLoading}
          onBack={returnToList}
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

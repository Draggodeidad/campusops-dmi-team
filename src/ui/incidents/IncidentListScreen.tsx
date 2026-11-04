import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RemoteUiState } from '../../application/ui-state/RemoteUiState';
import { RemoteRequestFeedback } from './RemoteRequestFeedback';
import type { Incident } from '../../domain/incidents/Incident';

type Props = Readonly<{
  state: RemoteUiState<readonly Incident[]>;
  onCancel: () => void;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onCreate?: (() => void) | undefined;
}>;

const statusLabels: Record<Incident['status'], string> = {
  open: 'Abierta',
  assigned: 'Asignada',
  in_progress: 'En proceso',
  resolved: 'Resuelta',
  closed: 'Cerrada',
};

export function IncidentListScreen({ state, onCancel, onRetry, onSelect, onCreate }: Props) {
  const incidents = 'value' in state ? state.value : [];

  return (
    <View style={styles.list}>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={styles.heading}>
          Incidencias
        </Text>
        {onCreate && (state.state === 'success' || state.state === 'empty') && (
          <Pressable
            accessibilityRole="button"
            onPress={onCreate}
            style={styles.createButton}
            testID="open-create-incident"
          >
            <Text style={styles.createButtonText}>+ Reportar</Text>
          </Pressable>
        )}
      </View>

      <RemoteRequestFeedback
        state={state}
        label="lista"
        loading="Cargando incidencias…"
        empty="No hay incidencias registradas."
        cancel={onCancel}
        retry={onRetry}
      />
      {incidents.map((incident) => (
        <Pressable
          accessibilityRole="button"
          key={incident.id}
          onPress={() => { onSelect(incident.id); }}
          style={styles.card}
          testID={`incident-${incident.id}`}
        >
          <Text style={styles.title}>{incident.title}</Text>
          <Text>{incident.locationLabel}</Text>
          <Text>{statusLabels[incident.status]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 20, fontWeight: '700' },
  createButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  createButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  card: { gap: 4, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14 },
  title: { fontSize: 16, fontWeight: '600' },
});

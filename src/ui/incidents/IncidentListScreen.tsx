import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Incident } from '../../domain/incidents/Incident';

type Props = Readonly<{
  incidents: readonly Incident[];
  loading: boolean;
  error: string | null;
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

export function IncidentListScreen({ incidents, loading, error, onSelect, onCreate }: Props) {
  if (loading) return <Text accessibilityRole="progressbar">Cargando incidencias…</Text>;
  if (error) return <Text accessibilityRole="alert">{error}</Text>;

  return (
    <View style={styles.list}>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={styles.heading}>
          Incidencias
        </Text>
        {onCreate && (
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

      {incidents.length === 0 ? (
        <Text style={styles.emptyText}>No hay incidencias registradas.</Text>
      ) : (
        incidents.map((incident) => (
          <Pressable
            accessibilityRole="button"
            key={incident.id}
            onPress={() => onSelect(incident.id)}
            style={styles.card}
            testID={`incident-${incident.id}`}
          >
            <Text style={styles.title}>{incident.title}</Text>
            <Text>{incident.locationLabel}</Text>
            <Text>{statusLabels[incident.status]}</Text>
          </Pressable>
        ))
      )}
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
  emptyText: { marginTop: 8, color: '#555' },
});

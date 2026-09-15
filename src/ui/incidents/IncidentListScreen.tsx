import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Incident } from '../../domain/incidents/Incident';

type Props = Readonly<{
  incidents: readonly Incident[];
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
}>;

const statusLabels: Record<Incident['status'], string> = {
  open: 'Abierta',
  assigned: 'Asignada',
  in_progress: 'En proceso',
  resolved: 'Resuelta',
  closed: 'Cerrada',
};

export function IncidentListScreen({ incidents, loading, error, onSelect }: Props) {
  if (loading) return <Text accessibilityRole="progressbar">Cargando incidencias…</Text>;
  if (error) return <Text accessibilityRole="alert">{error}</Text>;
  if (incidents.length === 0) return <Text>No hay incidencias registradas.</Text>;

  return (
    <View style={styles.list}>
      <Text accessibilityRole="header" style={styles.heading}>
        Incidencias
      </Text>
      {incidents.map((incident) => (
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  heading: { fontSize: 20, fontWeight: '700' },
  card: { gap: 4, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14 },
  title: { fontSize: 16, fontWeight: '600' },
});

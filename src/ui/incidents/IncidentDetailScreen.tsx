import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Incident } from '../../domain/incidents/Incident';

type Props = Readonly<{
  incident: Incident | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}>;

export function IncidentDetailScreen({ incident, loading, error, onBack }: Props) {
  return (
    <View style={styles.detail}>
      <Pressable accessibilityRole="button" onPress={onBack} testID="back-to-incidents">
        <Text style={styles.back}>← Volver a incidencias</Text>
      </Pressable>
      {loading ? <Text accessibilityRole="progressbar">Cargando detalle…</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {incident ? (
        <View style={styles.card} testID="incident-detail">
          <Text accessibilityRole="header" style={styles.title}>
            {incident.title}
          </Text>
          <Text>ID: {incident.id}</Text>
          <Text>Ubicación: {incident.locationLabel}</Text>
          <Text>Categoría: {incident.category}</Text>
          <Text>Estado: {incident.status}</Text>
          <Text>{incident.description}</Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Selecciona una incidencia para ver sus detalles.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { gap: 16 },
  back: { color: '#1d4ed8', fontWeight: '600' },
  card: { gap: 8, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  emptyState: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  emptyTitle: { color: '#334155', fontSize: 16 },
});

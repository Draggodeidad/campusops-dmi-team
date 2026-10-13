import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CampusRole } from '../../campusops/contracts';
import type { Incident } from '../../domain/incidents/Incident';

type Props = Readonly<{
  incident: Incident | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  currentRole?: CampusRole | null | undefined;
  onAction?:
    | ((action: 'start' | 'resolve' | 'close' | 'reopen', diagnosis?: string | undefined) => Promise<void>)
    | undefined;
  actionLoading?: boolean | undefined;
  actionError?: string | null | undefined;
}>;

export function IncidentDetailScreen({
  incident,
  loading,
  error,
  onBack,
  currentRole,
  onAction,
  actionLoading = false,
  actionError = null,
}: Props) {
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

          {onAction && currentRole && (
            <View style={styles.actionsContainer}>
              <Text style={styles.actionsTitle}>Acciones disponibles ({currentRole}):</Text>

              {currentRole === 'technician' && incident.status === 'assigned' && (
                <Pressable
                  accessibilityRole="button"
                  disabled={actionLoading}
                  onPress={() => onAction('start')}
                  style={styles.actionButton}
                  testID="action-start"
                >
                  <Text style={styles.actionButtonText}>
                    {actionLoading ? 'Procesando…' : 'Iniciar atención'}
                  </Text>
                </Pressable>
              )}

              {currentRole === 'technician' && incident.status === 'in_progress' && (
                <Pressable
                  accessibilityRole="button"
                  disabled={actionLoading}
                  onPress={() => onAction('resolve', 'Atención técnica completada.')}
                  style={styles.actionButton}
                  testID="action-resolve"
                >
                  <Text style={styles.actionButtonText}>
                    {actionLoading ? 'Procesando…' : 'Resolver incidencia'}
                  </Text>
                </Pressable>
              )}

              {currentRole === 'coordinator' && incident.status === 'resolved' && (
                <Pressable
                  accessibilityRole="button"
                  disabled={actionLoading}
                  onPress={() => onAction('close')}
                  style={styles.actionButton}
                  testID="action-close"
                >
                  <Text style={styles.actionButtonText}>
                    {actionLoading ? 'Procesando…' : 'Cerrar incidencia'}
                  </Text>
                </Pressable>
              )}

              {currentRole === 'coordinator' &&
                (incident.status === 'closed' || incident.status === 'resolved') && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={actionLoading}
                    onPress={() => onAction('reopen')}
                    style={styles.actionButton}
                    testID="action-reopen"
                  >
                    <Text style={styles.actionButtonText}>
                      {actionLoading ? 'Procesando…' : 'Reabrir incidencia'}
                    </Text>
                  </Pressable>
                )}

              {actionError ? <Text accessibilityRole="alert" style={styles.actionErrorText}>{actionError}</Text> : null}
            </View>
          )}
        </View>
      ) : !loading && !error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Selecciona una incidencia para ver sus detalles.</Text>
        </View>
      ) : null}
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
  actionsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 8 },
  actionsTitle: { fontSize: 14, fontWeight: '600', color: '#475569' },
  actionButton: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' },
  actionButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  actionErrorText: { color: '#dc2626', fontSize: 13, marginTop: 4 },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AllowedIncidentAction } from '../../application/incidents/PerformIncidentAction';
import { remoteUiActions } from '../../application/ui-state/RemoteUiState';
import type { RemoteUiState } from '../../application/ui-state/RemoteUiState';
import { RemoteRequestFeedback } from './RemoteRequestFeedback';
import type { CampusRole } from '../../campusops/contracts';
import type { Incident } from '../../domain/incidents/Incident';

type Props = Readonly<{
  state: RemoteUiState<Incident> | null;
  incident: Incident | null;
  attention?: RemoteUiState<Incident> | null;
  writing?: boolean;
  checkingWorkspace?: boolean;
  onBack: () => void;
  onCancel?: () => void;
  onCancelAttention?: () => void;
  onRetry?: () => void;
  currentRole?: CampusRole | null;
  onAction?: ((action: AllowedIncidentAction, diagnosis?: string) => Promise<void>) | undefined;
}>;

export function IncidentDetailScreen({
  state,
  incident,
  attention,
  writing = false,
  checkingWorkspace = false,
  onBack,
  onCancel,
  onCancelAttention,
  onRetry,
  currentRole,
  onAction,
}: Props) {
  const next = attention ? remoteUiActions[attention.state] : 'continue';
  const disabled = writing || checkingWorkspace || state?.state === 'offline' || next !== 'continue';
  return (
    <View style={styles.detail}>
      <Pressable accessibilityRole="button" onPress={onBack} testID="back-to-incidents">
        <Text style={styles.back}>← Volver a incidencias</Text>
      </Pressable>
      {state && <RemoteRequestFeedback
        state={state}
        label="detalle"
        loading="Cargando detalle…"
        empty="La incidencia solicitada no existe."
        cancel={onCancel}
        retry={onRetry}
      />}
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
              {checkingWorkspace && <Text accessibilityLiveRegion="polite">Comprueba los cambios locales para habilitar la atención.</Text>}

              {currentRole === 'technician' && incident.status === 'assigned' && (
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  accessibilityState={{ disabled }}
                  onPress={() => { void onAction('start'); }}
                  style={styles.actionButton}
                  testID="action-start"
                >
                  <Text style={styles.actionButtonText}>
                    Iniciar atención
                  </Text>
                </Pressable>
              )}

              {currentRole === 'technician' && incident.status === 'in_progress' && (
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  accessibilityState={{ disabled }}
                  onPress={() => { void onAction('resolve', 'Atención técnica completada.'); }}
                  style={styles.actionButton}
                  testID="action-resolve"
                >
                  <Text style={styles.actionButtonText}>
                    Resolver incidencia
                  </Text>
                </Pressable>
              )}

              {currentRole === 'coordinator' && incident.status === 'resolved' && (
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  accessibilityState={{ disabled }}
                  onPress={() => { void onAction('close'); }}
                  style={styles.actionButton}
                  testID="action-close"
                >
                  <Text style={styles.actionButtonText}>
                    Cerrar incidencia
                  </Text>
                </Pressable>
              )}

              {currentRole === 'coordinator' &&
                (incident.status === 'closed' || incident.status === 'resolved') && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={disabled}
                  accessibilityState={{ disabled }}
                    onPress={() => { void onAction('reopen'); }}
                    style={styles.actionButton}
                    testID="action-reopen"
                  >
                    <Text style={styles.actionButtonText}>
                      Reabrir incidencia
                    </Text>
                  </Pressable>
                )}

            </View>
          )}
          {attention?.state === 'cancelled' && writing && (
            <Text accessibilityLiveRegion="polite">La operación puede completarse. Podrás consultar su estado al terminar.</Text>
          )}
          {attention && <RemoteRequestFeedback
            state={attention}
            label="atención"
            loading="Procesando atención…"
            cancel={onCancelAttention}
            retry={writing ? undefined : onRetry}
            retryLabel="Consultar estado de"
          />}
          {attention?.state === 'success' && <Text accessibilityLiveRegion="polite">Atención confirmada.</Text>}
          {next === 'sync' && <Text accessibilityLiveRegion="polite">Cambio pendiente. Sincroniza los cambios guardados antes de continuar la atención.</Text>}
          {next === 'review' && <Text accessibilityRole="alert">Conflicto. Revisa los cambios guardados antes de continuar la atención.</Text>}
        </View>
      ) : !state ? (
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
});

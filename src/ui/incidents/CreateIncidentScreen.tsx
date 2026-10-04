import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { IncidentCategory } from '../../campusops/contracts';

const CATEGORIES: readonly { id: IncidentCategory; label: string }[] = [
  { id: 'electrical', label: 'Eléctrica' },
  { id: 'laboratory', label: 'Laboratorio' },
  { id: 'water', label: 'Agua / Plomería' },
  { id: 'connectivity', label: 'Conectividad / Red' },
  { id: 'equipment', label: 'Equipamiento' },
  { id: 'safety', label: 'Seguridad' },
  { id: 'maintenance', label: 'Mantenimiento' },
];

type Props = Readonly<{
  loading: boolean;
  error: string | null;
  onSubmit: (data: {
    category: IncidentCategory;
    description: string;
    locationLabel: string;
  }) => void;
  onCancel: () => void;
}>;

export function CreateIncidentScreen({ loading, error, onSubmit, onCancel }: Props) {
  const [category, setCategory] = useState<IncidentCategory>('connectivity');
  const [description, setDescription] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (description.trim().length === 0) {
      setValidationError('La descripción no puede estar vacía.');
      return;
    }
    if (locationLabel.trim().length === 0) {
      setValidationError('La ubicación no puede estar vacía.');
      return;
    }
    setValidationError(null);
    onSubmit({
      category,
      description: description.trim(),
      locationLabel: locationLabel.trim(),
    });
  };

  const displayedError = validationError ?? error;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Reportar Incidencia</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.cancelLink}
          testID="create-cancel-button"
        >
          <Text style={styles.cancelLinkText}>Volver</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.categoriesContainer}>
        {CATEGORIES.map((cat) => {
          const selected = cat.id === category;
          return (
            <Pressable
              accessibilityRole="button"
              key={cat.id}
              onPress={() => setCategory(cat.id)}
              style={[styles.categoryBadge, selected && styles.categoryBadgeSelected]}
              testID={`category-${cat.id}`}
            >
              <Text
                style={[styles.categoryBadgeText, selected && styles.categoryBadgeTextSelected]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        accessibilityLabel="Descripción de la incidencia"
        multiline
        numberOfLines={3}
        onChangeText={(text) => {
          setDescription(text);
          if (validationError) setValidationError(null);
        }}
        placeholder="Ej. Falla de conexión en aula magna..."
        style={[styles.input, styles.textArea]}
        testID="create-description-input"
        value={description}
      />

      <Text style={styles.label}>Ubicación</Text>
      <TextInput
        accessibilityLabel="Ubicación"
        onChangeText={(text) => {
          setLocationLabel(text);
          if (validationError) setValidationError(null);
        }}
        placeholder="Ej. Edificio B, Aula 201"
        style={styles.input}
        testID="create-location-input"
        value={locationLabel}
      />

      {displayedError && (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorText} testID="create-incident-error">
            {displayedError}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#0066cc" />
          <Text accessibilityRole="progressbar" testID="create-loading-indicator">
            Registrando incidencia...
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          style={styles.submitButton}
          testID="create-submit-button"
        >
          <Text style={styles.submitButtonText}>Registrar Incidencia</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  cancelLink: { padding: 6 },
  cancelLinkText: { color: '#0066cc', fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  categoriesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
  },
  categoryBadgeSelected: {
    borderColor: '#0066cc',
    backgroundColor: '#0066cc',
  },
  categoryBadgeText: { fontSize: 13, color: '#333' },
  categoryBadgeTextSelected: { color: '#fff', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  errorBox: {
    padding: 10,
    backgroundColor: '#fde8e8',
    borderRadius: 8,
    borderColor: '#f98080',
    borderWidth: 1,
  },
  errorText: { color: '#9b1c1c', fontSize: 13 },
  submitButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
});

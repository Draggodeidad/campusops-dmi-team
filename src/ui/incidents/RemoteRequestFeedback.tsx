import { Pressable, Text, View } from 'react-native';

import { remoteUiActions } from '../../application/ui-state/RemoteUiState';
import type { RemoteUiState } from '../../application/ui-state/RemoteUiState';

type Props = Readonly<{
  state: RemoteUiState<unknown>;
  label: string;
  loading: string;
  empty?: string;
  cancel?: (() => void) | undefined;
  retry?: (() => void) | undefined;
  retryLabel?: string;
}>;

export function RemoteRequestFeedback({ state, label, loading, empty, cancel, retry, retryLabel }: Props) {
  const action = remoteUiActions[state.state];
  switch (action) {
    case 'cancel':
      return (
        <View>
          <Text accessibilityRole="progressbar" accessibilityLabel={loading}>{loading}</Text>
          {cancel && (
            <Pressable accessibilityRole="button" onPress={cancel}>
              <Text>Cancelar {label}</Text>
            </Pressable>
          )}
        </View>
      );
    case 'retry':
    case 'reload': {
      const message = state.state === 'error' ? state.error
        : state.state === 'empty' ? empty
        : state.state === 'offline' ? 'Modo sin conexión: copia local de esta cuenta.'
        : 'Espera cancelada.';
      const button = retryLabel ?? (state.state === 'offline' ? 'Reintentar conexión' : action === 'reload' ? 'Actualizar' : 'Reintentar');
      return (
        <View>
          <Text accessibilityRole={state.state === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite">{message}</Text>
          {retry && (
            <Pressable accessibilityRole="button" onPress={() => { retry(); }}>
              <Text>{button} {label}</Text>
            </Pressable>
          )}
        </View>
      );
    }
    default:
      return null;
  }
}

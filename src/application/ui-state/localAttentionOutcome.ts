import type { Incident } from '../../domain/incidents/Incident';
import type { LocalIncidentView } from '../sync/IncidentWorkspace';

export function localAttentionOutcome(view: LocalIncidentView | undefined):
  { state: 'pending' | 'conflict'; value: Incident } | null {
  if (!view) return null;
  if (view.operations.some(({ state }) => state.state === 'conflict' || state.state === 'forbidden')) {
    return { state: 'conflict', value: view.incident };
  }
  if (view.operations.some(({ state }) => state.state === 'pending' || state.state === 'retry')) {
    return { state: 'pending', value: view.incident };
  }
  return null;
}

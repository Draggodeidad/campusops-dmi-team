export type ApplicationFailureCode =
  | 'INVALID_RETRY_CONFIGURATION'
  | 'RETRY_BUDGET_EXHAUSTED'
  | 'INCIDENTS_UNAVAILABLE'
  | 'INCIDENT_UNAVAILABLE'
  | 'INVALID_INCIDENT_ID'
  | 'INVALID_SESSION_SECRET'
  | 'SECURE_STORAGE_UNAVAILABLE'
  | 'CREATE_INCIDENT_FAILED'
  | 'INVALID_INCIDENT_INPUT'
  | 'REMOTE_COMMUNICATION_ERROR'
  | 'INCIDENT_TIMEOUT'
  | 'AUTHENTICATION_FAILED'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED_ACTION'
  | 'UPDATE_INCIDENT_FAILED'
  | 'VERSION_CONFLICT'
  | 'LOCAL_STORAGE_UNAVAILABLE'
  | 'SYNC_CONFIRMATION_INVALID';

export type ApplicationFailureReason = 'contract' | 'server' | 'payload_unavailable';

/** Public failure only: never attach a provider error or sensitive input as cause. */
export class ApplicationFailure extends Error {
  constructor(
    readonly code: ApplicationFailureCode,
    message: string,
    readonly reason?: ApplicationFailureReason,
  ) {
    super(message);
    this.name = 'ApplicationFailure';
  }
}

export type ApplicationFailureCode =
  | 'INCIDENTS_UNAVAILABLE'
  | 'INCIDENT_UNAVAILABLE'
  | 'INVALID_INCIDENT_ID'
  | 'INVALID_SESSION_SECRET'
  | 'SECURE_STORAGE_UNAVAILABLE';

/** Public failure only: never attach a provider error or sensitive input as cause. */
export class ApplicationFailure extends Error {
  constructor(
    readonly code: ApplicationFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationFailure';
  }
}

/** Narrow persistence boundary for a future authenticated session. */
export interface SessionSecretStore {
  save(secret: string): Promise<void>;
  read(): Promise<string | null>;
  clear(): Promise<void>;
}

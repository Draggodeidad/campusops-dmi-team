/** Versioned JSON snapshot shared by persistence, sync and public evaluation. */
export type SyncRecord = Readonly<{
  id: string;
  version: number;
  fields: Readonly<Record<string, unknown>>;
}>;

import type { CampusRole } from '../../campusops/contracts';

export type SessionState =
  | 'anonymous'
  | 'signing-in'
  | 'authenticated'
  | 'expired'
  | 'refreshing'
  | 'logging-out';

export type SessionSnapshot = Readonly<{
  state: SessionState;
  actorId: string | null;
  role: CampusRole | null;
  expiresAt: number | null;
  generation: number;
}>;

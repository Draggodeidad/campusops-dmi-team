import type { CampusRole } from '../../campusops/contracts';

export type SessionTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}>;

export interface SessionProvider {
  login(actorId: string): Promise<SessionTokens & Readonly<{
    actorId: string;
    role: CampusRole;
  }>>;
  refresh(refreshToken: string): Promise<SessionTokens>;
}

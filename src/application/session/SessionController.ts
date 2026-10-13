import type { SessionSnapshot } from './SessionSnapshot';

export interface SessionController {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  login(actorId: string): Promise<void>;
  refresh(): Promise<void>;
  logout(): Promise<void>;
  restore(): Promise<void>;
}

import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';

export type BackendResponse<T = Record<string, unknown>> = Readonly<{
  status: number;
  body: T;
}>;

export type BackendRequest = Readonly<{
  method?: 'GET' | 'POST';
  actorId?: string;
  accessToken?: string;
  body?: unknown;
  idempotencyKey?: string;
}>;

export type LocalBackend = Readonly<{
  baseUrl: string;
  request<T = Record<string, unknown>>(
    path: string,
    options?: BackendRequest,
  ): Promise<BackendResponse<T>>;
  stop(): Promise<void>;
}>;

export async function startLocalBackend(): Promise<LocalBackend> {
  const child = spawn(process.execPath, ['course-backend/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, COURSE_BACKEND_HOST: '127.0.0.1', COURSE_BACKEND_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const baseUrl = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local backend startup timed out')), 5000);
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Local backend exited before startup: ${code}`));
    });
  });

  return {
    baseUrl,
    request<T = Record<string, unknown>>(path: string, options: BackendRequest = {}) {
      const url = new URL(path, baseUrl);
      const bodyText = options.body === undefined ? undefined : JSON.stringify(options.body);
      const headers: Record<string, string> = {
        ...(options.actorId ? { 'x-course-actor': options.actorId } : {}),
        ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
        ...(bodyText ? { 'content-type': 'application/json' } : {}),
      };

      return new Promise<BackendResponse<T>>((resolve, reject) => {
        const request = httpRequest(
          url,
          { method: options.method ?? (bodyText ? 'POST' : 'GET'), headers },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8');
              let parsed: T;
              try {
                parsed = text ? (JSON.parse(text) as T) : ({} as T);
              } catch (error) {
                reject(error);
                return;
              }
              resolve({ status: response.statusCode ?? 0, body: parsed });
            });
          },
        );
        request.once('error', reject);
        if (bodyText) request.write(bodyText);
        request.end();
      });
    },
    async stop() {
      if (child.exitCode !== null || child.killed) return;
      await new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
      });
    },
  };
}

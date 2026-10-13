/* Independent W06 review probes. Exercise production code without native SDKs.
 * Exit 1 means a required invariant is broken; never use this as a bypass.
 * Fixtures are synthetic. Output contains booleans/counters, never tokens.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

const { DefaultSessionController } = require('../src/application/session/DefaultSessionController.ts');
const { SessionTransportDecorator } = require('../src/infrastructure/http/SessionTransportDecorator.ts');
const { HttpIncidentRepository } = require('../src/infrastructure/incidents/HttpIncidentRepository.ts');
const { coordinateRefresh } = require('../src/course-evaluation/index.ts');
const tokens = { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', expiresIn: 60 };
const provider = {
  login: async (actorId) => ({ actorId, role: actorId.startsWith('technician') ? 'technician' : 'reporter', ...tokens }),
  refresh: async () => tokens,
};
const emptyList = { status: 200, bodyText: '{"items":[]}' };
const clock = { now: () => 0 };
const checks = [];

async function probe(id, run) {
  let observed;
  const record = (value) => { observed = value; };
  try {
    await run(record);
    checks.push({ id, status: 'pass', observed });
  } catch (error) {
    if (!(error instanceof assert.AssertionError)) throw error;
    checks.push({ id, status: 'fail', observed });
  }
}

async function main() {
  await probe('repository-uses-active-session-actor', async (record) => {
    const controller = new DefaultSessionController(provider, undefined, clock);
    await controller.login('technician-1');
    let actor;
    const transport = { send: async (request) => { actor = request.headers['x-course-actor']; return emptyList; } };
    await new HttpIncidentRepository(new SessionTransportDecorator(transport, controller)).findAll();
    record({ activeActorMatchesOutgoingActor: actor === controller.getActorId() });
    assert.equal(actor, controller.getActorId());
  });

  await probe('anonymous-repository-does-not-send-fixture-authorization', async (record) => {
    const controller = new DefaultSessionController(provider, undefined, clock);
    let authorized = false;
    const transport = { send: async (request) => { authorized = Boolean(request.headers.authorization); return emptyList; } };
    await new HttpIncidentRepository(new SessionTransportDecorator(transport, controller)).findAll();
    record({ anonymous: controller.getSnapshot().state === 'anonymous', sentAuthorization: authorized });
    assert.equal(authorized, false);
  });

  await probe('old-401-is-not-replayed-as-new-actor', async (record) => {
    const controller = new DefaultSessionController(provider, undefined, clock);
    await controller.login('reporter-1');
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const actors = [];
    const transport = { send: async (request) => {
      actors.push(request.headers['x-course-actor']);
      return actors.length === 1 ? pending : emptyList;
    } };
    const response = new SessionTransportDecorator(transport, controller).send({ method: 'POST', path: '/v1/incidents', body: '{}' });
    await controller.login('technician-1');
    release({ status: 401, bodyText: '{}' });
    await response;
    record({ attempts: actors.length, replayedUnderNewActor: actors[1] === 'technician-1' });
    assert.equal(actors.length, 1);
  });

  await probe('evaluation-rejects-refresh-success-after-logout', async (record) => {
    const result = coordinateRefresh([
      { type: 'request401', requestId: 'review-request', generation: 0 },
      { type: 'logout' },
      { type: 'refreshSucceeded', generation: 1, token: 'synthetic-late-result' },
    ]);
    record({ state: result.status, retainedToken: result.persistedToken !== null });
    assert.equal(result.status, 'anonymous');
  });

  await probe('expired-request-refreshes-before-send', async (record) => {
    let now = 0;
    let refreshCalls = 0;
    const controller = new DefaultSessionController({ ...provider, refresh: async () => { refreshCalls++; return tokens; } }, undefined, { now: () => now });
    await controller.login('reporter-1');
    now = 60000;
    const expired = controller.getSnapshot().state === 'expired';
    let callsBeforeSend;
    await new SessionTransportDecorator({ send: async () => { callsBeforeSend = refreshCalls; return emptyList; } }, controller).send({ method: 'GET', path: '/v1/incidents' });
    record({ expired, refreshCallsBeforeSend: callsBeforeSend });
    assert.equal(callsBeforeSend, 1);
  });

  await probe('restore-rejects-invalid-role-and-empty-tokens', async (record) => {
    let clears = 0;
    const storage = {
      save: async () => {}, clear: async () => { clears++; },
      read: async () => JSON.stringify({ schemaVersion: 1, actorId: '', role: 'invalid', accessToken: '', refreshToken: '', expiresAt: 60000 }),
    };
    const controller = new DefaultSessionController(provider, storage, clock);
    await controller.restore();
    record({ state: controller.getSnapshot().state, clearCalls: clears });
    assert.equal(controller.getSnapshot().state, 'anonymous');
  });

  await probe('restore-completion-cannot-resurrect-after-logout', async (record) => {
    let release;
    const read = new Promise((resolve) => { release = resolve; });
    const storage = { save: async () => {}, clear: async () => {}, read: () => read };
    const controller = new DefaultSessionController(provider, storage, clock);
    const restoring = controller.restore();
    await controller.logout();
    release(JSON.stringify({ schemaVersion: 1, actorId: 'reporter-1', role: 'reporter', ...tokens, expiresAt: 60000 }));
    await restoring;
    record({ state: controller.getSnapshot().state });
    assert.equal(controller.getSnapshot().state, 'anonymous');
  });

  await probe('refresh-cleanup-reports-storage-delete-failure', async (record) => {
    const { ApplicationFailure } = require('../src/application/errors/ApplicationFailure.ts');
    let stored = null;
    const storage = {
      save: async (value) => { stored = value; }, read: async () => stored,
      clear: async () => { throw new ApplicationFailure('SECURE_STORAGE_UNAVAILABLE', 'Synthetic deletion failure.'); },
    };
    const controller = new DefaultSessionController({ ...provider, refresh: async () => { throw new Error('Synthetic refresh failure.'); } }, storage, clock);
    await controller.login('reporter-1');
    let code;
    try { await controller.refresh(); } catch (error) { code = error.code; }
    record({ errorCode: code, persistedRecordRemains: stored !== null, state: controller.getSnapshot().state });
    assert.equal(code, 'SECURE_STORAGE_UNAVAILABLE');
  });

  console.log(JSON.stringify({ week: 6, purpose: 'independent-readiness-review', checks }, null, 2));
  process.exitCode = checks.some((check) => check.status === 'fail') ? 1 : 0;
}

main().catch(() => { console.error('Readiness probe could not execute; inspect the probe setup.'); process.exitCode = 2; });

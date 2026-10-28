/* Loopback only: executes the production TS adapters with native Node fetch/timers. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const ts = require('typescript');

const root = path.resolve(path.dirname(require.resolve('./check-week-09-retry.cjs')), '..');
require.extensions['.ts'] = (module, filename) => {
  const relative = path.relative(root, filename);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Source outside repository');
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, filename);
};
const { FetchIncidentTransport } = require('../src/infrastructure/http/FetchIncidentTransport.ts');
const { IncidentRetryExecutor } = require('../src/infrastructure/http/IncidentRetryExecutor.ts');
const { SystemResilienceClock } = require('../src/infrastructure/http/SystemResilienceClock.ts');
const { createLostResponseFixture } = require('../course-tests/fixtures/week-09/scenario.ts');
const fixture = createLostResponseFixture();
const clock = new SystemResilienceClock();

async function startBackend() {
  const child = spawn(process.execPath, ['course-backend/server.mjs'], { cwd: root,
    env: { ...process.env, COURSE_BACKEND_HOST: '127.0.0.1', COURSE_BACKEND_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Backend startup timeout')), 5000);
      let output = '';
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = /http:\/\/127\.0\.0\.1:\d+/.exec(output);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Backend exited during startup')); });
    });
    return { child, url };
  } catch (error) { child.kill('SIGTERM'); throw error; }
}
async function main() {
  const { child, url } = await startBackend();
  const checks = [];
  const metrics = [];
  const fetchTransport = new FetchIncidentTransport(url, 2000, clock);
  const auth = actor => ({ authorization: 'Bearer course-valid-token', 'x-course-actor': actor });
  const request = (body, key, actor = 'technician-1') => ({ method: 'POST', path: fixture.request.path,
    body: JSON.stringify(body), headers: { ...auth(actor), 'idempotency-key': key }, timeoutMs: fixture.timeoutMs });
  const executor = new IncidentRetryExecutor(clock, undefined, metric => metrics.push(metric));
  try {
    const starts = [];
    const rateLimited = { async send(input) {
      starts.push(clock.now());
      const result = await fetchTransport.send({ ...input, headers: { ...input.headers,
        ...(starts.length === 1 ? { 'x-course-scenario': 'rate_limited' } : {}) } });
      if (starts.length === 1) assert.equal(result.retryAfterMs, 1000);
      return result;
    } };
    const get = { method: 'GET', path: '/v1/incidents', headers: auth('technician-1') };
    assert.equal((await executor.forRequest(rateLimited, get, async input => input).send(get)).status, 200);
    assert.equal(starts.length, 2); assert.ok(starts[1] - starts[0] >= 1000);
    checks.push({ id: 'get-429-real-retry-after', status: 'pass', scenarioType: 'boundary',
      command: 'npm run check:week-09-retry', evidence: { sends: starts.length, intervalMs: starts[1] - starts[0], minimumMs: 1000 } });
    const initial = await fetchTransport.send(request(fixture.preparation.body, fixture.preparation.operationId));
    assert.equal(initial.status, 201);
    for (const operation of [
      { key: fixture.operation.operationId, body: JSON.parse(fixture.request.body), actor: fixture.operation.actorId, expected: fixture.expected.status },
      { key: fixture.close.operationId, body: fixture.close.body, actor: fixture.close.actorId, expected: 'closed' },
    ]) {
      const writes = [];
      const lost = { async send(input) {
        writes.push(input);
        return fetchTransport.send({ ...input, headers: { ...input.headers,
          ...(writes.length === 1 ? { 'x-course-scenario': fixture.scenario } : {}) } });
      } };
      const post = request(operation.body, operation.key, operation.actor);
      const result = await executor.forRequest(lost, post, async input => input).send(post);
      const receipt = JSON.parse(result.bodyText);
      assert.equal(result.status, 200); assert.equal(receipt.duplicate, true);
      assert.equal(receipt.operationId, operation.key); assert.equal(receipt.incident.status, operation.expected);
      assert.equal(writes.length, 2); assert.equal(writes[0].body, writes[1].body);
      assert.equal(writes[0].headers['idempotency-key'], writes[1].headers['idempotency-key']);
      assert.equal(receipt.incident.payload.history.filter(entry => entry.operationId === operation.key).length, 1);
      assert.equal(receipt.incident.payload.evidence.length, 0); assert.equal(receipt.incident.payload.notes.length, 0);
      checks.push({ id: `lost-${operation.body.action}-response`, status: 'pass', scenarioType: 'failure',
        command: 'npm run check:week-09-retry', evidence: { sends: writes.length, duplicateReceipt: receipt.duplicate,
          stableKey: writes[0].headers['idempotency-key'] === writes[1].headers['idempotency-key'],
          identicalBody: writes[0].body === writes[1].body, effectCount: receipt.incident.payload.history.filter(entry => entry.operationId === operation.key).length, finalVersion: receipt.incident.version, finalStatus: receipt.incident.status } });
    }
    assert.equal(metrics.filter(metric => metric.status === 'timeout').length, 2);
    return { schemaVersion: 1, week: 9, commitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      sourceTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', '.', ':!reports', ':!evidence'],
        { cwd: root, encoding: 'utf8' }).trim()),
      generatedAt: new Date().toISOString(), checks: checks.map(check => ({ ...check, evidence: JSON.stringify(check.evidence) })), metrics,
      limitations: ['Loopback sintético; no proveedor externo ni dispositivo Android.', 'El backend no implementa notificaciones; no se acredita un envío real.'] };
  } finally {
    if (child.exitCode === null && !child.killed) await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
  }
}
main().then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(() => {
  process.stderr.write('W09 retry loopback check failed; assertions or transport did not complete.\n');
  process.exitCode = 1;
});

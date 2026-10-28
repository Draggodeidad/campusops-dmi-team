// Explicit opt-in external probe or deterministic loopback HTTP verification.
// Transpile the actual adapters in memory using the project's existing TypeScript.
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(output.outputText, filename);
};
const { PhotonLocationProvider, PHOTON_URL, SystemLocationClock } = require('../src/infrastructure/location/PhotonLocationProvider.ts');
const { FetchIncidentTransport } = require('../src/infrastructure/http/FetchIncidentTransport.ts');
const { LookupIncidentLocation } = require('../src/application/location/LookupIncidentLocation.ts');
const { MemoryLocationCache } = require('../src/infrastructure/location/MemoryLocationCache.ts');

async function local() {
  let calls = 0;
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    calls++;
    const query = new URL(request.url, 'http://localhost').searchParams.get('q');
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers['x-course-actor'], undefined);
    if (query === 'timeout ficticio') return; // Intentionally leave socket open until client abort.
    if (query === '429 ficticio') { response.writeHead(429, { 'Retry-After': '1' }); response.end('{}'); return; }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Zona ficticia' },
      geometry: { type: 'Point', coordinates: [0, 0] } }] }));
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const transport = new FetchIncidentTransport(`http://127.0.0.1:${server.address().port}`);
  const clock = new SystemLocationClock();
  const config = { timeoutMs: 250, cacheTtlMs: 300000 };
  const provider = new PhotonLocationProvider(transport, clock, config);
  const useCase = new LookupIncidentLocation(provider, new MemoryLocationCache(), clock, config);
  const manualLabel = 'Referencia manual ficticia';
  try {
    const success = await useCase.execute({ query: 'zona ficticia', manualLabel });
    assert.equal(success.location.source, 'provider');
    assert.equal((await useCase.execute({ query: ' ZONA FICTICIA ', manualLabel })).cacheHit, true);
    assert.equal(calls, 1);
    const timeoutStart = performance.now();
    const timeout = await useCase.execute({ query: 'timeout ficticio', manualLabel });
    const timeoutDurationMs = Math.round(performance.now() - timeoutStart);
    assert.equal(timeout.failure.kind, 'timeout');
    assert.deepEqual(timeout.location, { source: 'manual', label: manualLabel });
    const limited = await useCase.execute({ query: '429 ficticio', manualLabel });
    assert.equal(limited.failure.kind, 'rate_limited');
    assert.equal(limited.failure.retryAfterMs, 1000);
    const before = calls;
    const blocked = await useCase.execute({ query: 'otra zona ficticia', manualLabel });
    assert.equal(blocked.failure.kind, 'rate_limited'); assert.equal(calls, before);
    // Separate adapter after closed server demonstrates actual connection failure.
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
    const offlineProvider = new PhotonLocationProvider(transport, clock, config);
    const offline = await new LookupIncidentLocation(offlineProvider, new MemoryLocationCache(), clock, config)
      .execute({ query: 'zona desconectada ficticia', manualLabel });
    assert.equal(offline.failure.kind, 'offline');
    assert.equal(offline.location.source, 'manual');
    console.log(JSON.stringify({ scope: 'Actual FetchIncidentTransport + Photon adapter + Application over loopback HTTP',
      status: 'pass', checks: ['provider-success', 'cache-hit', 'socket-abort-timeout', '429-retry-after', 'cooldown-no-request', 'connection-refused-manual'],
      timeoutDurationMs, requestCount: calls }));
  } finally {
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}

async function external() {
  const clock = new SystemLocationClock();
  const transport = new FetchIncidentTransport(PHOTON_URL);
  let httpStatus = null;
  const observedTransport = { async send(request) {
    const response = await transport.send(request); httpStatus = response.status; return response;
  } };
  const timeoutArg = process.argv.find(value => value.startsWith('--timeout-ms='));
  const timeoutMs = timeoutArg ? Number(timeoutArg.slice('--timeout-ms='.length)) : 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid timeout');
  const configuration = { timeoutMs, cacheTtlMs: 0 };
  const provider = new PhotonLocationProvider(observedTransport, clock, configuration);
  const start = performance.now();
  const result = await new LookupIncidentLocation(provider, new MemoryLocationCache(), clock, configuration)
    .execute({ query: 'CampusOps Edificio de prueba A ficticio W09', manualLabel: 'Referencia manual ficticia' });
  const completed = httpStatus === 200 && result.failure?.kind !== 'invalid_response';
  console.log(JSON.stringify({ schemaVersion: 1, week: 9, commitSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    generatedAt: new Date().toISOString(), provider: 'Photon', endpoint: PHOTON_URL, fixtureId: 'w09-fictional-campus-location',
    command: `npm run check:week-09-location-provider${timeoutArg ? ` -- ${timeoutArg}` : ''}`, timeoutMs, httpStatus, durationMs: Math.round(performance.now() - start),
    outcome: result.location.source === 'provider' ? 'validated_result_redacted' : 'manual', failureKind: result.failure?.kind ?? null,
    externalExecutionConfirmed: completed, status: completed ? 'pass' : 'fail' }));
  if (!completed) process.exitCode = 1;
}

const mode = process.argv[2];
if (!['--local', '--external'].includes(mode)) throw new Error('Choose --local or explicit --external');
(mode === '--local' ? local() : external()).catch(() => {
  console.error(JSON.stringify({ status: 'fail', reason: 'location_probe_failed', details: 'redacted' })); process.exitCode = 1;
});

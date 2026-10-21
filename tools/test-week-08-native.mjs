// Dedicated debug APK/entry on the SAME Expo project; no production entry changes.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sdk = process.env.ANDROID_HOME ?? join(process.env.HOME, 'Android/Sdk');
const adb = join(sdk, 'platform-tools/adb');
const appId = 'mx.edu.dmi.engineeringapp.w08test';
const serial = process.env.ANDROID_SERIAL;
const adbArgs = serial ? ['-s', serial] : [];
const nativeEnv = { ...process.env, ANDROID_HOME: sdk, NODE_ENV: 'development' };
const run = (cmd, args, capture = false) => {
  const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', env: nativeEnv });
  if (result.status !== 0) throw new Error(`Command failed: ${cmd} (exit ${result.status})`);
  return result.stdout?.trim();
};
const device = (...args) => run(adb, [...adbArgs, ...args], true);
const appFile = name => {
  const read = spawnSync(adb, [...adbArgs, 'shell', 'run-as', appId, 'cat', `files/${name}`], { encoding: 'utf8' });
  return read.status === 0 ? read.stdout : undefined;
};
const waitFile = async name => {
  for (let attempt = 0; attempt < 120; attempt++) {
    const value = appFile(name);
    if (value) return JSON.parse(value);
    const failed = appFile('w08-native-result.json');
    if (failed && JSON.parse(failed).status === 'fail') throw new Error(failed);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for native result: ${name}`);
};

device('get-state'); // Fail early without a running device; ANDROID_SERIAL selects one.
run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install']);
const applicationPath = 'android/app/src/main/java/mx/edu/dmi/engineeringapp/MainApplication.kt';
const gradlePath = 'android/app/build.gradle';
const application = readFileSync(applicationPath, 'utf8');
const gradle = readFileSync(gradlePath, 'utf8');
let metro;
let installed = false;
let reversed = false;
try {
  if (!application.includes('context = applicationContext,') || !gradle.includes('buildTypes {')) throw new Error('Generated template changed; inspect native harness');
  writeFileSync(applicationPath, application.replace('context = applicationContext,', 'context = applicationContext,\n      jsMainModulePath = "tools/week-08-native-entry",'));
  writeFileSync(gradlePath, gradle.replace('buildTypes {\n        debug {', 'buildTypes {\n        debug {\n            applicationIdSuffix ".w08test"'));
  run('./android/gradlew', ['-p', 'android', 'assembleDebug', '-PreactNativeArchitectures=x86_64', '-PreactNativeDevServerPort=8098']);
  metro = spawn('npx', ['expo', 'start', '--localhost', '--port', '8098'], { stdio: 'inherit', env: { ...nativeEnv, CI: '1' }, detached: true });
  for (let i = 0; ; i++) {
    try { if ((await (await fetch('http://localhost:8098/status')).text()).includes('running')) break; } catch { /* startup */ }
    if (metro.exitCode !== null || i >= 60) throw new Error('Metro did not start');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  device('reverse', 'tcp:8098', 'tcp:8098');
  reversed = true;
  device('install', '-r', 'android/app/build/outputs/apk/debug/app-debug.apk');
  installed = true;
  // Only the isolated test application is cleared, never CampusOps user storage.
  device('shell', 'pm', 'clear', appId);
  const launch = () => device('shell', 'am', 'start', '-n', `${appId}/mx.edu.dmi.engineeringapp.MainActivity`);
  launch();
  await waitFile('w08-native-stage.json');
  const firstPid = device('shell', 'pidof', appId);
  device('shell', 'am', 'force-stop', appId);
  launch();
  const result = await waitFile('w08-native-result.json');
  const secondPid = device('shell', 'pidof', appId);
  if (firstPid === secondPid) throw new Error('Process identity did not change');
  console.log(JSON.stringify({ ...result, firstPid, secondPid, device: device('shell', 'getprop', 'ro.build.version.sdk') }, null, 2));
  if (result.status !== 'pass') process.exitCode = 1;
} finally {
  writeFileSync(applicationPath, application);
  writeFileSync(gradlePath, gradle);
  if (metro?.pid) { try { process.kill(-metro.pid, 'SIGTERM'); } catch { /* already stopped */ } }
  if (installed) device('uninstall', appId);
  if (reversed) device('reverse', '--remove', 'tcp:8098');
}

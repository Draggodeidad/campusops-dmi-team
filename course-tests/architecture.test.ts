import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { findViolations } = require('../tools/check-architecture.cjs') as {
  findViolations: (root: string) => readonly Readonly<{ dependency: string }>[];
};

test('the current source tree respects the declared dependency boundaries', () => {
  expect(findViolations('src')).toEqual([]);
});

test('the architecture check detects a direct UI-to-infrastructure import', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'campusops-architecture-'));
  try {
    mkdirSync(join(fixture, 'ui'), { recursive: true });
    mkdirSync(join(fixture, 'infrastructure'), { recursive: true });
    writeFileSync(join(fixture, 'ui', 'Screen.ts'), "import '../infrastructure/provider';\n");
    writeFileSync(join(fixture, 'infrastructure', 'provider.ts'), 'export {};\n');

    expect(findViolations(fixture)).toEqual([
      expect.objectContaining({ dependency: 'ui -> infrastructure' }),
    ]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

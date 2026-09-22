import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/week-03-ci-amenazas-feedback.yml', 'utf8');

test('Week 03 CI maps every required control to an explicit failing step', () => {
  for (const command of [
    'make setup',
    'npm run typecheck',
    'npm run lint',
    'npm test -- --ci --runInBand',
    'npm run check:architecture',
    'npm run scan:secrets',
    'npm run audit:ci',
    'npm run bundle:release',
    'npm test -- --ci --runInBand course-tests/public/week-03.test.ts',
  ]) {
    expect(workflow).toContain(`run: ${command}`);
  }

  expect(workflow).not.toMatch(/continue-on-error\s*:\s*true|\|\|\s*true|--passWithNoTests/i);
});

test('Week 03 CI uses fixed tooling, minimum permissions and durable diagnostics', () => {
  expect(workflow).toMatch(/push:\s*\n\s*pull_request:\s*\n\s*workflow_dispatch:/);
  expect(workflow).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  expect(workflow).toContain('uses: actions/checkout@v4');
  expect(workflow).toContain('uses: actions/setup-node@v4');
  expect(workflow).toContain("node-version: '22.22.0'");
  expect(workflow).toContain('cache: npm');
  expect(workflow).toMatch(/timeout-minutes:\s*25/);
  expect(workflow).toMatch(/concurrency:[\s\S]*cancel-in-progress:\s*true/);
  expect(workflow).toMatch(/if:\s*always\(\)[\s\S]*actions\/upload-artifact@v4/);
  expect(workflow).toContain('reports/week-03/**');
  expect(workflow).toContain('evidence/week-03/**');
});

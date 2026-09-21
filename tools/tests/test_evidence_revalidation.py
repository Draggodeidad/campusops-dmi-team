"""Exercise real merge history, failing commands, strict tags and provenance."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
spec = importlib.util.spec_from_file_location('revalidation', Path(__file__).resolve().parents[1] / 'revalidate-prior-evidence.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RevalidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Synthetic Test')
        self.git('config', 'user.email', 'fixture@example.invalid')
        (self.repo / 'code.txt').write_text('baseline')
        self.commit('baseline')
        self.source = self.git('rev-parse', 'HEAD')
        report = {'schemaVersion': 1, 'week': 1, 'commitSha': self.source, 'generatedAt': '2026-09-21T00:00:00Z',
                  'checks': [{'id': 'historic-failure', 'status': 'fail', 'scenarioType': 'failure',
                              'command': 'synthetic check', 'evidence': 'historical diagnosis'}]}
        engineering = {'schemaVersion': 1, 'week': 1, 'commitSha': self.source,
                       'decision': 'Keep reproducible baseline controls before adding further features.',
                       'alternatives': ['Only manual validation before each delivery', 'Repeat automated controls for each commit'],
                       'tradeoff': 'Automated controls add runtime but make regressions independently reproducible.',
                       'requirementIds': ['AC-04'], 'verification': [{'command': 'synthetic check', 'result': 'fail', 'evidence': 'historical diagnosis'}]}
        individual = {'schemaVersion': 1, 'week': 1, 'teamId': 'synthetic', 'members': [
            {'studentId': f'synthetic-{i}', 'commitShas': [self.source], 'files': ['code.txt'], 'tests': ['synthetic check'], 'reviews': [],
             'prediction': 'Expected fixture behavior', 'command': 'synthetic check', 'observedResult': 'Fixture observation', 'explanation': 'Synthetic test only'} for i in range(3)]}
        self.report = self.repo / 'reports/week-01/baseline.json'
        self.engineering = self.repo / 'evidence/week-01/engineering.json'
        for path, data in [(self.report, report), (self.engineering, engineering), (self.repo / 'evidence/week-01/individual.json', individual)]:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data))
        self.original = self.report.read_bytes()
        self.commit('evidence only')
        self.git('checkout', '-b', 'feature')
        (self.repo / 'feature.txt').write_text('feature')
        self.commit('feature')
        self.git('checkout', 'main')
        (self.repo / 'main.txt').write_text('main')
        self.commit('main change')
        self.git('merge', '--no-ff', 'feature', '-m', 'merge feature')
        self.sha = self.git('rev-parse', 'HEAD')

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.repo, text=True, stderr=subprocess.DEVNULL).strip()

    def commit(self, message):
        self.git('add', '.')
        self.git('commit', '-m', message)

    def run_revalidation(self, exit_code=0):
        command = [sys.executable, '-c', f'print("synthetic executed check"); raise SystemExit({exit_code})']
        with patch.dict(module.COMMANDS, {1: [('synthetic', 'boundary', command)]}):
            module.revalidate(self.repo, 1)

    def test_merge_revalidates_with_original_provenance_and_strict_schema(self):
        self.run_revalidation()
        report = json.loads(self.report.read_text())
        self.assertEqual(report['commitSha'], self.sha)
        self.assertEqual(report['checks'][0]['evaluatedCommitSha'], self.source)
        self.assertEqual(report['checks'][0]['status'], 'fail')
        self.assertEqual(report['checks'][-1]['evaluatedCommitSha'], self.sha)
        self.assertEqual((self.repo / report['revalidation']['original']).read_bytes(), self.original)
        self.assertTrue(module.validate_report(self.repo, self.report, 1, self.sha)[0])
        self.assertTrue(module.validate_engineering(self.repo, self.engineering, 1, self.sha)[0])

    def test_failing_control_does_not_relabel_evidence(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_revalidation(7)
        self.assertEqual(self.report.read_bytes(), self.original)
        observations = json.loads((self.repo / 'reports/week-01/generated-revalidation/observations.json').read_text())
        self.assertEqual(observations['checks'][0]['status'], 'fail')
        self.assertIn('exit 7', observations['checks'][0]['evidence'])

    def test_final_tag_cannot_refresh_evidence(self):
        with patch.dict(os.environ, {'GITHUB_REF': 'refs/tags/week-01-final'}):
            with self.assertRaisesRegex(ValueError, 'forbidden'):
                self.run_revalidation()
        self.assertEqual(self.report.read_bytes(), self.original)

    def test_uncommitted_code_cannot_be_recorded_as_head(self):
        (self.repo / 'code.txt').write_text('uncommitted')
        with self.assertRaisesRegex(ValueError, 'Commit code'):
            self.run_revalidation()

    def test_invalid_historical_schema_is_not_repaired_silently(self):
        report = json.loads(self.report.read_text())
        report['checks'] = []
        self.report.write_text(json.dumps(report))
        with self.assertRaisesRegex(ValueError, 'non-empty'):
            self.run_revalidation()

    def test_unrelated_sha_is_rejected(self):
        report = json.loads(self.report.read_text())
        report['commitSha'] = 'a' * 40
        self.report.write_text(json.dumps(report))
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_revalidation()

    def test_official_evaluator_still_rejects_stale_sha(self):
        self.assertFalse(module.validate_report(self.repo, self.report, 1, self.sha)[0])


if __name__ == '__main__':
    unittest.main()

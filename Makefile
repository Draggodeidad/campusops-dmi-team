PYTHON ?= python3
NPM ?= npm

.PHONY: setup verify feedback scan-secrets run run-backend package

setup:
	$(NPM) ci

verify:
	$(NPM) run typecheck
	$(NPM) run lint
	$(NPM) test -- --ci --runInBand
	$(NPM) run check:architecture
	$(NPM) run scan:secrets

scan-secrets:
	$(NPM) run scan:secrets

feedback: verify
	$(NPM) run audit:ci
	$(NPM) run bundle:release

run:
	$(NPM) run start

run-backend:
	$(NPM) run backend

package:
	$(NPM) run package:android

verify-week-%:
	$(PYTHON) tools/course_public_evaluator.py --week $* --mode verify --execute-toolchain

public-test-week-%:
	$(PYTHON) tools/course_public_evaluator.py --week $* --mode public --execute-toolchain

evidence-week-%:
	$(PYTHON) tools/course_public_evaluator.py --week $* --mode evidence

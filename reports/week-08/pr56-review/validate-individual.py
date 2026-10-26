"""Run the official individual contract without converting failure to success."""
import importlib.util
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('evaluator', root / 'tools/course_public_evaluator.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ok, detail = module.validate_individual(root / 'evidence/week-08/individual.json', 8)
print(f'Official individual contract: {ok}; {detail}')
sys.exit(0 if ok else 1)

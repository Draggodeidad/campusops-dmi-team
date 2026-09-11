const { readFileSync, readdirSync, statSync } = require('node:fs');
const { dirname, relative, resolve, sep } = require('node:path');

const layers = new Set(['ui', 'application', 'domain', 'infrastructure']);
const forbiddenDependencies = {
  ui: new Set(['infrastructure']),
  application: new Set(['ui', 'infrastructure']),
  domain: new Set(['ui', 'application', 'infrastructure']),
  infrastructure: new Set(['ui']),
};

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:js|jsx|ts|tsx)$/.test(name) ? [path] : [];
  });
}

function layerForPath(root, path) {
  const [firstSegment] = relative(root, path).split(sep);
  return layers.has(firstSegment) ? firstSegment : null;
}

function importedSpecifiers(source) {
  const matches = source.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g);
  return [...matches].map((match) => match[1]);
}

function findViolations(rootDirectory) {
  const root = resolve(rootDirectory);
  const violations = [];

  for (const file of sourceFiles(root)) {
    const sourceLayer = layerForPath(root, file);
    if (sourceLayer === null) continue;

    for (const specifier of importedSpecifiers(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      const targetLayer = layerForPath(root, resolve(dirname(file), specifier));
      if (targetLayer !== null && forbiddenDependencies[sourceLayer].has(targetLayer)) {
        violations.push({
          file: relative(root, file),
          dependency: `${sourceLayer} -> ${targetLayer}`,
          specifier,
        });
      }
    }
  }

  return violations;
}

if (require.main === module) {
  const root = process.argv[2] ?? 'src';
  const violations = findViolations(root);
  if (violations.length > 0) {
    console.error(JSON.stringify({ status: 'fail', violations }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: 'pass', root, violations: [] }, null, 2));
  }
}

module.exports = { findViolations };

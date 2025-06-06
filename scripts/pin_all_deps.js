/*
 * This script is used to pin all dependencies in package.json to the exact
 * versions declared in package-lock.json.
 *
 * It assumes lockfileVersion >= 2
 *
 * Usage: node pin_all_deps.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = require(packageJsonPath);

const allDependenciesVersions = Object.values(packageJson.dependencies).concat(
  Object.values(packageJson.devDependencies),
);

// if any version has a ^ or ~, we need to pin it, otherwise we can skip
const hasUnpinnedVersions = allDependenciesVersions.some(
  (version) => version.startsWith('^') || version.startsWith('~'),
);

if (hasUnpinnedVersions) {
  const packages = require('../package-lock.json').packages;

  for (const packageName in packageJson.dependencies) {
    const installedVersion = packages[`node_modules/${packageName}`].version;
    if (packageJson.dependencies.hasOwnProperty(packageName) && installedVersion) {
      packageJson.dependencies[packageName] = installedVersion;
    }
  }

  for (const packageName in packageJson.devDependencies) {
    const installedVersion = packages[`node_modules/${packageName}`].version;
    if (packageJson.devDependencies.hasOwnProperty(packageName) && installedVersion) {
      packageJson.devDependencies[packageName] = installedVersion;
    }
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

  // Run npm install to update package-lock.json
  console.log('Running npm install to update package-lock.json...');
  execSync('npm install', { stdio: 'inherit' });
  // execSync('git add package.json package-lock.json', { stdio: 'inherit' });

  console.log('Successfully pinned all dependency versions');
} else {
  console.log('All dependencies are already pinned to exact versions');
}

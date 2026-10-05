#!/usr/bin/env node
/**
 * check-deps.js — every dependency must be on the allowlist.
 *
 * A new package is a supply-chain decision (licence, maintenance, native code,
 * bundle size), not an implementation detail the agent settles on its own. The
 * allowlist lives in scripts/allowed-dependencies.json, a harness file: adding a
 * package means Cedric approves it and refreshes the lock. Removing a package
 * needs nothing.
 *
 * Checks package.json at the root and in functions/ (Cloud Functions).
 *
 * Exit 0 = every dependency is allowed, 1 = at least one is not.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// MIVRO_DEPS_ROOT lets the self-test point the sensor at a doctored manifest.
const root = process.env.MIVRO_DEPS_ROOT || path.resolve(__dirname, '..');
const allow = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'allowed-dependencies.json'), 'utf8'),
);

const manifests = [
  { key: 'root', file: 'package.json' },
  { key: 'functions', file: 'functions/package.json' },
];

const offenders = [];
for (const { key, file } of manifests) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    continue;
  }
  const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (pkg.overrides || pkg.resolutions) {
    offenders.push(`${file} > overrides/resolutions: replaces packages behind the allowlist`);
  }
  // Moving a package between dependencies and devDependencies is not a new
  // supply-chain decision, so both allowlist sections count for both fields.
  const section = allow[key] || {};
  const allowed = new Set([...(section.dependencies || []), ...(section.devDependencies || [])]);
  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const [name, spec] of Object.entries(pkg[field] || {})) {
      if (!allowed.has(name)) {
        offenders.push(`${file} > ${field} > ${name}`);
      }
      // An allowed NAME can still point elsewhere: npm:<other>, git, a tarball
      // URL, a local path (JOURNAL J-046). Only registry version ranges pass.
      if (
        typeof spec !== 'string' ||
        /^(npm:|git|github:|gitlab:|bitbucket:|https?:|file:|link:|workspace:)|\//.test(spec)
      ) {
        offenders.push(`${file} > ${field} > ${name}: "${spec}" is not a registry version`);
      }
    }
  }
}

if (offenders.length > 0) {
  console.error('✖ Dependency not on the allowlist (scripts/allowed-dependencies.json):');
  for (const offender of offenders) {
    console.error(`  - ${offender}`);
  }
  console.error('');
  console.error("A new package is Cedric's call. Explain why it is needed (and the alternatives");
  console.error(
    'without it); if he agrees, he adds it to the allowlist and runs `npm run harness:relock`.',
  );
  process.exit(1);
}

import fs from 'node:fs';
import path from 'node:path';

const allowedTopLevelKeys = new Set(['mode', 'featureFlags', 'extensions']);
const allowedCloudFlags = [
  'managedHosting',
  'managedDatabase',
  'dashboard',
  'slaSupport',
  'auditLogs',
  'enterpriseSso',
  'usageAnalytics',
  'multiRegionFailover',
];
const allowedExtensions = [
  'runners',
  'connectors',
  'webhooks',
  'marketplace',
  'observabilityExporters',
];

const mode = process.env.CONTROLPLANE_DISTRIBUTION || 'oss';
const configPath =
  process.env.CONTROLPLANE_DISTRIBUTION_CONFIG ||
  path.resolve('config', `distribution.${mode}.json`);

function fail(message) {
  console.error(`Distribution validation failed: ${message}`);
  process.exit(1);
}

function validateBooleanMap(obj, allowedKeys, label) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    fail(`${label} must be an object.`);
  }
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      fail(`${label} contains unsupported key: ${key}`);
    }
    if (typeof obj[key] !== 'boolean') {
      fail(`${label}.${key} must be a boolean.`);
    }
  }
  for (const key of allowedKeys) {
    if (!(key in obj)) {
      fail(`${label} is missing required key: ${key}`);
    }
  }
}

let configRaw;
try {
  configRaw = fs.readFileSync(configPath, 'utf8');
} catch (error) {
  fail(`unable to read config at ${configPath}: ${error.message}`);
}

let config;
try {
  config = JSON.parse(configRaw);
} catch (error) {
  fail(`invalid JSON in ${configPath}: ${error.message}`);
}

if (!config || typeof config !== 'object' || Array.isArray(config)) {
  fail('config must be a JSON object.');
}

for (const key of Object.keys(config)) {
  if (!allowedTopLevelKeys.has(key)) {
    fail(`unsupported top-level key: ${key}`);
  }
}

if (config.mode !== mode) {
  fail(`mode mismatch: expected "${mode}", got "${config.mode}".`);
}

if (!config.featureFlags || typeof config.featureFlags !== 'object') {
  fail('featureFlags must be an object.');
}

validateBooleanMap(config.featureFlags.cloud, allowedCloudFlags, 'featureFlags.cloud');
validateBooleanMap(config.extensions, allowedExtensions, 'extensions');

if (mode === 'oss') {
  for (const key of allowedCloudFlags) {
    if (config.featureFlags.cloud[key] !== false) {
      fail(`cloud feature ${key} must be false in oss mode.`);
    }
  }
}

console.log(`Distribution config verified for mode: ${mode}`);

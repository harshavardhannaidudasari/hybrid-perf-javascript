'use strict';

function env(key, fallback) {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function defaultPortFor(engine) {
  if (engine === 'postgres') return '5432';
  if (engine === 'mysql') return '3306';
  return '';
}

const DB_ENGINE = env('HYBRID_DB_ENGINE', 'sqlite');

/**
 * Every setting has a HYBRID_PERF_* env var override, same convention as the
 * hybrid-api-* and hybrid-db-* sibling projects. The HTTP scenario's target
 * reuses HYBRID_API_BASE_URL (same variable name as hybrid-api-*); the DB
 * scenario reuses the exact HYBRID_DB_* variable names from hybrid-db-*.
 */
module.exports = {
  HTTP_TARGET_URL: env('HYBRID_API_BASE_URL', 'https://dummyjson.com'),
  HTTP_TARGET_PATH: env('HYBRID_PERF_HTTP_PATH', '/products/1'),

  DB_ENGINE,
  DB_SQLITE_PATH: env('HYBRID_DB_SQLITE_PATH', 'hybrid-perf-test.sqlite'),
  DB_HOST: env('HYBRID_DB_HOST', 'localhost'),
  DB_PORT: env('HYBRID_DB_PORT', defaultPortFor(DB_ENGINE)),
  DB_DATABASE: env('HYBRID_DB_NAME', 'hybriddb'),
  DB_USER: env('HYBRID_DB_USER', 'hybriddb'),
  DB_PASSWORD: env('HYBRID_DB_PASSWORD', 'hybriddb'),

  VIRTUAL_USERS: parseInt(env('HYBRID_PERF_VIRTUAL_USERS', '10'), 10),
  DURATION_SECONDS: parseInt(env('HYBRID_PERF_DURATION_SECONDS', '5'), 10),
  THRESHOLD_P95_MS: parseFloat(env('HYBRID_PERF_THRESHOLD_P95_MS', '2000')),
  THRESHOLD_ERROR_RATE_PCT: parseFloat(env('HYBRID_PERF_THRESHOLD_ERROR_RATE_PCT', '5')),
};

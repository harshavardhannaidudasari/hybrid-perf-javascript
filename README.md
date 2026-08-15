# Hybrid Performance Testing Framework (JavaScript)

[![CI](https://github.com/harshavardhannaidudasari/hybrid-perf-javascript/actions/workflows/ci.yml/badge.svg)](https://github.com/harshavardhannaidudasari/hybrid-perf-javascript/actions/workflows/ci.yml)

A small, reusable concurrent load-testing engine built to be **imported by
other projects**, not just run standalone - the performance-layer sibling to
this account's `hybrid-web-mobile-*`, `hybrid-selfheal-*`, `hybrid-api-*`,
and `hybrid-db-*` project families, and the JavaScript port of
`hybrid-perf-java`.

## Why this exists

Functional tests (the other 4 families) prove a system behaves correctly
for one request at a time. This proves it still behaves correctly - and
fast enough - under concurrent load. `loadTestRunner.run` is meant to be
added as a dependency wherever that question matters, pointed at any "one
iteration" scenario (an HTTP call, a DB query, anything reducible to
"resolved true/false, took this long").

**"Universal"** here means: the runner itself has no idea what a scenario
*does* - it just drives whatever async function it's given with N concurrent
virtual users for a fixed duration, and reports throughput/latency/pass-fail.
This repo ships two ready-made scenarios to prove that genuinely works
against two very different kinds of target:

1. **HTTP** (`httpScenarios.get`) - fetches the configured URL (defaults to
   [dummyjson.com](https://dummyjson.com), the same target `hybrid-api-javascript`
   verified live).
2. **Database** (`dbScenarios.insertAndSelect`, `DbClient`) - inserts +
   selects a row, on whichever relational engine `HYBRID_DB_ENGINE` points
   at (sqlite by default via Node's built-in `node:sqlite`, postgres/mysql
   in CI) - same swap story as `hybrid-db-javascript`.

## Using this as a library

```js
const { loadTestRunner, httpScenarios } = require('hybrid-perf-javascript');

const result = await loadTestRunner.run(
  10,                                            // virtual users
  5,                                             // duration (seconds)
  httpScenarios.get('https://dummyjson.com/products/1')
);

console.log(result.summary());
// iterations=412 success=412 failure=0 errorRate=0.00% throughput=82.40/s
// min=38.2ms avg=54.1ms p50=52.0ms p90=66.0ms p95=71.0ms p99=88.0ms max=103.0ms passed=true

if (!result.passed) {
  throw new Error(`performance regression: ${result.failureReasons}`);
}
```

## What's in the box

| File | Purpose |
|---|---|
| `loadTestRunner.js` | Drives a scenario with N concurrent virtual users (`Promise.all` over N async loops) for a fixed duration, computes throughput/latency percentiles, applies pass/fail thresholds |
| `httpScenarios.js` | Ready-made HTTP GET scenario (native `fetch`, its own connection pool, safely reused across virtual users) |
| `dbScenarios.js` / `dbClient.js` | Ready-made DB insert+select scenario (one connection per virtual user - DB connections must not be shared) |
| `perfConfig.js` | Every setting + its env var override, in one place |

`scenarioFactory(virtualUserIndex)` is called once **per virtual user**, not
once per iteration - so each virtual user can own resources that must not be
shared (a DB connection), while something genuinely shareable (`fetch`'s
underlying connection pool) is captured once and reused by every virtual
user's closure.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HYBRID_API_BASE_URL` | `https://dummyjson.com` | HTTP scenario target (same variable name as `hybrid-api-*`) |
| `HYBRID_PERF_HTTP_PATH` | `/products/1` | Path appended to the target for the HTTP scenario |
| `HYBRID_DB_ENGINE` / `HYBRID_DB_HOST` / `HYBRID_DB_PORT` / `HYBRID_DB_NAME` / `HYBRID_DB_USER` / `HYBRID_DB_PASSWORD` / `HYBRID_DB_SQLITE_PATH` | see `hybrid-db-javascript` | DB scenario target (identical variable names) |
| `HYBRID_PERF_VIRTUAL_USERS` | `10` | Concurrent virtual users |
| `HYBRID_PERF_DURATION_SECONDS` | `5` | How long to run |
| `HYBRID_PERF_THRESHOLD_P95_MS` | `2000` | Fail if p95 latency exceeds this |
| `HYBRID_PERF_THRESHOLD_ERROR_RATE_PCT` | `5` | Fail if error rate exceeds this |

## Setup

```bash
cd hybrid-perf-javascript
npm install
```

## Running

```bash
npm test
```

Runs real concurrent load against the live `dummyjson.com` API and a real
sqlite file - no mocking. `loadTestRunner.run` also takes optional explicit
threshold arguments (`run(users, durationSeconds, scenarioFactory, thresholdP95Ms, thresholdErrorRatePct)`)
used by the test suite to prove the fail path genuinely works, not just the
happy path.

## What's actually been verified (last real run)

`npm test` -> **3/3 passed**:

| Test | What it proves |
|---|---|
| HTTP load test meets default thresholds | Real concurrent HTTP load (5 virtual users, 3s) against dummyjson.com passes default thresholds with positive throughput |
| HTTP load test fails when threshold is unrealistic | An intentionally impossible 1ms p95 threshold against a real network call correctly fails, with a failure reason naming p95 - proves the runner genuinely judges results, not just reports them |
| DB load test meets default thresholds | Real concurrent DB load (5 virtual users, 3s, insert+select) against the configured engine passes default thresholds |

CI additionally runs the whole suite against **postgres 16** and **mysql 8**
service containers (`HYBRID_DB_ENGINE` swapped per step), same pattern as
`hybrid-db-javascript` - proving the DB scenario's "any engine" claim
against real servers, not just sqlite.

No real bugs surfaced while building this port - the sibling
`hybrid-db-javascript`'s already-solved problems (native `better-sqlite3`
blocked by this environment's npm script policy, fixed by switching to
Node's built-in `node:sqlite`; the `?`→`$1` placeholder translation needed
for postgres) were reused directly here rather than rediscovered.

## CI

`.github/workflows/ci.yml` on `master` runs the suite against sqlite, then
against real Postgres and MySQL service containers - three full runs in one
job.

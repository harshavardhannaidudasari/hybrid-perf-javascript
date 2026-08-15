'use strict';

const config = require('./perfConfig');

function percentile(sortedAscending, p) {
  if (sortedAscending.length === 0) return 0;
  let index = Math.ceil((p / 100) * sortedAscending.length) - 1;
  index = Math.max(0, Math.min(sortedAscending.length - 1, index));
  return sortedAscending[index];
}

/**
 * Generic concurrent load-test engine, meant to be imported by other
 * projects the same way ApiClient/DbClient are - point it at any "one
 * iteration" scenario (an HTTP call, a DB query, anything resolving
 * true/false for success) and it drives it with N concurrent virtual users
 * for a fixed duration, then reports throughput, latency percentiles, and a
 * configurable pass/fail verdict.
 *
 * `scenarioFactory` is called once per virtual user (not once per
 * iteration) so each virtual user can own its own resources - e.g. its own
 * DB connection, which must not be shared across concurrent virtual users.
 * A shared HTTP client, on the other hand, is fine to capture once outside
 * the factory and reuse across every virtual user's closure.
 */
async function run(
  virtualUsers,
  durationSeconds,
  scenarioFactory,
  thresholdP95Ms = config.THRESHOLD_P95_MS,
  thresholdErrorRatePct = config.THRESHOLD_ERROR_RATE_PCT
) {
  const endAtMs = Date.now() + durationSeconds * 1000;
  const latenciesMs = [];
  let successCount = 0;
  let failureCount = 0;

  const virtualUserLoops = [];
  for (let i = 0; i < virtualUsers; i++) {
    const scenario = scenarioFactory(i);
    virtualUserLoops.push(
      (async () => {
        while (Date.now() < endAtMs) {
          const start = process.hrtime.bigint();
          let ok;
          try {
            ok = (await scenario()) === true;
          } catch (err) {
            ok = false;
          }
          const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
          latenciesMs.push(latencyMs);
          if (ok) successCount++;
          else failureCount++;
        }
      })()
    );
  }
  await Promise.all(virtualUserLoops);

  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const total = successCount + failureCount;
  const errorRatePercent = total === 0 ? 0 : (failureCount * 100) / total;
  const throughputPerSecond = total / Math.max(durationSeconds, 0.001);
  const min = sorted.length ? sorted[0] : 0;
  const max = sorted.length ? sorted[sorted.length - 1] : 0;
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  const p50 = percentile(sorted, 50);
  const p90 = percentile(sorted, 90);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  const failureReasons = [];
  if (p95 > thresholdP95Ms) {
    failureReasons.push(`p95 latency ${p95.toFixed(1)}ms exceeded threshold ${thresholdP95Ms}ms`);
  }
  if (errorRatePercent > thresholdErrorRatePct) {
    failureReasons.push(`error rate ${errorRatePercent.toFixed(2)}% exceeded threshold ${thresholdErrorRatePct}%`);
  }

  const result = {
    totalIterations: total,
    successCount,
    failureCount,
    errorRatePercent,
    throughputPerSecond,
    minMs: min,
    maxMs: max,
    avgMs: avg,
    p50Ms: p50,
    p90Ms: p90,
    p95Ms: p95,
    p99Ms: p99,
    passed: failureReasons.length === 0,
    failureReasons,
  };
  result.summary = () =>
    `iterations=${result.totalIterations} success=${result.successCount} failure=${result.failureCount} ` +
    `errorRate=${result.errorRatePercent.toFixed(2)}% throughput=${result.throughputPerSecond.toFixed(2)}/s ` +
    `min=${result.minMs.toFixed(1)}ms avg=${result.avgMs.toFixed(1)}ms p50=${result.p50Ms.toFixed(1)}ms ` +
    `p90=${result.p90Ms.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms p99=${result.p99Ms.toFixed(1)}ms ` +
    `max=${result.maxMs.toFixed(1)}ms passed=${result.passed}` +
    (result.failureReasons.length ? ` reasons=${JSON.stringify(result.failureReasons)}` : '');

  return result;
}

module.exports = { run };

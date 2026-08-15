'use strict';

const { expect } = require('chai');
const loadTestRunner = require('../lib/loadTestRunner');
const httpScenarios = require('../lib/httpScenarios');
const config = require('../lib/perfConfig');

describe('HTTP load test', function () {
  this.timeout(20000);

  const url = config.HTTP_TARGET_URL + config.HTTP_TARGET_PATH;

  it('meets default thresholds against the live target', async function () {
    const result = await loadTestRunner.run(5, 3, httpScenarios.get(url));

    expect(result.passed, `expected default thresholds to pass: ${result.summary()}`).to.equal(true);
    expect(result.totalIterations).to.be.greaterThan(0);
    expect(result.throughputPerSecond).to.be.greaterThan(0);
  });

  it('fails when the threshold is unrealistic', async function () {
    // A 1ms p95 threshold against a real network call is intentionally impossible -
    // proves the threshold-fail path genuinely triggers, not just the happy path.
    const result = await loadTestRunner.run(2, 2, httpScenarios.get(url), 1, 5);

    expect(result.passed, `expected an unrealistic 1ms p95 threshold to fail: ${result.summary()}`).to.equal(false);
    expect(result.failureReasons.some((reason) => reason.includes('p95'))).to.equal(true);
  });
});

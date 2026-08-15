'use strict';

const { expect } = require('chai');
const loadTestRunner = require('../lib/loadTestRunner');
const dbScenarios = require('../lib/dbScenarios');
const DbClient = require('../lib/dbClient');

describe('DB load test', function () {
  this.timeout(20000);

  let setupClient;

  before(async function () {
    setupClient = await DbClient.create();
    await setupClient.execute('DROP TABLE IF EXISTS users');
    await setupClient.execute(DbClient.createUsersTableSql());
  });

  after(async function () {
    await setupClient.execute('DROP TABLE IF EXISTS users');
    await setupClient.close();
  });

  it('meets default thresholds against the configured engine', async function () {
    const result = await loadTestRunner.run(5, 3, dbScenarios.insertAndSelect());

    expect(result.passed, `expected default thresholds to pass: ${result.summary()}`).to.equal(true);
    expect(result.totalIterations).to.be.greaterThan(0);
    expect(result.throughputPerSecond).to.be.greaterThan(0);
  });
});

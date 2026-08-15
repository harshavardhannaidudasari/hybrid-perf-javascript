'use strict';

const DbClient = require('./dbClient');

let uniqueSuffix = 0;

/** Ready-made DB insert+select scenario for loadTestRunner. Each virtual user gets its own DbClient/connection - DB connections must not be shared across concurrent virtual users. */
function insertAndSelect() {
  return function scenarioFactory(virtualUserIndex) {
    let clientPromise = DbClient.create();
    return async function scenario() {
      const db = await clientPromise;
      const email = `perf-${virtualUserIndex}-${++uniqueSuffix}@example.com`;
      await db.execute('INSERT INTO users (name, email) VALUES (?, ?)', 'Load Test User', email);
      return db.queryHasRow('SELECT id FROM users WHERE email = ?', email);
    };
  };
}

module.exports = { insertAndSelect };

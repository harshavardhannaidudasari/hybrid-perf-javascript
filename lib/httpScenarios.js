'use strict';

/** Ready-made HTTP GET scenario for loadTestRunner - one shared fetch call reused by every virtual user, native fetch keeps its own connection pool. */
function get(url) {
  return function scenarioFactory() {
    return async function scenario() {
      try {
        const response = await fetch(url);
        return response.status >= 200 && response.status < 300;
      } catch (err) {
        return false;
      }
    };
  };
}

module.exports = { get };

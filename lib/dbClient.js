'use strict';

const config = require('./perfConfig');

/** Translates `?` positional placeholders to postgres's `$1, $2, ...` - every other engine accepts `?` natively. Same fix hybrid-db-javascript already needed. */
function translate(sql, engine) {
  if (engine !== 'postgres') return sql;
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Minimal relational client for the DB load-testing scenario - same
 * sqlite/postgres/mysql-swappable-via-config design as hybrid-db-javascript's
 * DbClient, trimmed to just execute/query/close. Not a dependency on
 * hybrid-db-javascript (separate repo, not published to a registry) -
 * deliberately duplicated here to keep this project self-contained. Uses
 * Node's built-in node:sqlite (not better-sqlite3, which hit a native-build
 * block in this environment's sandbox in the sibling repo).
 */
class DbClient {
  constructor() {
    this.engine = config.DB_ENGINE;
    this._conn = null;
  }

  static async create() {
    const client = new DbClient();
    await client._connect();
    return client;
  }

  async execute(sql, ...params) {
    const translated = translate(sql, this.engine);
    if (this.engine === 'sqlite') {
      this._conn.prepare(translated).run(...params);
    } else if (this.engine === 'postgres') {
      await this._conn.query(translated, params);
    } else {
      await this._conn.execute(translated, params);
    }
  }

  async queryHasRow(sql, ...params) {
    const translated = translate(sql, this.engine);
    if (this.engine === 'sqlite') {
      return this._conn.prepare(translated).get(...params) !== undefined;
    } else if (this.engine === 'postgres') {
      const result = await this._conn.query(translated, params);
      return result.rows.length > 0;
    } else {
      const [rows] = await this._conn.execute(translated, params);
      return rows.length > 0;
    }
  }

  async close() {
    if (this.engine === 'sqlite') {
      this._conn.close();
    } else {
      await this._conn.end();
    }
  }

  async _connect() {
    if (this.engine === 'sqlite') {
      const { DatabaseSync } = require('node:sqlite');
      this._conn = new DatabaseSync(config.DB_SQLITE_PATH);
    } else if (this.engine === 'postgres') {
      const { Client } = require('pg');
      this._conn = new Client({
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_DATABASE,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
      });
      await this._conn.connect();
    } else if (this.engine === 'mysql') {
      const mysql = require('mysql2/promise');
      this._conn = await mysql.createConnection({
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_DATABASE,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
      });
    } else {
      throw new Error(`Unknown HYBRID_DB_ENGINE: ${this.engine}`);
    }
  }

  static createUsersTableSql() {
    if (config.DB_ENGINE === 'postgres') {
      return 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL)';
    }
    if (config.DB_ENGINE === 'mysql') {
      return 'CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL)';
    }
    return 'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL)';
  }
}

module.exports = DbClient;

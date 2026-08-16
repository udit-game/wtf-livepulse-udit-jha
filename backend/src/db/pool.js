require("dotenv").config();
const { Pool } = require("pg");
const config = require("../config");

// Use DATABASE_URL provided by centralized config (set by infrastructure)
const connectionString = config.databaseUrl;

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
require("dotenv").config();
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://wtf:wtf_secret@localhost:5432/wtf_livepulse";

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
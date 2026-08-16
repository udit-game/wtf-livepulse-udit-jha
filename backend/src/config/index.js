// Lightweight config aggregator for the backend.
// This centralizes env access and provides sensible defaults without throwing.
const config = {
  port: process.env.PORT || process.env.BACKEND_PORT || 3001,
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgres://wtf:wtf_secret@localhost:5432/wtf_livepulse",
  nodeEnv: process.env.NODE_ENV || 'development',
  appTimezone: process.env.APP_TIMEZONE || process.env.TZ || 'Asia/Kolkata',
};

module.exports = config;

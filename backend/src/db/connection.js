const { Pool } = require("pg");
const config = require("../config");

function shouldUseSsl(databaseUrl) {
  if (!databaseUrl) {
    return false;
  }

  return !databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1");
}

function normalizeDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    return "";
  }

  try {
    const parsed = new URL(databaseUrl);
    const sslMode = parsed.searchParams.get("sslmode");
    const legacySslModes = new Set(["prefer", "require", "verify-ca"]);

    if (legacySslModes.has(String(sslMode).toLowerCase())) {
      parsed.searchParams.set("sslmode", "verify-full");
    }

    return parsed.toString();
  } catch (_error) {
    return databaseUrl
      .replace(/sslmode=prefer/gi, "sslmode=verify-full")
      .replace(/sslmode=require/gi, "sslmode=verify-full")
      .replace(/sslmode=verify-ca/gi, "sslmode=verify-full");
  }
}

const normalizedDatabaseUrl = normalizeDatabaseUrl(config.databaseUrl);

const connectionConfig = normalizedDatabaseUrl
  ? {
      connectionString: normalizedDatabaseUrl,
      ssl: shouldUseSsl(normalizedDatabaseUrl)
        ? {
            rejectUnauthorized: false,
          }
        : false,
    }
  : config.db;

const pool = new Pool(connectionConfig);

module.exports = pool;

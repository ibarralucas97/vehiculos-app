const { Pool } = require("pg");
const config = require("../config");

function shouldUseSsl(databaseUrl) {
  if (!databaseUrl) {
    return false;
  }

  return !databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1");
}

const connectionConfig = config.databaseUrl
  ? {
      connectionString: config.databaseUrl,
      ssl: shouldUseSsl(config.databaseUrl)
        ? {
            rejectUnauthorized: false,
          }
        : false,
    }
  : config.db;

const pool = new Pool(connectionConfig);

module.exports = pool;

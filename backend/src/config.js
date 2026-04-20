const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  db: {
    user: process.env.DB_USER || "admin",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "vehiculos",
    password: process.env.DB_PASSWORD || "admin",
    port: Number(process.env.DB_PORT || 5432),
  },
};

module.exports = config;

require("dotenv").config();
const path = require("path");
const express = require("express");
const pool = require("./db/connection");
const config = require("./config");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const maintenanceRoutes = require("./routes/maintenance");
const vehicleRoutes = require("./routes/vehicles");
const placeRoutes = require("./routes/places");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({ ok: true, dbTime: result.rows[0].now });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Error en DB" });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/maintenance", maintenanceRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/places", placeRoutes);

app.listen(config.port, () => {
  console.log(`Servidor corriendo en puerto ${config.port}`);
});

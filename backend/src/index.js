require("dotenv").config();
const path = require("path");
const express = require("express");
const pool = require("./db/connection");
const config = require("./config");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const maintenanceRoutes = require("./routes/maintenance");
const maintenancePlanRoutes = require("./routes/maintenancePlans");
const userRoutes = require("./routes/users");
const vehicleRoutes = require("./routes/vehicles");
const placeRoutes = require("./routes/places");
const notificationRoutes = require("./routes/notifications");
const activityRoutes = require("./routes/activity");
const adminRoutes = require("./routes/admin");
const { requireAuth, requireSuperadmin, requireRegularUser } = require("./middleware/auth");

const app = express();
const JSON_PAYLOAD_LIMIT = "10mb";

if (process.env.RENDER || process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: JSON_PAYLOAD_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_PAYLOAD_LIMIT }));
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
app.use("/dashboard", requireAuth(), requireRegularUser, dashboardRoutes);
app.use("/maintenance", requireAuth(), requireRegularUser, maintenanceRoutes);
app.use("/maintenance-plans", requireAuth(), requireRegularUser, maintenancePlanRoutes);
app.use("/users", requireAuth(), userRoutes);
app.use("/vehicles", requireAuth(), requireRegularUser, vehicleRoutes);
app.use("/places", requireAuth(), requireRegularUser, placeRoutes);
app.use("/notifications", notificationRoutes);
app.use("/activity", requireAuth(), requireRegularUser, activityRoutes);
app.use("/admin", requireAuth(), requireSuperadmin, adminRoutes);

app.use((error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "La imagen es demasiado grande. Proba con una imagen menor a 5 MB.",
    });
  }

  return next(error);
});

app.listen(config.port, () => {
  console.log(`Servidor corriendo en puerto ${config.port}`);
});

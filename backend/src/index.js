const express = require("express");
const pool = require("./db/connection");

const maintenanceRoutes = require("./routes/maintenance");

const app = express();
app.use(express.json());
app.use("/maintenance", maintenanceRoutes);
console.log("🔥 Ruta /maintenance registrada");

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error en DB");
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
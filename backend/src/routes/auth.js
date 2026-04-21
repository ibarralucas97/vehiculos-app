console.log("🔥 AUTH ROUTE CARGADO 🔥");
const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { verifyPassword } = require("../utils/password");

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contrasena son obligatorios" });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash
       FROM users
       WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    console.log("EMAIL:", email);
console.log("PASSWORD INGRESADA:", password);
console.log("HASH DB:", user.password_hash);


console.log("USER DB:", user);


    const isValidPassword = await verifyPassword(password, user.password_hash);
   console.log("RESULTADO:", isValidPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al iniciar sesion" });
  }
});



module.exports = router;

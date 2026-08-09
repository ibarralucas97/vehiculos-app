const pool = require("../db/connection");
const { clearSessionCookie, getRequestToken, verifySessionToken } = require("../utils/auth");

function serializeAuthenticatedUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role || "user",
    mustChangePassword: row.must_change_password === true,
    sessionVersion: Number(row.session_version || 0),
  };
}

function requireAuth(options = {}) {
  const allowPasswordChangeRequired = options.allowPasswordChangeRequired === true;

  return async (req, res, next) => {
    try {
      const payload = verifySessionToken(getRequestToken(req));
      if (!payload) {
        return res.status(401).json({ error: "Sesion requerida" });
      }

      const result = await pool.query(
        `SELECT id, username, role, is_active, must_change_password, session_version, deleted_at
         FROM users
         WHERE id = $1`,
        [Number(payload.sub)]
      );
      const user = result.rows[0];

      if (!user || user.deleted_at || user.is_active === false) {
        clearSessionCookie(res);
        return res.status(401).json({ error: "Sesion requerida" });
      }

      if (Number(user.session_version || 0) !== Number(payload.sessionVersion || 0)) {
        clearSessionCookie(res);
        return res.status(401).json({ error: "Sesion requerida" });
      }

      req.user = serializeAuthenticatedUser(user);

      if (req.user.mustChangePassword && !allowPasswordChangeRequired) {
        return res.status(403).json({
          error: "Debes cambiar tu clave numerica para continuar",
          code: "PASSWORD_CHANGE_REQUIRED",
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireSuperadmin(req, res, next) {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ error: "No tenes permisos para esta accion" });
  }
  return next();
}

function requireRegularUser(req,res,next){
  if(req.user?.role === "superadmin") return res.status(403).json({error:"Esta funcion pertenece a la aplicacion de usuarios",code:"ADMIN_ONLY_EXPERIENCE"});
  return next();
}

module.exports = {
  requireAuth,
  requireSuperadmin,
  requireRegularUser,
};

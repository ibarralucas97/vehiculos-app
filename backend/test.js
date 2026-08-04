const { verifyPassword } = require("./src/utils/password");
const fs = require("fs");
const path = require("path");
const {
  createSessionToken,
  validateNumericPassword,
  validateUsername,
  verifySessionToken,
} = require("./src/utils/auth");
const { resetSuperadminPassword } = require("./src/utils/adminPasswordReset");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const stored = "b47b5b4031a996a44060fd54e2144152:71d656414785085d50a03cf362042b3204dbe96925b732e1a449bf7a6d57b40021a0f39f263e7dc03e7abad33512e85b698945fbb625b4d62398a3cb6a018bfa";
  const result = await verifyPassword("123456", stored);
  assert(result === true, "El hash historico debe validar 123456");

  assert(validateUsername(" lucas_01 ").error === null, "username valido rechazado");
  assert(validateUsername("lu").error, "username corto aceptado");
  assert(validateUsername("lucas admin").error, "username con espacios aceptado");
  assert(validateNumericPassword("001234").error === null, "clave con cero inicial rechazada");
  assert(validateNumericPassword("12345").error, "clave corta aceptada");
  assert(validateNumericPassword("12345a").error, "clave alfanumerica aceptada");

  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
  const token = createSessionToken({
    id: 7,
    username: "lucas",
    role: "superadmin",
    session_version: 3,
  });
  const payload = verifySessionToken(token);
  assert(payload.sub === 7, "token sin subject esperado");
  assert(payload.sessionVersion === 3, "token sin version de sesion esperada");
  assert(verifySessionToken(`${token}x`) === null, "token alterado aceptado");

  const authSource = fs.readFileSync(path.join(__dirname, "src/routes/auth.js"), "utf8");
  const registerBlock = authSource.match(/router\.post\("\/register"[\s\S]*?\n}\);/)?.[0] || "";
  assert(/status\(403\)/.test(registerBlock), "register publico debe devolver 403");
  assert(!/INSERT INTO users/i.test(registerBlock), "register publico no debe crear usuarios");

  const queries = [];
  const fakePool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (/SELECT id, username, role/.test(sql)) {
        return { rowCount: 1, rows: [{ id: 42, username: "admin", role: "superadmin" }] };
      }
      if (/UPDATE users/.test(sql)) {
        return { rowCount: 1, rows: [{ id: 42, username: "admin", session_version: 8 }] };
      }
      throw new Error("consulta inesperada");
    },
  };
  const resetResult = await resetSuperadminPassword(fakePool, {
    username: "admin",
    password: "001234",
  });
  assert(resetResult.id === 42, "reset debe devolver el superadmin afectado");
  assert(queries.length === 2, "reset debe ejecutar select y update solamente");
  assert(/role = 'superadmin'/.test(queries[1].sql), "reset debe limitar update a superadmin");
  assert(/session_version = session_version \+ 1/.test(queries[1].sql), "reset debe incrementar session_version");
  assert(/must_change_password = TRUE/.test(queries[1].sql), "reset debe exigir cambio de clave");
  assert(queries[1].values[1] === 42, "reset debe actualizar por id existente");
  assert(queries[1].values[0] !== "001234", "reset no debe guardar la clave en texto plano");

  const normalUserPool = {
    async query() {
      return { rowCount: 1, rows: [{ id: 7, username: "usuario", role: "user" }] };
    },
  };
  await resetSuperadminPassword(normalUserPool, { username: "usuario", password: "123456" })
    .then(() => {
      throw new Error("reset debe rechazar usuarios no superadmin");
    })
    .catch((error) => {
      assert(/superadmin/.test(error.message), "reset no rechazo usuario no superadmin correctamente");
    });

  console.log("RESULTADO: pruebas locales OK");
})();

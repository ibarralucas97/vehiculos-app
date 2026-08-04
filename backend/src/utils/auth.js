const crypto = require("crypto");

const SESSION_COOKIE_NAME = "rodado_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NUMERIC_PASSWORD_PATTERN = /^\d{6,10}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;

function normalizeUsername(value) {
  return String(value || "").trim();
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!username) return { error: "Usuario es obligatorio", username: "" };
  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: "Usuario debe tener 3 a 32 caracteres y solo letras, numeros, punto, guion o guion bajo",
      username,
    };
  }
  return { error: null, username };
}

function validateNumericPassword(value, fieldLabel = "Clave numerica") {
  const password = String(value || "").trim();
  if (!password) return { error: `${fieldLabel} es obligatoria`, password: "" };
  if (!NUMERIC_PASSWORD_PATTERN.test(password)) {
    return { error: `${fieldLabel} debe tener entre 6 y 10 digitos`, password };
  }
  return { error: null, password };
}

function getSessionSecret() {
  return String(process.env.SESSION_SECRET || process.env.JWT_SECRET || "").trim();
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function createSessionToken(user, { now = Date.now() } = {}) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET no configurado");
  }

  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role || "user",
    sessionVersion: Number(user.session_version || 0),
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + SESSION_TTL_MS) / 1000),
  };
  const unsigned = `${base64UrlEncode({ alg: "HS256", typ: "JWT" })}.${base64UrlEncode(payload)}`;
  return `${unsigned}.${sign(unsigned, secret)}`;
}

function verifySessionToken(token, { now = Date.now() } = {}) {
  const secret = getSessionSecret();
  const parts = String(token || "").split(".");
  if (!secret || parts.length !== 3) return null;

  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = sign(unsigned, secret);
  const provided = parts[2];
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload?.sub || !payload.exp || Number(payload.exp) <= Math.floor(now / 1000)) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return cookies;
      const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}

function getRequestToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies[SESSION_COOKIE_NAME]) return cookies[SESSION_COOKIE_NAME];

  const authorizationHeader = String(req.header("authorization") || "").trim();
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  return "";
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function issueSession(res, user) {
  const token = createSessionToken(user);
  setSessionCookie(res, token);
  return token;
}

module.exports = {
  NUMERIC_PASSWORD_PATTERN,
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSessionToken,
  getRequestToken,
  issueSession,
  normalizeUsername,
  validateNumericPassword,
  validateUsername,
  verifySessionToken,
};

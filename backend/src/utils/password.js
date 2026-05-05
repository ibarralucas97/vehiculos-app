const crypto = require("crypto");

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString("hex"));
    });
  });
}

async function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");

  if (!salt || !hash) {
    return false;
  }

  const candidateHash = await hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidateHash, "hex"), Buffer.from(hash, "hex"));
}

async function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

module.exports = {
  createPasswordHash,
  verifyPassword,
};

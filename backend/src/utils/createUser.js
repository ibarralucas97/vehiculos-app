const crypto = require("crypto");

const password = "123456";
const salt = crypto.randomBytes(16).toString("hex");

crypto.scrypt(password, salt, 64, (err, key) => {
  if (err) throw err;

  console.log(`${salt}:${key.toString("hex")}`);
});
# 🚗 Rodado Control

Aplicación web para la gestión de mantenimiento de vehículos, con soporte multiusuario, interfaz moderna y backend robusto.

Permite registrar servicios, controlar gastos, gestionar vehículos y talleres, y mantener un historial completo de mantenimiento.

---

## 🧠 Características principales

* 🔐 Autenticación de usuarios (login con hash seguro)
* 👥 Multiusuario real (aislamiento por `user_id`)
* 🚗 CRUD completo de vehículos
* 📍 CRUD completo de lugares (talleres)
* 🛠 Registro de mantenimientos
* 🔄 Sincronización automática de UI (sin necesidad de F5)
* ⏳ Bloqueo de interfaz durante operaciones (loading overlay)
* 🎯 UX moderna con modales y acciones rápidas
* 📊 Historial de mantenimientos con filtros

---

## 🧱 Stack Tecnológico

### Backend

* Node.js
* Express.js
* PostgreSQL
* pg (node-postgres)
* Crypto (scrypt para hashing)

### Frontend

* HTML5
* CSS3 (custom + layout moderno)
* JavaScript Vanilla (sin frameworks)

### Infraestructura

* Docker (entorno local)
* WSL (Windows Subsystem for Linux)
* Render (deploy backend)
* Neon (PostgreSQL serverless)

---

## 🔐 Seguridad

* Hash de contraseñas con `crypto.scrypt`
* Comparación segura con `timingSafeEqual`
* Queries protegidas por `user_id`
* Prevención de acceso entre usuarios

---

## Crear usuarios manualmente

La app guarda contraseñas en formato:

```text
salt:hash_en_hex
```

Ejemplo real:

```text
saltRandom:088464745be67a5172932d714a1de0623c334f091401e8bcbdaa7622740d25e13159134ff7725df0d31d32602fa2fa0323c740b9a3ca2e73122b7c4170e24f8d
```

### 1. Script para generar hash

Crea un archivo como `backend/scripts/createUser.js`:

```js
const crypto = require("crypto");

const password = process.argv[2];
const salt = process.argv[3] || "saltRandom";

if (!password) {
  console.error("Uso: node scripts/createUser.js <password> [salt]");
  process.exit(1);
}

crypto.scrypt(password, salt, 64, (err, derivedKey) => {
  if (err) throw err;
  console.log(`${salt}:${derivedKey.toString("hex")}`);
});
```

### 2. Ejecutarlo

```bash
node scripts/createUser.js 123456 saltRandom
```

### 3. Insertar o actualizar el usuario

```sql
INSERT INTO users (
  full_name,
  nombre,
  apellido,
  email,
  telefono,
  mileage_unit,
  reminders_enabled,
  password_hash
)
VALUES (
  'Lucas Test',
  'Lucas',
  'Test',
  'lucas@test.com',
  '+54 9 11 5555-5555',
  'km',
  TRUE,
  'saltRandom:088464745be67a5172932d714a1de0623c334f091401e8bcbdaa7622740d25e13159134ff7725df0d31d32602fa2fa0323c740b9a3ca2e73122b7c4170e24f8d'
)
ON CONFLICT (email) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  nombre = EXCLUDED.nombre,
  apellido = EXCLUDED.apellido,
  telefono = EXCLUDED.telefono,
  mileage_unit = EXCLUDED.mileage_unit,
  reminders_enabled = EXCLUDED.reminders_enabled,
  password_hash = EXCLUDED.password_hash;
```

### 4. Verificar en base

```sql
SELECT id, email, password_hash
FROM users
WHERE email = 'lucas@test.com';
```

### Notas importantes

* No inventar otro formato: el backend valida exactamente `salt:hash`.
* El `hash` debe salir de `crypto.scrypt(password, salt, 64)`.
* Si el login falla pero el usuario existe, revisar que la app esté usando la misma `DATABASE_URL` que Neon.

---

## 🧑‍💻 Autor

Lucas Ibarra
Proyecto personal enfocado en aprendizaje práctico de backend + frontend + deploy cloud.

---

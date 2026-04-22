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

## 🧑‍💻 Autor

Lucas Ibarra
Proyecto personal enfocado en aprendizaje práctico de backend + frontend + deploy cloud.

---

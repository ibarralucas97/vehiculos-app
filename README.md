# APP MyGarage

Backend y app web para registrar mantenimientos de vehiculos con Node, Express y PostgreSQL.

## Stack actual

- Backend: Node + Express
- Base de datos: PostgreSQL
- Entorno local: Docker + WSL
- Deploy objetivo: Render free + Neon free

## Variables de entorno

Archivo base: `backend/.env.example`

Variables clave:

- `PORT`: puerto del servidor
- `DATABASE_URL`: conexion completa a PostgreSQL. En produccion esta debe ser la principal.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: fallback local para desarrollo

La app prioriza `DATABASE_URL`. Si no existe, usa la config local por separado.

## Desarrollo local

1. Levanta PostgreSQL local.
2. Entra a `backend/`.
3. Ejecuta `npm install`.
4. Ejecuta `npm run db:setup` para crear tablas y seed.
5. Ejecuta `npm start`.

Usuario demo actual:

- Email: `lucas@mygarage.app`
- Contrasena: `Lucas2026!`

## Deploy en Render + Neon

### 1. Subir el repo a GitHub

Empuja este proyecto a GitHub antes de conectarlo con Render.

### 2. Crear base gratis en Neon

1. Crea una cuenta en Neon.
2. Crea un proyecto nuevo.
3. Copia la cadena `DATABASE_URL`.
4. Guarda esa URL porque la vas a pegar en Render.

### 3. Crear el servicio en Render

1. Crea una cuenta en Render.
2. Conecta tu repo de GitHub.
3. Crea un `Web Service` nuevo.
4. Render puede detectar `render.yaml`, o puedes configurarlo manualmente con:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Agrega la variable de entorno `DATABASE_URL` con la URL de Neon.

### 4. Crear tablas y seed en la base remota

Una vez desplegado el backend con `DATABASE_URL`, ejecuta el script:

- `npm run db:setup`

Puedes correrlo en un shell temporal apuntando a Neon o desde tu entorno local exportando `DATABASE_URL`.

### 5. Probar la app

- Health check: `/api/health`
- Login demo:
  - `lucas@mygarage.app`
  - `Lucas2026!`

## Cambio futuro de free a pago

No deberias rehacer la app.

Cuando quieras pasar de free a pago:

1. Creas una base paga.
2. Migras los datos.
3. Cambias `DATABASE_URL`.
4. Redeploy.

La aplicacion ya esta preparada para ese camino.

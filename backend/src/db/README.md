# Bootstrap y migraciones — H03/H04

## Responsabilidades

- `npm run db:bootstrap` (alias compatible: `db:setup`): crea **solo una base vacía** desde `schema.sql`, sin seed, usuarios ni migraciones históricas. Registra `baseline_013`, no trece migraciones supuestamente ejecutadas. Repetirlo con historial y checksums válidos no cambia datos ni aplica pendientes.
- `npm run db:migrate`: aplica pendientes desde `014_*.sql`, en orden numérico.
- `npm run db:migrate:selected -- src/db/migrations/014_nombre.sql`: usa el mismo motor; exige archivos de ese directorio y no permite saltar pendientes anteriores. Rechaza 001–013.
- `npm run db:history`: valida baseline y todos los archivos aplicados y muestra identificador, archivo, SHA-256, tipo, fecha y éxito. No crea historial. Para investigar un conflicto, un operador autorizado puede consultar `SELECT id, filename, checksum, kind, applied_at, success FROM public.schema_migrations ORDER BY applied_at, id;`.
- Administrador: `admin:bootstrap` sigue siendo un procedimiento independiente. No se ejecuta desde estos comandos. Tiene su configuración anterior y requiere autorización y revisión del destino por separado.
- Datos demo: `seed.sql` se conserva como archivo histórico **incompatible con el bootstrap actual**; no está conectado a ningún comando nuevo. No ejecutarlo. No se ofrecen cuentas demo ni contraseñas fijas.
- Diagnóstico: `queries/` y el archivo histórico 010 no son migraciones ejecutables del nuevo motor. No ejecutar SQL diagnóstico con marcadores sin revisar.

## Configuración explícita

Los comandos nuevos **no cargan `.env`, no usan `DATABASE_URL`, ni importan el pool de la aplicación**. Requieren estas variables específicas:

| Variable | Uso |
|---|---|
| `MIGRATION_DB_HOST` | Host explícito o directorio absoluto de socket Unix |
| `MIGRATION_DB_PORT` | Puerto explícito |
| `MIGRATION_DB_NAME` | Base explícita |
| `MIGRATION_DB_USER` | Rol explícito |
| `MIGRATION_DB_PASSWORD` | Solo cuando el método de autenticación lo requiere; obtener de un canal seguro, nunca versionar |
| `MIGRATION_DB_CONFIRM` | Debe coincidir exactamente con `<host>:<puerto>/<base>` |

La confirmación es una barrera contra errores, **no una autorización para producción**. Un host local puede ser un túnel: verificar también la procedencia de la instancia. TLS verifica certificados para hosts remotos. El ejecutor comprueba base y rol efectivos tras conectar. No imprime credenciales, SQL fallido ni detalles de filas.

Desde `backend`, con el destino autorizado configurado explícitamente:

```sh
npm run db:bootstrap
npm run db:migrate
npm run db:history
```

Después de crear el administrador por el procedimiento independiente, iniciar la aplicación con su configuración habitual. No agregar bootstrap al inicio del servidor ni al deploy automático.

## Baseline e históricos

`schema.sql` es una **baseline estructural inmutable hasta 013**, no un actualizador. Conserva tablas, columnas, defaults y constraints funcionales; incorpora los índices de imágenes y eventos por plan que estaban en 002/013. No contiene backfills. Las futuras modificaciones deben ir en un archivo incremental; no cambiar esta baseline después de aplicarla.

Los bytes y nombres históricos 001–013 se conservan. No se calcula ni inventa una aplicación histórica a partir de su mera presencia en el repositorio. Su clasificación es:

| Archivos | Naturaleza |
|---|---|
| 001 | DDL, usuario demo y asignación de propietarios históricos |
| 002 | DDL de perfil/imágenes y backfill de nombres/preferencias |
| 003–004 | DDL push y actividad |
| 005 | DDL y normalización de tipo/color |
| 006 | Cambio de nulabilidad de patente |
| 007 | DDL de recordatorios y transformación de eventos históricos |
| 008 | Cambio condicional de FK del taller |
| 009 | DDL y aprobación de un ID fijo |
| 010 | SELECT diagnóstico con marcador, no migración válida |
| 011 | DDL de imágenes y notificaciones internas |
| 012 | DDL de autenticación y backfills de username/activación |
| 013 | DDL de planes, relaciones e índices |

La migración 012 no se reejecuta: su copia de `is_approved` a `is_active` podría reactivar cuentas. Tampoco se aplica 001 sobre la baseline, donde `username` ya es obligatorio.

## Historial, transacciones y concurrencia

`public.schema_migrations` guarda identificador, archivo, SHA-256 del contenido exacto UTF-8, tipo (`baseline`/`migration`), fecha y `success=TRUE`. El registro se inserta en la misma transacción y cliente que el SQL. Si falla SQL, se revierte esa migración y no queda registrada. Las migraciones anteriores ya confirmadas permanecen aplicadas; el siguiente intento retoma las pendientes. No existe rollback automático de migraciones ya exitosas.

Se toma un advisory lock de sesión común antes de inspeccionar/modificar la base y se conserva entre transacciones. Un segundo proceso falla inmediatamente con un mensaje de concurrencia y debe reintentarse después. El lock no sustituye la exclusión de cambios SQL manuales ni coordina herramientas antiguas: deben quedar fuera de uso.

Antes de aplicar pendientes se validan **todos** los registros, incluso al usar selección. Un checksum, nombre o tipo diferente, un archivo aplicado ausente o un orden inconsistente detiene la ejecución. Restaurar el archivo original desde una referencia verificada; nunca editar el checksum para ocultar una diferencia. Si el cambio es intencional, crear otra migración.

Cada SQL incremental se ejecuta dentro de `BEGIN/COMMIT` gestionados por el runner. Se rechazan controles de transacción propios, `CONCURRENTLY`, `VACUUM` y determinadas operaciones fuera de transacción. Otros SQL incompatibles fallan dentro de la transacción, sin fallback a autocommit. El validador léxico es conservador (por ejemplo, rechaza escapes con barra inversa); no es un parser general ni un sandbox para SQL no confiable. Bloques `DO` con dollar quoting están admitidos. Toda migración requiere revisión humana. No escribir sobre el historial ni manipular locks/configuración del ejecutor desde SQL.

Límites actuales: espera por locks DDL de 10 segundos y sentencias de 120 segundos. Una operación que no cabe en esos límites o requiere ejecución no transaccional necesita un diseño y procedimiento explícitos antes de release.

## Base histórica sin historial

El motor inspecciona objetos en `public`, otros schemas de usuario, rutinas, tipos y extensiones. Si existe contenido sin historial, **se detiene sin crear tablas ni baseline**. Un historial vacío, incompleto o desconocido también exige reconciliación. No basta que no haya filas en `users`.

La adopción histórica queda deliberadamente fuera del automatismo:

1. Obtener autorización específica, backup verificable y una ventana sin otros escritores de esquema.
2. Inspeccionar el esquema real: columnas, tipos, defaults, nulabilidad, índices, constraints y reglas de borrado; contrastarlo con esta baseline. Revisar separadamente invariantes de datos y el estado de activación de usuarios. No inferirlo del HEAD ni del nombre de archivos.
3. Documentar diferencias y probar correcciones mínimas en un entorno de ensayo autorizado. No ejecutar 001–013 en bloque ni volver a copiar `is_approved` a `is_active`.
4. Preparar y revisar un script de adopción específico: bajo lock y transacción, verificar precondiciones exactas y crear un registro de baseline que certifique equivalencia estructural comprobada, **no ejecución ficticia de históricos**. Adjuntar evidencia, SHA de código, checksum y responsable. Este cambio no incluye ni ejecuta ese script.
5. Si no puede demostrarse equivalencia, detenerse. Solo después de la reconciliación autorizada podrá usarse el runner incremental.

Prohibido usar estos pasos para conectarse a Neon, modificar producción, restaurar backups productivos o desplegar sin autorización específica. La confirmación de destino no levanta esa prohibición.

## Pruebas descartables

La suite nueva necesita binarios PostgreSQL locales (`initdb`, `pg_ctl`, `postgres`). No instala ni inicia servicios del sistema. Docker/Podman también pueden alojar el entorno de pruebas, pero no se reutiliza una base existente.

```sh
cd backend
env -i PATH=/usr/local/bin:/usr/bin:/bin TEST_PG_BIN=/ruta/a/postgresql/bin node scripts/test-db-migrations.js
```

Para binarios extraídos, `TEST_PG_LIB` puede indicar su directorio de bibliotecas. La suite crea un directorio aleatorio privado y un clúster propio, deshabilita TCP, utiliza un socket Unix privado y autenticación local solo dentro de ese directorio. No acepta URLs de DB. Verifica `data_directory`, `listen_addresses` y dirección efectiva antes de ejecutar SQL; limpia su clúster al terminar. Las migraciones de prueba se escriben en un catálogo temporal, nunca sobre SQL históricos reales. Requiere un usuario no root.

Comprueba bootstrap CLI y estructura, ausencia de demo, repetición preservando usuario desactivado, historial, checksum de migración y baseline, rollback DDL/DML, dos procesos concurrentes, rechazo de base preexistente, históricos, diagnóstico y selección fuera de orden.

Regresión sin servicios externos:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin node --test src/utils/__tests__/*.test.js
env -i PATH=/usr/local/bin:/usr/bin:/bin node test.js
npm run check
```

`integration-isolated.js` es anterior: elimina tablas, permite fallback a `DATABASE_URL`, carga configuración de la aplicación en procesos hijos y reaplica 011–013. No usarlo como prueba del nuevo runner ni ejecutarlo sobre una DB existente. No fue modificado en H03/H04.

## Antes de release

- Pruebas anteriores aprobadas en PostgreSQL descartable y diff limitado al alcance.
- SQL nuevo revisado por transaccionalidad, locks, volumen, compatibilidad con la versión desplegada y posible efecto en datos.
- Históricos/baseline sin ediciones después de su aplicación; archivos incrementales aplicados conservados.
- Destino y rol revisados; ningún fallback a credenciales de aplicación; secretos fuera del repositorio y logs.
- Adopción histórica aprobada y ensayada cuando corresponda; backup/restauración y estrategia de reversión o corrección hacia adelante definidos.
- Ejecutar migraciones como paso operativo controlado antes de una versión que las requiera. Render/GitHub Actions no fueron modificados aquí.

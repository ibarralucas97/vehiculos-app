# F01 — Estabilización funcional

## Base y alcance

- Rama: `fix/maintenance-km-flow`, creada directamente desde `main`.
- Base verificada después de `git fetch origin main`: `8a5d2b2c3a65945803b671c3ecba0844ca901836`, igual a `origin/main`; árbol inicialmente limpio.
- Sin incorporación de `fix/db-migrations-bootstrap`, sin cambios en main, autenticación, roles, registro, CSS, HTML, service worker o PATCH de vehículos.
- Cambios locales, sin commit, push, PR ni deploy. No se accedió a Neon.

## Diagnóstico y cambios

### F01-A — Kilometraje

Causa comprobada del mensaje engañoso: `saveKmUpdateFromModal` incluía PATCH, actualización local, refresco y renderizado en un mismo try/catch. Cualquier excepción posterior a la respuesta exitosa se presentaba como error de actualización del kilometraje y devolvía false al modal.

No se reprodujo el `ReferenceError: sessionGeneration is not defined` original. En esta base hay una declaración léxica global `let sessionGeneration = 0`; index.html carga app.js antes de dashboard-enhancements.js, ambos scripts clásicos defer. Las pruebas cargan esa declaración real, las funciones de guardado/refresco/contexto y el archivo completo de sobrescrituras en el mismo contexto VM. El recorrido normal no produce referencias indefinidas. Esto no equivale a reproducir Firefox ni los recursos exactos que recibió producción. No hay evidencia suficiente para atribuirlo a caché, ámbito o versión; diagnóstico original abierto.

Se diferencia respuesta confirmada de sincronización posterior: se conserva el vehículo devuelto, el modal puede cerrarse y se informa que fue guardado aunque falle el refresco. El aviso ofrece actualizar desde el título superior y pide no repetir el guardado. Se evita la segunda consulta redundante al dashboard; la sobrescritura de refreshAllData ya la realiza. Se conserva la protección frente a cambio de sesión.

`loadDashboardOverview` admite propagación optativa del error (`throwOnError`) para estos flujos; conserva su presentación de errores y comportamiento por defecto para los demás consumidores. No se duplicó sessionGeneration ni se modificó el service worker.

### F01-B — Mantenimiento y odómetro

Causa comprobada: POST y PUT contenían `UPDATE vehiculos` con CASE que reemplazaba km_actual por el máximo y actualizaba km_updated_at cuando aumentaba. Se eliminaron exclusivamente ambos bloques (28 líneas). Se conservan las transacciones, controles de propiedad, imágenes, actividad, notificaciones y recálculo del plan anterior/nuevo. El kilometraje histórico sigue persistiendo.

### F01-C — Confirmación y navegación

Causas comprobadas: el submit permanecía en el formulario; actualizaba historial sólo si había filtros; mezclaba guardado y refresco en un catch; no tenía bloqueo lógico de envíos simultáneos. El historial sin filtros limita a tres registros por fecha, pudiendo ocultar una carga retroactiva.

Ahora confirma «Mantenimiento registrado correctamente» o «Mantenimiento actualizado correctamente», restablece el formulario/imagen, limpia filtros, abre la vista existente de historial y muestra primero el registro confirmado. Conserva los datos e imagen disponibles en la respuesta/caché privado mientras se consulta el historial completo. `loadMaintenance({highlightId})` permite incluir una fecha antigua entre los tres registros visibles y explica el orden/filtros. Un bloqueo cubre preparación de imagen, petición y refresco.

Ante error del servidor se conserva el formulario, sin éxito falso. Ante fallo posterior se conserva el registro confirmado y se muestra una advertencia con botón «Actualizar datos» dentro del historial. Ese botón sólo realiza lecturas y mantiene el registro priorizado; no repite POST/PUT. El refresco general ahora carga también el historial abierto sin filtros.

### F01-D — Recordatorios

Causa comprobada: buildVehicleReminderSummary interpolaba cualquier kmRemaining en «Faltan aproximadamente», incluidos negativos. Ahora distingue positivos, cero, negativos y ausencia de dato; usa es-AR y valor absoluto sólo para presentar el atraso. No cambia fechas, mensajes base ni cálculos backend; conserva recordatorios generales y planes.

## Archivos y funciones

- `backend/public/app.js`: saveKmUpdateFromModal, showSavedSyncWarning, submit de maintenanceForm, loadMaintenance, refreshCurrentContext y buildVehicleReminderSummary; bloqueo maintenanceSaveGeneration.
- `backend/public/dashboard-enhancements.js`: loadDashboardOverview y patchedRefreshAllData.
- `backend/src/routes/maintenance.js`: eliminación de los dos UPDATE automáticos.
- `backend/tests/maintenance-km-flow.test.js`: regresiones frontend VM (incluye sobrescrituras completas).
- `backend/tests/maintenance-km-postgres.test.js`: handlers reales, validación y SQL reales sobre PostgreSQL descartable; transporte push simulado para evitar envíos externos.

## Validación realizada

- Frontend F01: 54/54 (incluye las regresiones de concurrencia y del bloqueo entre sesiones).
- PostgreSQL F01: 9/9 casos internos (Node informa 10 incluyendo el contenedor).
- H01/H02 frontend-security: 40/40.
- Administración: 4/4; planes: 6/6; recordatorios: 12/12.
- Integración existente `npm run test:integration:isolated`: RESULTADO: integracion aislada OK.
- `npm run check`, `node --check` de los cinco JS modificados/agregados y `git diff --check`: sin errores.

PostgreSQL 16 se descargó y extrajo en `/tmp/f01-postgres`, sin instalación global. Cluster nuevo en `/tmp/f01-postgres/data`, sólo 127.0.0.1:55431, base `f01_disposable`. No se leyó DATABASE_URL para F01: la suite requiere F01_TEST_DATABASE_URL explícita, host local, nombre exacto y sin parámetros de conexión. Crea y elimina un esquema propio, rechazando sobrescribirlo. La integración existente recibió TEST_DATABASE_URL local explícita y ejecutó su preparación/migraciones preexistentes únicamente allí.

Comandos reproducibles (con PostgreSQL descartable ya iniciado):

```sh
node backend/tests/maintenance-km-flow.test.js
node backend/tests/frontend-security.test.js
node backend/src/utils/__tests__/adminExperience.test.js
node backend/src/utils/__tests__/maintenancePlans.test.js
node backend/src/utils/__tests__/reminders.test.js
F01_TEST_DATABASE_URL=postgresql://lucas@127.0.0.1:55431/f01_disposable node backend/tests/maintenance-km-postgres.test.js
cd backend
TEST_DATABASE_URL=postgresql://lucas@127.0.0.1:55431/f01_disposable npm run test:integration:isolated
npm run check
```

La suite PostgreSQL se omite explícitamente si no se proporciona F01_TEST_DATABASE_URL. Las regresiones frontend simulan DOM/red: queda pendiente comprobación real de navegador/PWA y disposición visual.

## Vehículos potencialmente afectados históricamente

No se corrigió ningún dato existente. Para una revisión autorizada posterior, buscar candidatos cuyo odómetro coincida con el kilometraje de un mantenimiento y cuyo km_updated_at coincida aproximadamente con su actividad de creación/edición. Consulta orientativa, NO ejecutada en producción:

```sql
SELECT DISTINCT v.id AS vehiculo_id, v.user_id, v.km_actual, v.km_updated_at,
       m.id AS mantenimiento_id, m.km AS km_historico,
       a.action, a.created_at AS actividad_en
FROM vehiculos v
JOIN mantenimiento m ON m.vehiculo_id = v.id AND m.user_id = v.user_id
JOIN activity_logs a ON a.entity_type = 'maintenance'
  AND a.entity_id = m.id AND a.user_id = v.user_id
WHERE a.action IN ('maintenance.create', 'maintenance.update')
  AND v.km_actual = m.km
  AND ABS(EXTRACT(EPOCH FROM (v.km_updated_at - a.created_at))) <= 5
ORDER BY v.id, a.created_at DESC;
```

Es una lista de candidatos, no prueba causal: puede haber coincidencias, actividad faltante, modificaciones posteriores o mantenimiento eliminado. El log no guarda el odómetro anterior a esta sustitución. Para confirmar y reconstruir se necesitan backups/auditoría previa o un valor corroborado por el propietario. No inferir que todo mantenimiento superior al odómetro indica corrupción; ahora es válido por negocio. No realizar correcciones automáticas.

## Riesgos y pendientes antes de producción

1. En Firefox, activar pausa en excepciones y conservar Network/Console. Registrar stack completo, URL/línea del error y estado/cuerpo del PATCH; después identificar qué GET/render falla. Comparar contenido/hashes de app.js y dashboard-enhancements.js recibidos con la revisión desplegada. Verificar errores previos a inicialización y script/frame en el que ocurre. No borrar caché como supuesto diagnóstico.
2. En entorno de prueba, odómetro 15.010: crear mantenimiento 15.235 y comprobar historial 15.235, odómetro 15.010 y timestamp intacto; repetir edición, inferior/igual, plan y eventual.
3. Crear/editar con imagen, filtros restrictivos y fecha antigua: confirmación exacta, cierre del formulario, registro primero y formulario limpio; doble click no duplica.
4. Simular PATCH/POST/PUT rechazado y luego respuesta exitosa seguida de GET fallido. Comprobar mensajes diferenciados, registro/odómetro conservado y recuperación por «Actualizar datos» sin otra escritura.
5. Recordatorios +500/0/-500/sin dato; fechas y planes sin cambios. Repetir en PWA instalada y Firefox móvil/escritorio.
6. Una conexión perdida antes de recibir respuesta puede ser ambigua: este bloque no introduce idempotencia backend ni resuelve el caso de commit sin respuesta. Ante incertidumbre, consultar historial antes de repetir. El ReferenceError original tampoco se considera resuelto sin stack/reproducción.

Se requiere publicar posteriormente el backend y los dos JS frontend revisados, mediante aprobación humana. No se realizó deploy. No hay migraciones nuevas ni cambios de esquema necesarios para F01, ni correcciones históricas automáticas. Las únicas operaciones de esquema realizadas fueron preparación/limpieza de la base descartable de pruebas.

## Estado de revisión anterior al último ajuste de bloqueo

PostgreSQL descartable detenido al terminar. HEAD, main y origin/main siguen en la base indicada.

`git diff --stat` (Git no incluye aquí archivos nuevos sin seguimiento):

```text
 backend/public/app.js                    | 192 +++++++++++++++++++++----------
 backend/public/dashboard-enhancements.js |  40 +++++--
 backend/src/routes/maintenance.js        |  28 -----
 backend/tests/frontend-security.test.js  |   5 +-
 4 files changed, 163 insertions(+), 102 deletions(-)
```

`git diff --check`: salida vacía, exit 0. Estado local:

```text
 M backend/public/app.js
 M backend/public/dashboard-enhancements.js
 M backend/src/routes/maintenance.js
 M backend/tests/frontend-security.test.js
?? backend/tests/maintenance-km-flow.test.js
?? backend/tests/maintenance-km-postgres.test.js
?? docs/F01-estabilizacion-funcional.md
```

Nada agregado al índice. Los archivos nuevos de pruebas e informe deben incluirse en la revisión humana junto al diff rastreado.


## Revisión técnica posterior — concurrencia

Se mantuvo la rama y los cambios F01 anteriores. loadMaintenance y loadMaintenancePlans capturan generación y vehículo, construyen la URL con ese vehículo y descartan respuestas o errores obsoletos antes de escribir cachés, listas, selects, mensajes o HTML. loadDashboardOverview valida también el vehículo en éxito y error. Sus sobrescrituras de historial/refresco no inician nuevas consultas cuando el contexto original cambió.

La revisión de la cadena refreshAllData demostró escrituras tardías en loadSelects, loadVehiclesList y loadPlacesList. Se agregaron comprobaciones antes de sus escrituras y entre pasos de refreshAllData. Las continuaciones de guardado y recuperación F01 comprueban también el vehículo para no abrir el historial anterior sobre el nuevo. No se modificaron reglas de negocio, filtros, highlightId ni cálculos.

Se añadieron 25 pruebas: cuenta A→B, vehículo A→B, respuesta B antes de A, éxito/rechazo obsoleto, ausencia de cambios en cachés y DOM, interrupción de la cadena de refresco, guardado con cambio de vehículo, filtros normales y recuperación tardía. Se conservan las pruebas previas de historial antiguo y guardado exitoso. El fixture H01/H02 incorpora los globals que ahora consultan los loaders y usa una promesa compartida para rechazar ambas consultas del dashboard; antes dejaba una pendiente indefinidamente.

Resultados posteriores a revisión: 51 frontend F01, 40 H01/H02, 9 casos PostgreSQL, administración/planes/recordatorios completos, npm run check, node --check y git diff --check aprobados. Se reejecutó PostgreSQL F01 únicamente sobre f01_disposable, con preparación y limpieza de su esquema de prueba; no se ejecutaron scripts de migración ni la integración que aplica migraciones en esta revisión. PostgreSQL quedó detenido.

Fuera de este cambio: loadVehiclesScreen (incluida su sobrescritura) y las ramas de perfil/preferencias de refreshCurrentContext conservan escrituras tras await sin comprobación local equivalente. Son flujos preexistentes ajenos al guardado/refresco de dashboard F01; no se refactorizaron ni se afirma haber probado sus carreras. Tampoco se introduce una política general para ordenar peticiones simultáneas dentro de una misma sesión y un mismo vehículo.


## Último ajuste — bloqueo de guardado por sesión

Se reemplazó el booleano global por maintenanceSaveGeneration (null cuando no hay bloqueo). El submit sólo bloquea otra operación de su misma generación. Una sesión nueva puede guardar aunque la anterior siga pendiente, y cada finally sólo libera el bloqueo si todavía pertenece a su generación. Se conservaron las comprobaciones de sessionGeneration y selectedVehicleId antes de modificar la interfaz.

resetMaintenanceFormState deriva también el estado disabled del botón de la generación propietaria del bloqueo: la limpieza tras logout/login habilita el botón de la sesión nueva, sin habilitar duplicados de una operación actual. El fixture H01/H02 incorpora el estado inicial de este bloqueo; no se cambiaron otras funciones productivas, backend, planes ni service worker en este ajuste.

Tres regresiones nuevas comprueban A pendiente → logout/login B → B pendiente → respuesta o error tardío de A, bloqueo de duplicados de B, ausencia de modificaciones a su formulario/mensajes/historial, liberación al finalizar B y reintento tras rechazo explícito del servidor. Las regresiones previas mantienen la comprobación de un solo POST en la misma sesión.

Resultados finales: frontend F01 54/54, H01/H02 40/40, PostgreSQL F01 9/9 casos funcionales (10 contando el contenedor). npm run check, node --check y git diff --check aprobados. PostgreSQL fue exclusivamente local y descartable, y quedó detenido. No se ejecutaron migraciones, ni se accedió a Neon, ni se realizó commit, push o deploy.

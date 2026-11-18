# F02 + F03 + F04 — Modernización del frontend

## Base y alcance

Rama única: `feat/frontend-modernization-f02-f04`.
Base verificada mediante fetch: `0c21e7ecdc03eec3c7ede95229925fcce3d1f697` (merge de F01, PR #2). El árbol estaba limpio. Se actualizó main por fast-forward y se creó la rama desde esa base. No se incorporó H03/H04.

Implementación local, sin commit, push, PR remoto ni deploy. El PR único se podrá abrir después de la revisión y publicación manual de esta rama. No se modificaron endpoints, autenticación, roles, modelo de datos, cálculo de planes, kilometraje o reglas de notificación push.

## Etapas implementadas

### F04 — Sistema visual

`modernization.css` define tokens semánticos para superficies, texto, borde, acento, foco, estados, sombras y radios en claro/oscuro. Reutiliza los componentes existentes y reemplaza el marco oscuro fijo, los degradados generalizados y las restricciones de ancho. Una regla de botón del CSS anterior se convierte a `:where(...)` para permitir que la nueva capa la sustituya sin aumentar la especificidad indefinidamente.

`appearance.js` aplica claro, oscuro o sistema; persiste únicamente `mygarage_theme` en localStorage como preferencia pública del navegador. Escucha cambios del sistema y de otras pestañas, tolera almacenamiento bloqueado y actualiza theme-color/color-scheme. Se aplica antes del contenido y se sincroniza al cargar el DOM. Los controles están disponibles en login y configuración. Cambiar el tema no reinicia formularios, sesión ni vehículo seleccionado.

No se agregaron frameworks ni dependencias de ejecución. Los iconos existentes se conservan. Se respeta prefers-reduced-motion.

### F02 — Responsive y notificaciones

- Contenedor de hasta 1320 px; tarjetas de vehículos en cuadrícula adaptable.
- Detalle de vehículo con identidad, odómetro, próximo mantenimiento y acciones en una composición de dos columnas en escritorio y una en móvil, sin altura forzada de pantalla.
- Modales de hasta 640/1000 px y configuración hasta 1100 px; límites basados en viewport, scroll vertical y formularios que se apilan.
- Menú acotado al viewport, controles cómodos, selección de colores en filas sin carrusel horizontal.
- Centro de notificaciones con texto explícito «No leída»/«Leída», indicador discreto, fechas legibles, hover neutro y foco visible. Se conservan filtros, marcado individual, marcado masivo y paginación. Seleccionar un aviso lo marca leído; no se promete un detalle inexistente.
- Navegación por teclado: enlace para saltar al contenido, etiquetas de diálogos, contención de foco, Escape y retorno al disparador visible. Se conserva el cierre especializado de confirmaciones, imágenes e historial.
- El panel administrativo sólo recibe el sistema visual, responsive y accesibilidad; no se reconstruye su funcionalidad.

### F03 — Configuración

Centro con nueve secciones: Apariencia, Mi cuenta, Seguridad, Notificaciones, Vehículos, Planes, Recordatorios, Lugares e Información. Reutiliza los formularios y acciones existentes. La navegación no reemplaza ni reinicia los campos al cambiar de sección. Un cambio obligatorio de contraseña abre Seguridad.

Planes y avisos se distinguen expresamente:

1. Planes individuales por tarea, primero en la gestión del vehículo.
2. Avisos generales por tiempo/km, con la configuración conservada.
3. Frecuencia para recordar la actualización del odómetro.
4. Preferencias de entrega y permisos del dispositivo.

Las acciones que necesitan vehículo se deshabilitan y explican cómo elegirlo cuando falta contexto. Los nombres y opciones nuevos se construyen con textContent/Option, sin HTML de usuario. El estado privado nuevo se limpia desde clearPrivateMaintenanceState y al cerrar Configuración.

**Diferencia de modelo comprobada:** `/places` filtra por user_id, no por vehículo. Los lugares pertenecen a la cuenta y se asocian a cada mantenimiento mediante lugar_id. Se conserva ese comportamiento y se lo explica en la interfaz. Convertirlos en lugares exclusivos por vehículo requiere un cambio de modelo/backend posterior; no se inventó esa asociación ni se migraron datos.

## Archivos

- `backend/public/modernization.css`: tokens, temas, composición responsive, formularios, notificaciones y configuración.
- `backend/public/appearance.js`: preferencia pública y sincronización de tema.
- `backend/public/frontend-ui.js`: navegación de configuración, limpieza de su contexto y manejo accesible de diálogos.
- `backend/public/index.html`: controles, estructura del centro, textos de planes/avisos, semántica y carga de recursos.
- `backend/public/app.js`: integración de tema, etiquetas de lectura y llamada de limpieza del nuevo contexto. No cambia guardados ni cálculos F01.
- `backend/public/styles.css`: reducción de especificidad de una regla heredada de botones.
- `backend/public/service-worker.js`: versión v23 y tres recursos públicos adicionales en APP_SHELL.
- `backend/package.json`: check incluye ambos JS nuevos.
- `backend/tests/frontend-modernization.test.js`: cinco regresiones de temas y recursos PWA.
- `backend/tests/frontend-modernization-browser.cjs`: servidor estático local con APIs sintéticas, responsive, accesibilidad e interacciones.
- `backend/tests/frontend-security.test.js`: expectativas de caché v22 actualizadas a v23; mismas aserciones de seguridad.

## PWA

El worker usa cache-first para recursos públicos. Mantener v22 distribuiría los CSS/JS anteriores aunque cambiara el servidor; por eso se actualiza a v23 y se agregan appearance.js, frontend-ui.js y modernization.css a la lista explícita. No cambian métodos, destinos, credenciales, políticas de MIME, exclusión de APIs/privados, activación, push o notificationclick.

La apariencia guardada no es un dato de cuenta. Las APIs y fotos privadas siguen fuera de Cache Storage. Las pruebas de navegador verifican caché pública, exclusión de APIs y apertura offline tras instalación. Es necesario publicar todos los archivos del frontend como una misma versión; no se ejecutó esa publicación.

## Validación

- H01/H02: 40 pruebas aprobadas, incluyendo XSS, limpieza entre cuentas, aislamiento de respuestas y restricciones del worker.
- F01 frontend: 54 pruebas aprobadas, sin modificaciones a la suite.
- F01 PostgreSQL: 9 casos funcionales aprobados (10 contando el contenedor), exclusivamente en `f01_disposable` sobre 127.0.0.1:55431. El esquema de prueba fue creado/eliminado por la suite existente; no hubo migraciones ni acceso a una base de aplicación. El cluster temporal quedó detenido.
- Administración: 4; planes: 6; recordatorios: 12, aprobados.
- Temas/PWA nuevos: 5 aprobados (sistema, persistencia, cambios de otras pestañas, almacenamiento denegado, allowlist).
- `npm run check`, `node --check` de pruebas y `git diff --check`: aprobados.

Pruebas visuales: Chromium local headless con fixture de APIs; no se conecta a producción ni se envía push. Matriz: 360, 390, 768, 1024 y 1440 px, con claro y oscuro. Incluye login, vehículos, detalle, configuración, notificaciones, perfil, lugares, cuatro pasos de alta de vehículo, mantenimiento, historial, planes/avisos y administración. El test verifica ancho de documento y de contenedores de diálogo, toma capturas y ejecuta axe WCAG A/AA a 390 px en ambos temas.

Interacciones verificadas por el navegador: login/logout simulados mediante los formularios reales, selección de vehículo, foco dentro de configuración, Escape, borrador conservado al cambiar tema, persistencia tras recarga, creación de mantenimiento con fecha antigua y odómetro intacto, filtros y marcado individual/masivo de avisos, cambio de cuenta sin retener el contexto nuevo de configuración, shell PWA offline. Los endpoints son fixtures: esto no sustituye autenticación real, permisos push del dispositivo ni una prueba end-to-end productiva.

Artefactos fuera del repositorio: `/tmp/rodado-ui/artifacts/` contiene capturas, `results.json` y `accessibility.json`. La prueba usa el Bootstrap 5.3.3 ya existente (copia local de su CSS para repetir sin CDN), y tipografía de respaldo cuando Google Fonts no está disponible. La app no depende de la herramienta de pruebas; Playwright/axe y las bibliotecas de Chromium se instalaron sólo bajo /tmp.

Comandos:

```sh
node --test backend/tests/frontend-security.test.js backend/tests/maintenance-km-flow.test.js backend/tests/frontend-modernization.test.js backend/src/utils/__tests__/*.test.js
npm run check --prefix backend
node --check backend/tests/frontend-modernization-browser.cjs
LD_LIBRARY_PATH=/tmp/rodado-ui/libs/usr/lib/x86_64-linux-gnu NODE_PATH=/tmp/rodado-ui/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/rodado-ui/browsers node backend/tests/frontend-modernization-browser.cjs
git diff --check
```

## Límites y comprobaciones manuales previas a producción

- Firefox, Safari/iOS y Android con teclado/táctil y lectores de pantalla reales. La automatización se ejecuta en Chromium; no certifica por sí sola accesibilidad completa.
- PWA instalada: actualización v22→v23, reapertura, modo offline y retorno online. El navegador automatizado cubre instalación nueva/cache offline; validar también una instalación histórica real.
- Entrega push real, permisos denegados/concedidos y acciones de notificaciones en dispositivo. No se alteró esa lógica ni se enviaron mensajes de prueba externos.
- Tema automático con cambio del sistema operativo, webfont online, zoom al 200 %, textos de vehículos/lugares excepcionalmente largos y carga de fotos/exportación existentes.
- Login con usuarios de prueba autorizados, cambio de cuenta, formulario sin guardar y navegación por todas las secciones; administración con cuenta autorizada.
- Se posponen la unificación de reglas de planes/avisos, la asociación exclusiva de lugares a vehículos y cualquier reconstrucción funcional administrativa. No se cambió silenciosamente ningún dato.
- El ReferenceError original documentado en F01 no se considera diagnosticado por esta modernización.

## Propuesta de PR único (para publicación manual)

Título: `feat(frontend): modernize responsive layout, settings and themes (F02–F04)`

Descripción: La interfaz forzaba oscuro, limitaba el ancho del detalle y dispersaba la configuración. Esta versión incorpora claro/oscuro/sistema, composición responsive, un centro de configuración con formularios existentes y un centro de notificaciones con estados de lectura claros. Conserva la lógica H01/H02/F01 y actualiza únicamente la versión/lista pública del worker para distribuir los nuevos recursos. Validación: suites existentes, regresiones de tema, matriz de navegador y comprobaciones WCAG automatizadas descritas en este informe. Sin migraciones ni cambios de API.


## Resultado final y Git

Última ejecución completa: **230 comprobaciones responsive/tema aprobadas**, 46 por ancho (360, 390, 768, 1024 y 1440 px). **46 auditorías axe WCAG A/AA** a 390 px, en claro y oscuro: **0 infracciones detectadas**. Cero errores JavaScript no controlados. Esto incluye el CSS Bootstrap existente, los cuatro pasos del formulario de vehículo y los controles funcionales descritos arriba. No equivale a una certificación completa ni sustituye las pruebas manuales indicadas.

`git diff --check`: sin salida, exit 0. `git diff --stat` de archivos ya rastreados:

```text
 backend/package.json                    |  2 +-
 backend/public/app.js                   | 21 +++------
 backend/public/index.html               | 76 ++++++++++++++++++++++++---------
 backend/public/service-worker.js        |  5 ++-
 backend/public/styles.css               |  2 +-
 backend/tests/frontend-security.test.js | 18 ++++----
 6 files changed, 76 insertions(+), 48 deletions(-)
```

Además hay seis archivos nuevos sin seguimiento (no aparecen en ese stat): appearance.js, frontend-ui.js, modernization.css, frontend-modernization.test.js, frontend-modernization-browser.cjs y este informe. Ningún archivo se agregó al índice.

```text
 M backend/package.json
 M backend/public/app.js
 M backend/public/index.html
 M backend/public/service-worker.js
 M backend/public/styles.css
 M backend/tests/frontend-security.test.js
?? backend/public/appearance.js
?? backend/public/frontend-ui.js
?? backend/public/modernization.css
?? backend/tests/frontend-modernization-browser.cjs
?? backend/tests/frontend-modernization.test.js
?? docs/F02-F04-modernizacion-frontend.md
```

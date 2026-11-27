# H01 / H02 — revisión y regresión manual

Base: `main` / `origin/main` en `65aad3b556329058b1a69323a0c6eb38116d229c`.
Rama: `fix/frontend-h01-h02-security`.

Las correcciones están implementadas y las 27 pruebas (17 originales y 10 agregadas tras revisión) de Node pasan.
Las pruebas ejecutan funciones reales en VM y simulan DOM, fetch, Cache Storage
y eventos del service worker. No reemplazan un navegador: la interpretación del
HTML por el DOM, los formularios completos y el ciclo real de actualización PWA
siguen pendientes. No dar por cerrado el hallazgo en producción hasta completar
esta lista en un entorno de prueba con dos cuentas ficticias.

## Escritorio — H01 y mantenimientos

- [ ] Crear lugares y mantenimientos con nombres, ubicaciones, contactos y
  observaciones que contengan `<img src=x onerror="window.__h01=1">`,
  `<script>window.__h01=1</script>`, `" ' & < >` y texto con acentos.
- [ ] Verificar en selects, tarjetas y detalles que el contenido aparece como
  texto literal; inspeccionar DOM y comprobar que no se crean nodos script,
  imágenes ni atributos de evento procedentes del dato. `window.__h01` debe
  permanecer indefinido. Verificar que las opciones conservan el texto y su ID.
- [ ] Abrir detalle de lugar y comprobar los cuatro campos, incluidos contactos.
- [ ] Crear mantenimiento con PNG/JPEG; comprobar vista previa, guardado, recarga,
  detalle, ampliación y cierre. Probar registro sin imagen.
- [ ] Editar texto sin adjuntar imagen: la imagen existente debe conservarse.
  Reemplazar imagen y comprobar que se muestra la nueva después de recargar.
- [ ] Eliminar mantenimiento: su detalle y su imagen no deben poder recuperarse
  desde el historial. Verificar formularios, selección de lugar y filtros.
- [ ] Probar URLs históricas HTTP/HTTPS si existen en datos de prueba. Los esquemas
  javascript, SVG/data no raster y URLs con credenciales deben quedar rechazados.

## Dos cuentas y sesiones — H02

- [ ] En A, abrir historial, detalle y lightbox; seleccionar un archivo sin guardar.
  Inyectar exclusivamente datos ficticios en la clave heredada
  `mygarage_maintenance_images`. Cerrar sesión y comprobar que desaparece la clave,
  se vacían formulario, preview, detalle y registros en memoria.
- [ ] Entrar como B sin recargar. No deben aparecer imágenes/referencias de A,
  incluso si B no tiene mantenimientos. Volver a A y comprobar su imagen desde API.
- [ ] Repetir con sesión vencida (401) y con cambio de sesión en otra pestaña.
- [ ] Con red ralentizada, cerrar sesión durante GET /maintenance o la preparación
  de una imagen. La respuesta anterior no debe rellenar la UI de B ni cerrar su sesión.
- [ ] Recargar una instalación anterior que conserve la clave heredada: debe
  eliminarse al iniciar sin leer ni reimportar su contenido.

## Android / PWA y actualización

- [ ] En un origen de prueba, partir de v21 con una entrada privada ficticia
  `/activity`; actualizar al nuevo service worker. Esperar activación/control y
  recargar. Debe quedar solo `rodado-control-v22`, sin datos de la caché anterior.
- [ ] Visitar activity, maintenance, users, una ruta privada nueva y URLs de
  imágenes privadas. Revisar Cache Storage: únicamente rutas de APP_SHELL,
  sin query strings, datos de cuenta ni imágenes de mantenimiento.
- [ ] Sin red, abrir `/`, `/index.html` y un enlace de notificación con query.
  Debe cargar el shell. Las APIs deben fallar por red, nunca devolver index.html.
- [ ] Comprobar iconos, splash, navegación, formularios y orientación en Android.
- [ ] Recibir push con la app abierta/cerrada; tocar la notificación y comprobar
  navegación/foco. Usar solo suscripciones del entorno de prueba.

## Dependencias y límites

- GET /maintenance ya devuelve `image_source` (COALESCE de URL/base64). No se
  necesita un cambio de backend, SQL ni almacenamiento de imágenes. No se conserva
  respaldo local cuando una respuesta omite la imagen: debe corregirse la API si
  deja de cumplir ese contrato.
- La lista positiva requiere mantener APP_SHELL al incorporar recursos locales.
  El servidor debe servir esos archivos públicos sin sesión, sin redirecciones,
  con 200 y MIME correcto. Un fallo de instalación impide activar v22; comprobar
  que se activó antes de considerar eliminadas las entradas privadas de v21.
- Los CDN de Bootstrap, fuentes y jsPDF no entran en Cache Storage. Su disponibilidad
  offline depende del navegador/red; el shell local sí se precarga. Las imágenes
  privadas y las APIs requieren red y sesión, salvo imágenes ya recibidas en memoria.
- Offline, las APIs ahora propagan el fallo de red original, en lugar del JSON 503
  sintético de v21. Comprobar el mensaje de error visible.
- Las pruebas no acceden a PostgreSQL, Neon, servicios push ni datos productivos.
  No se ejecutaron integración aislada, bootstrap, seed ni migraciones. `npm run
  check` solo comprueba sintaxis, incluso para los scripts que menciona.

## Comandos de validación

Desde la raíz:

```sh
node --check backend/public/app.js
node --check backend/public/service-worker.js
node --check backend/public/dashboard-enhancements.js
node --check backend/tests/frontend-security.test.js
node --test backend/tests/frontend-security.test.js
node backend/tests/frontend-security.test.js
node --test backend/src/utils/__tests__/adminExperience.test.js backend/src/utils/__tests__/maintenancePlans.test.js backend/src/utils/__tests__/reminders.test.js
git diff --check
```

Desde backend: `npm run check`.

En este entorno Node 18, `node --test` informa por archivo; ejecutar directamente
el archivo nuevo imprime sus 27 casos individuales. Todos aprobaron. No hay
Chromium, Chrome o Firefox instalados: las comprobaciones de navegador anteriores
no se ejecutaron y permanecen sin marcar.

## Escenarios agregados tras revisión independiente

- [ ] Con ambos scripts cargados en el orden de index.html, abrir detalles de lugar
  y vehículo. Confirmar que las funciones efectivas son patchedViewPlace y
  patchedViewVehicle y que los datos maliciosos se muestran como texto literal.
- [ ] Verificar recordatorios con alertas y sin alertas, nombres de vehículo,
  mensajes, etiquetas y nombres de planes. Probar comillas en atributos e IDs
  inválidos mediante respuestas ficticias: no deben crear manejadores ejecutables.
- [ ] Simular errores API con HTML en eliminación, exportación, carga inicial y
  dashboard: debe mostrarse el mensaje literal, conservando el error de la operación.
- [ ] En A, cargar planes, bandeja, resumen de recordatorios y configuración push;
  abrir una confirmación sin responder. Cambiar a B o invalidar sesión: deben
  limpiarse listas, contadores, formularios y resumen. La confirmación debe cancelarse.
- [ ] Ralentizar consultas de notificaciones/dashboard y la consulta de suscripción
  push; cambiar de cuenta mientras están pendientes. Al terminar, A no debe
  reemplazar datos ni liberar indicadores de carga que pertenezcan a B.
- [ ] Comprobar en Network que fuentes y CDN externos quedan a cargo del navegador,
  sin respondWith del service worker ni entradas nuevas en Cache Storage.

La ampliación carga dashboard-enhancements.js completo en VM después de las
funciones de app.js utilizadas por las pruebas; comprueba las redefiniciones
reales y sus salidas hacia el modal. Sigue usando dobles de DOM, no un motor HTML.

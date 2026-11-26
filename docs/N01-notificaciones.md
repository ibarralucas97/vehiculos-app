# Operación de recordatorios Web Push

## Programación prevista

El workflow [Run Push Reminders](../.github/workflows/run-push-reminders.yml) define una ejecución cada 30 minutos, a los minutos 0 y 30 de cada hora UTC. Llama mediante HTTPS al servicio web de Render. El comando `npm run notifications:run --prefix backend` es otra entrada al mismo barrido y requiere acceso directo a la base. Tener el script, el workflow o las variables configuradas solo acredita configuración.

## Configuración por verificar en producción

- En el servicio web de Render, revisar la presencia de `DATABASE_URL`, `PUSH_VAPID_SUBJECT` (contacto válido), `PUSH_VAPID_PUBLIC_KEY` y `PUSH_VAPID_PRIVATE_KEY`. Conservar el par existente asociado a los dispositivos. El cliente solo recibe la clave pública validada por la biblioteca.
- En GitHub Actions, verificar que el workflow esté habilitado en la rama predeterminada. El secreto `RENDER_APP_URL` contiene el origen HTTPS del servicio y `CRON_SECRET` debe coincidir con el del servicio web. El endpoint también reconoce el nombre alternativo `NOTIFICATIONS_CRON_TOKEN` del servidor.
- La invocación del workflow es un `POST /notifications/run-reminders` sobre ese origen. El secreto se inyecta desde el almacén del ejecutor en el encabezado HTTP `Authorization`, con el esquema `Bearer`. También se admite el encabezado `x-cron-secret`. Mantener credenciales fuera de URLs, cuerpos, logs y diagnósticos de shell. El workflow existente cubre la programación sin agregar un segundo cron en Render.

## Verificación sin repetir barridos

1. Revisar en Actions las últimas ejecuciones con disparador **schedule**. Correlacionar hora y respuesta HTTP con Render. Ante un retraso o timeout, revisar primero el resultado de las ejecuciones existentes. Iniciar el workflow manualmente o lanzar el script procesaría los recordatorios de todos los usuarios elegibles.
2. Leer el resumen agregado de la respuesta. `users` cuenta cuentas elegibles con suscripción, `candidates` los recordatorios evaluados y `cooldownSkipped` los que ya estaban en espera. `attempted`, `sent` y `failed` cuentan intentos por suscripción, aceptaciones del servicio push y fallos respectivamente. `pruned` es el subconjunto de suscripciones eliminadas por respuestas 404/410. Un barrido exitoso puede tener cero candidatos o cero aceptaciones.
3. Para verificar la entrega efectiva, usar **Enviar prueba** una vez en un dispositivo autorizado con sesión y permiso activos. Comparar el resultado de aceptación con un aviso visible del sistema y tocarlo para verificar la apertura. Para un recordatorio de vehículo, el enlace abre el detalle si el vehículo pertenece a la cuenta. En iPhone/iPad se necesita una versión compatible desde 16.4, la web app instalada y el permiso solicitado desde un gesto del usuario. [WebKit](https://webkit.org/blog/13878/)
4. La campana guarda eventos propios de la cuenta al consultar sus recordatorios, incluso sin suscripción. La fecha de creación y el estado leído corresponden al evento interno. Para comprobar la repetición, observar el próximo ciclo programado para el mismo vencimiento. No borrar eventos, restablecer el período de espera ni lanzar un segundo barrido.

## Alcance del diagnóstico

Un candidato por fecha, kilometraje o plan inicia su espera habitual de siete días cuando el proveedor acepta al menos un envío. El aviso periódico de actualizar kilometraje usa el intervalo del vehículo. Cada transacción serializa el procesamiento de una clave de recordatorio. Una caída entre la aceptación externa y el commit puede dejar un resultado incierto. Si solo algunos dispositivos aceptaron, la espera del evento también cubre a los demás.

El worker comprueba la cuenta con la sesión actual antes de mostrar detalles de un push. Si la sesión cambió, la consulta no responde a tiempo o el mensaje pertenece a una versión anterior sin identificador de cuenta, muestra un aviso genérico que abre Inicio. El cierre de sesión intenta cancelar la suscripción local y cerrar avisos visibles. Al volver a iniciar sesión puede ser necesario activar el dispositivo otra vez.

Las pruebas locales usan PostgreSQL descartable, endpoints ficticios y transporte simulado. Quedan pendientes el historial real de ejecuciones, la aceptación con las credenciales desplegadas y la comprobación en un dispositivo físico.

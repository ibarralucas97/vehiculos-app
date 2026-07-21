SELECT
  id,
  user_id,
  nombre,
  patente,
  km_actual,
  km_updated_at,
  fecha_ultimo_service,
  intervalo_tiempo,
  notify_days_before,
  ultimo_service_km,
  intervalo_km,
  notify_km_before,
  km_update_reminder_days
FROM vehiculos
WHERE id = ID_DEL_VEHICULO;

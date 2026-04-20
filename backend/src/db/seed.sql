INSERT INTO users (full_name, email, password_hash)
VALUES (
  'Lucas Demo',
  'lucas@mygarage.app',
  '567c0760a4125a2252036835ed28bec8:1b0d50ae8c2c5efb327599a81b203a7c079c37b85ef00bf7f7591479147f29684cc185e3d9ca176f86c8d9d8efdb33fd2df3ac437000b711dc4c8587bef26b55'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO vehiculos (nombre, modelo, patente)
VALUES ('Auto', 'Gol Trend', 'ABC123')
ON CONFLICT (patente) DO NOTHING;

INSERT INTO lugares (nombre, ubicacion, contacto_nombre, contacto_numero)
VALUES ('Taller Juan', 'Cordoba', 'Juan Perez', '3511234567')
ON CONFLICT DO NOTHING;

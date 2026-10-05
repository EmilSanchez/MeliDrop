-- Usuarios (login)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pack de precios: un perfil de configuración por usuario.
-- Un usuario puede tener varios (ej "Precios Generales", "Precios Electrónica", etc.)
CREATE TABLE IF NOT EXISTS price_packs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tramos de % de ganancia por rango de precio (USD)
CREATE TABLE IF NOT EXISTS profit_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id INTEGER NOT NULL REFERENCES price_packs(id) ON DELETE CASCADE,
  precio_inicial REAL NOT NULL,
  precio_limite REAL NOT NULL,
  porcentaje REAL NOT NULL,
  posicion INTEGER NOT NULL DEFAULT 0
);

-- Logísticas por pack: 'aguachica' (Logística de CENTRIS) y 'servientrega' (Logística de GBX)
-- Ajustes de seguro por logística (seguro = % del valor declarado, con mínimo en USD)
CREATE TABLE IF NOT EXISTS logistics_settings (
  pack_id INTEGER NOT NULL REFERENCES price_packs(id) ON DELETE CASCADE,
  logistica TEXT NOT NULL CHECK (logistica IN ('aguachica', 'servientrega')),
  seguro_porcentaje REAL NOT NULL DEFAULT 0,
  seguro_minimo_usd REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (pack_id, logistica)
);

-- Tarifa por libra entera (1..110): total_usd = costo TOTAL de enviar esas libras
CREATE TABLE IF NOT EXISTS logistics_rates (
  pack_id INTEGER NOT NULL REFERENCES price_packs(id) ON DELETE CASCADE,
  logistica TEXT NOT NULL CHECK (logistica IN ('aguachica', 'servientrega')),
  libras INTEGER NOT NULL,
  total_usd REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (pack_id, logistica, libras)
);

-- Tramos de impuestos nacionales por rango de precio (USD)
CREATE TABLE IF NOT EXISTS tax_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id INTEGER NOT NULL REFERENCES price_packs(id) ON DELETE CASCADE,
  precio_inicial REAL NOT NULL,
  precio_limite REAL NOT NULL,
  porcentaje REAL NOT NULL,
  posicion INTEGER NOT NULL DEFAULT 0
);

-- Cobros extras: pares nombre/valor sueltos
-- (Impuesto Amazon %, Impuesto Venta %, Dias disponibilidad stock, Comision tipo pub %)
CREATE TABLE IF NOT EXISTS extra_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id INTEGER NOT NULL REFERENCES price_packs(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  valor REAL NOT NULL,
  posicion INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_packs_user ON price_packs(user_id);
CREATE INDEX IF NOT EXISTS idx_profit_pack ON profit_tiers(pack_id);
CREATE INDEX IF NOT EXISTS idx_tax_pack ON tax_tiers(pack_id);
CREATE INDEX IF NOT EXISTS idx_extra_pack ON extra_charges(pack_id);
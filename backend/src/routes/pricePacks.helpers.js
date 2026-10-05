const db = require('../db');

// Valores por defecto = exactamente los que se ven hoy en "Configuración Precios"
// para que un usuario nuevo arranque con el mismo comportamiento del sistema actual.
const DEFAULT_PROFIT_TIERS = [
  { precio_inicial: 0, precio_limite: 5, porcentaje: 50 },
  { precio_inicial: 6, precio_limite: 10, porcentaje: 38 },
  { precio_inicial: 11, precio_limite: 40, porcentaje: 27 },
  { precio_inicial: 41, precio_limite: 200, porcentaje: 19 },
  { precio_inicial: 201, precio_limite: 10000, porcentaje: 15 },
];

const DEFAULT_SHIPPING_TIERS_ME = [
  { peso_inicial: 0, peso_limite: 1, precio_usd: 4.2 },
  { peso_inicial: 2, peso_limite: 15, precio_usd: 1.0 },
  { peso_inicial: 15, peso_limite: 10000, precio_usd: 1.0 },
];

const DEFAULT_SHIPPING_TIERS_CUSTOM = [
  { peso_inicial: 0, peso_limite: 1, precio_usd: 7 },
  { peso_inicial: 2, peso_limite: 15, precio_usd: 5.04 },
  { peso_inicial: 15, peso_limite: 10000, precio_usd: 1 },
];

const DEFAULT_TAX_TIERS = [
  { precio_inicial: 0, precio_limite: 50, porcentaje: 0 },
  { precio_inicial: 51, precio_limite: 100, porcentaje: 0 },
  { precio_inicial: 101, precio_limite: 200, porcentaje: 0 },
  { precio_inicial: 201, precio_limite: 300, porcentaje: 29 },
  { precio_inicial: 301, precio_limite: 10000, porcentaje: 29 },
];

const DEFAULT_EXTRA_CHARGES = [
  { nombre: 'Impuesto Amazon %', valor: 7 },
  { nombre: 'Impuesto Venta %', valor: 2 },
  { nombre: 'Dias de disponibilidad en stock', valor: 17 },
  { nombre: 'Comision tipo de pub. %', valor: 12 },
];

function createDefaultPack(userId, nombre = 'Precios Generales') {
  const insertPack = db.prepare(
    'INSERT INTO price_packs (user_id, nombre, is_default) VALUES (?, ?, 1)'
  );
  const packId = insertPack.run(userId, nombre).lastInsertRowid;

  const insertProfit = db.prepare(
    'INSERT INTO profit_tiers (pack_id, precio_inicial, precio_limite, porcentaje, posicion) VALUES (?, ?, ?, ?, ?)'
  );
  DEFAULT_PROFIT_TIERS.forEach((t, i) =>
    insertProfit.run(packId, t.precio_inicial, t.precio_limite, t.porcentaje, i)
  );

  const insertShipping = db.prepare(
    'INSERT INTO shipping_tiers (pack_id, variante, peso_inicial, peso_limite, precio_usd, posicion) VALUES (?, ?, ?, ?, ?, ?)'
  );
  DEFAULT_SHIPPING_TIERS_ME.forEach((t, i) =>
    insertShipping.run(packId, 'mercado_envios', t.peso_inicial, t.peso_limite, t.precio_usd, i)
  );
  DEFAULT_SHIPPING_TIERS_CUSTOM.forEach((t, i) =>
    insertShipping.run(packId, 'custom', t.peso_inicial, t.peso_limite, t.precio_usd, i)
  );

  const insertTax = db.prepare(
    'INSERT INTO tax_tiers (pack_id, precio_inicial, precio_limite, porcentaje, posicion) VALUES (?, ?, ?, ?, ?)'
  );
  DEFAULT_TAX_TIERS.forEach((t, i) =>
    insertTax.run(packId, t.precio_inicial, t.precio_limite, t.porcentaje, i)
  );

  const insertExtra = db.prepare(
    'INSERT INTO extra_charges (pack_id, nombre, valor, posicion) VALUES (?, ?, ?, ?)'
  );
  DEFAULT_EXTRA_CHARGES.forEach((t, i) => insertExtra.run(packId, t.nombre, t.valor, i));

  return packId;
}

module.exports = { createDefaultPack };

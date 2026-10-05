const db = require('../db');
const { LOGISTICAS } = require('../pricing/logisticas');
const { seedPack } = require('../db/seedLogistics');

// Valores por defecto = exactamente los que se ven hoy en "Configuración Precios"
// para que un usuario nuevo arranque con el mismo comportamiento del sistema actual.
const DEFAULT_PROFIT_TIERS = [
  { precio_inicial: 0, precio_limite: 5, porcentaje: 50 },
  { precio_inicial: 6, precio_limite: 10, porcentaje: 38 },
  { precio_inicial: 11, precio_limite: 40, porcentaje: 27 },
  { precio_inicial: 41, precio_limite: 200, porcentaje: 19 },
  { precio_inicial: 201, precio_limite: 10000, porcentaje: 15 },
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
  { nombre: 'Comision tipo de pub. %', valor: 14 },
  { nombre: 'Costo Reputacion COP', valor: 10900 },
  { nombre: 'Margen sobre el dolar COP', valor: 100 },
  { nombre: 'Dolar de respaldo COP', valor: 3300 },
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

  seedPack(db, packId);

  return packId;
}

// Pack completo con todas sus tablas (lo usan las rutas de packs y de cálculo)
function fullPack(packId) {
  const pack = db.prepare('SELECT * FROM price_packs WHERE id = ?').get(packId);
  if (!pack) return null;
  const logistics = {};
  for (const lg of Object.keys(LOGISTICAS)) {
    const st = db
      .prepare('SELECT seguro_porcentaje, seguro_minimo_usd FROM logistics_settings WHERE pack_id = ? AND logistica = ?')
      .get(packId, lg) || { seguro_porcentaje: 0, seguro_minimo_usd: 0 };
    logistics[lg] = {
      nombre: LOGISTICAS[lg].nombre,
      ...st,
      rates: db
        .prepare('SELECT libras, total_usd FROM logistics_rates WHERE pack_id = ? AND logistica = ? ORDER BY libras')
        .all(packId, lg),
    };
  }
  return {
    ...pack,
    profit_tiers: db.prepare('SELECT * FROM profit_tiers WHERE pack_id = ? ORDER BY posicion').all(packId),
    logistics,
    tax_tiers: db.prepare('SELECT * FROM tax_tiers WHERE pack_id = ? ORDER BY posicion').all(packId),
    extra_charges: db.prepare('SELECT * FROM extra_charges WHERE pack_id = ? ORDER BY posicion').all(packId),
  };
}

module.exports = { createDefaultPack, fullPack, DEFAULT_EXTRA_CHARGES };
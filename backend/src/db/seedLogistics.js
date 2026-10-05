const { DEFAULTS, MAX_LIBRAS } = require('../pricing/logisticas');

// Crea los ajustes y la tarifa de una logística para un pack (si no existen).
function seedLogistica(db, packId, logistica) {
  const d = DEFAULTS[logistica];
  db.prepare(
    'INSERT OR IGNORE INTO logistics_settings (pack_id, logistica, seguro_porcentaje, seguro_minimo_usd) VALUES (?, ?, ?, ?)'
  ).run(packId, logistica, d.seguro_porcentaje, d.seguro_minimo_usd);
  const ins = db.prepare(
    'INSERT OR IGNORE INTO logistics_rates (pack_id, logistica, libras, total_usd) VALUES (?, ?, ?, ?)'
  );
  for (let l = 1; l <= MAX_LIBRAS; l++) ins.run(packId, logistica, l, d.totales[l - 1]);
}

function seedPack(db, packId) {
  db.transaction(() => {
    Object.keys(DEFAULTS).forEach((lg) => seedLogistica(db, packId, lg));
  })();
}

// Migración: packs creados antes de existir las logísticas también las reciben.
function seedAllPacks(db) {
  const packs = db.prepare('SELECT id FROM price_packs').all();
  packs.forEach((p) => seedPack(db, p.id));
}

module.exports = { seedPack, seedAllPacks };
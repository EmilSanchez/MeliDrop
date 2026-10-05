const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createDefaultPack, fullPack } = require('./pricePacks.helpers');
const { LOGISTICAS, MAX_LIBRAS } = require('../pricing/logisticas');

const router = express.Router();
router.use(requireAuth);

// Confirma que el pack pedido es del usuario autenticado (nadie ve ni edita packs ajenos)
function getOwnedPack(packId, userId) {
  return db
    .prepare('SELECT * FROM price_packs WHERE id = ? AND user_id = ?')
    .get(packId, userId);
}

// Listar packs del usuario (para el combo "Seleccione el Pack de Precios")
router.get('/', (req, res) => {
  const listar = () =>
    db
      .prepare('SELECT id, nombre, is_default, created_at, updated_at FROM price_packs WHERE user_id = ? ORDER BY created_at, id')
      .all(req.userId);

  let packs = listar();

  // Un usuario nunca debe quedarse sin packs (cuenta creada a medias, base de
  // datos restaurada, etc.): si no tiene ninguno, arranca con "Precios Generales".
  if (packs.length === 0) {
    createDefaultPack(req.userId);
    packs = listar();
  }

  res.json(packs);
});

// Crear un pack nuevo (vacío o copiado del default)
router.post('/', (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio.' });
  const packId = createDefaultPack(req.userId, nombre);
  db.prepare('UPDATE price_packs SET is_default = 0 WHERE id = ?').run(packId);
  res.status(201).json(fullPack(packId));
});

// Detalle completo de un pack (todos los tramos, para pintar las 5 pantallas)
router.get('/:id', (req, res) => {
  const pack = getOwnedPack(req.params.id, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });
  res.json(fullPack(pack.id));
});

function touchPack(packId) {
  db.prepare("UPDATE price_packs SET updated_at = datetime('now') WHERE id = ?").run(packId);
}

// Guardar tramos de % de ganancia por precio
router.put('/:id/profit-tiers', (req, res) => {
  const pack = getOwnedPack(req.params.id, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });

  const tiers = req.body.tiers;
  if (!Array.isArray(tiers)) return res.status(400).json({ error: 'tiers debe ser un arreglo.' });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM profit_tiers WHERE pack_id = ?').run(pack.id);
    const insert = db.prepare(
      'INSERT INTO profit_tiers (pack_id, precio_inicial, precio_limite, porcentaje, posicion) VALUES (?, ?, ?, ?, ?)'
    );
    tiers.forEach((t, i) =>
      insert.run(pack.id, t.precio_inicial, t.precio_limite, t.porcentaje, i)
    );
    touchPack(pack.id);
  });
  tx();

  res.json(fullPack(pack.id).profit_tiers);
});

// Guardar una logística: seguro + tarifa por libra (1..110)
// body: { seguro_porcentaje, seguro_minimo_usd, rates: [{libras, total_usd}] }
router.put('/:id/logistics/:logistica', (req, res) => {
  const pack = getOwnedPack(req.params.id, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });

  const { logistica } = req.params;
  if (!LOGISTICAS[logistica]) return res.status(400).json({ error: 'Logística no válida.' });

  const { seguro_porcentaje, seguro_minimo_usd, rates } = req.body;
  const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!num(seguro_porcentaje) || !num(seguro_minimo_usd)) {
    return res.status(400).json({ error: 'El seguro debe ser un número mayor o igual a 0.' });
  }
  if (!Array.isArray(rates) || rates.length > MAX_LIBRAS) {
    return res.status(400).json({ error: `rates debe ser un arreglo de hasta ${MAX_LIBRAS} filas.` });
  }
  const vistas = new Set();
  for (const r of rates) {
    if (!Number.isInteger(r.libras) || r.libras < 1 || r.libras > MAX_LIBRAS || vistas.has(r.libras)) {
      return res.status(400).json({ error: `Las libras deben ser enteros únicos entre 1 y ${MAX_LIBRAS}.` });
    }
    if (!num(r.total_usd)) return res.status(400).json({ error: 'Cada total debe ser un número mayor o igual a 0.' });
    vistas.add(r.libras);
  }

  db.transaction(() => {
    db.prepare(
      `INSERT INTO logistics_settings (pack_id, logistica, seguro_porcentaje, seguro_minimo_usd) VALUES (?, ?, ?, ?)
       ON CONFLICT(pack_id, logistica) DO UPDATE SET seguro_porcentaje = excluded.seguro_porcentaje, seguro_minimo_usd = excluded.seguro_minimo_usd`
    ).run(pack.id, logistica, seguro_porcentaje, seguro_minimo_usd);
    const upd = db.prepare(
      `INSERT INTO logistics_rates (pack_id, logistica, libras, total_usd) VALUES (?, ?, ?, ?)
       ON CONFLICT(pack_id, logistica, libras) DO UPDATE SET total_usd = excluded.total_usd`
    );
    rates.forEach((r) => upd.run(pack.id, logistica, r.libras, r.total_usd));
    touchPack(pack.id);
  })();

  res.json(fullPack(pack.id).logistics[logistica]);
});

// Guardar tramos de impuestos nacionales por precio
router.put('/:id/tax-tiers', (req, res) => {
  const pack = getOwnedPack(req.params.id, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });

  const tiers = req.body.tiers;
  if (!Array.isArray(tiers)) return res.status(400).json({ error: 'tiers debe ser un arreglo.' });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM tax_tiers WHERE pack_id = ?').run(pack.id);
    const insert = db.prepare(
      'INSERT INTO tax_tiers (pack_id, precio_inicial, precio_limite, porcentaje, posicion) VALUES (?, ?, ?, ?, ?)'
    );
    tiers.forEach((t, i) => insert.run(pack.id, t.precio_inicial, t.precio_limite, t.porcentaje, i));
    touchPack(pack.id);
  });
  tx();

  res.json(fullPack(pack.id).tax_tiers);
});

// Guardar cobros extras (pares nombre/valor)
router.put('/:id/extra-charges', (req, res) => {
  const pack = getOwnedPack(req.params.id, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });

  const charges = req.body.charges;
  if (!Array.isArray(charges)) return res.status(400).json({ error: 'charges debe ser un arreglo.' });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM extra_charges WHERE pack_id = ?').run(pack.id);
    const insert = db.prepare(
      'INSERT INTO extra_charges (pack_id, nombre, valor, posicion) VALUES (?, ?, ?, ?)'
    );
    charges.forEach((c, i) => insert.run(pack.id, c.nombre, c.valor, i));
    touchPack(pack.id);
  });
  tx();

  res.json(fullPack(pack.id).extra_charges);
});

module.exports = router;
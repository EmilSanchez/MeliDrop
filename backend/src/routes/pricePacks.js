const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createDefaultPack } = require('./pricePacks.helpers');

const router = express.Router();
router.use(requireAuth);

// Confirma que el pack pedido es del usuario autenticado (nadie ve ni edita packs ajenos)
function getOwnedPack(packId, userId) {
  return db
    .prepare('SELECT * FROM price_packs WHERE id = ? AND user_id = ?')
    .get(packId, userId);
}

function fullPack(packId) {
  const pack = db.prepare('SELECT * FROM price_packs WHERE id = ?').get(packId);
  if (!pack) return null;
  return {
    ...pack,
    profit_tiers: db
      .prepare('SELECT * FROM profit_tiers WHERE pack_id = ? ORDER BY posicion')
      .all(packId),
    shipping_tiers_mercado_envios: db
      .prepare(
        "SELECT * FROM shipping_tiers WHERE pack_id = ? AND variante = 'mercado_envios' ORDER BY posicion"
      )
      .all(packId),
    shipping_tiers_custom: db
      .prepare(
        "SELECT * FROM shipping_tiers WHERE pack_id = ? AND variante = 'custom' ORDER BY posicion"
      )
      .all(packId),
    tax_tiers: db
      .prepare('SELECT * FROM tax_tiers WHERE pack_id = ? ORDER BY posicion')
      .all(packId),
    extra_charges: db
      .prepare('SELECT * FROM extra_charges WHERE pack_id = ? ORDER BY posicion')
      .all(packId),
  };
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

// Guardar tramos de envío (variante = mercado_envios | custom)
router.put('/:id/shipping-tiers', (req, res) => {
  const pack = getOwnedPack(req.params.id, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });

  const { variante, tiers } = req.body;
  if (!['mercado_envios', 'custom'].includes(variante)) {
    return res.status(400).json({ error: "variante debe ser 'mercado_envios' o 'custom'." });
  }
  if (!Array.isArray(tiers)) return res.status(400).json({ error: 'tiers debe ser un arreglo.' });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM shipping_tiers WHERE pack_id = ? AND variante = ?').run(pack.id, variante);
    const insert = db.prepare(
      'INSERT INTO shipping_tiers (pack_id, variante, peso_inicial, peso_limite, precio_usd, posicion) VALUES (?, ?, ?, ?, ?, ?)'
    );
    tiers.forEach((t, i) =>
      insert.run(pack.id, variante, t.peso_inicial, t.peso_limite, t.precio_usd, i)
    );
    touchPack(pack.id);
  });
  tx();

  res.json(
    db
      .prepare('SELECT * FROM shipping_tiers WHERE pack_id = ? AND variante = ? ORDER BY posicion')
      .all(pack.id, variante)
  );
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
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { calcularPrecioPorCosto } = require('../pricing/calcular');

const router = express.Router();
router.use(requireAuth);

function fullPack(packId) {
  const pack = db.prepare('SELECT * FROM price_packs WHERE id = ?').get(packId);
  if (!pack) return null;
  return {
    ...pack,
    profit_tiers: db.prepare('SELECT * FROM profit_tiers WHERE pack_id = ? ORDER BY posicion').all(packId),
    shipping_tiers_mercado_envios: db
      .prepare("SELECT * FROM shipping_tiers WHERE pack_id = ? AND variante = 'mercado_envios' ORDER BY posicion")
      .all(packId),
    shipping_tiers_custom: db
      .prepare("SELECT * FROM shipping_tiers WHERE pack_id = ? AND variante = 'custom' ORDER BY posicion")
      .all(packId),
    tax_tiers: db.prepare('SELECT * FROM tax_tiers WHERE pack_id = ? ORDER BY posicion').all(packId),
    extra_charges: db.prepare('SELECT * FROM extra_charges WHERE pack_id = ? ORDER BY posicion').all(packId),
  };
}

// POST /api/calcular-precio
// body: { packId, costoUsd, pesoLbs, envioVariante }
// (Más adelante, cuando el scraping de Amazon esté listo, costoUsd/pesoLbs
// vendrán de ahí en vez de escribirse a mano.)
router.post('/', (req, res) => {
  const { packId, costoUsd, pesoLbs, envioVariante } = req.body;

  if (!packId || costoUsd == null || pesoLbs == null) {
    return res.status(400).json({ error: 'packId, costoUsd y pesoLbs son obligatorios.' });
  }

  const pack = db.prepare('SELECT * FROM price_packs WHERE id = ? AND user_id = ?').get(packId, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });

  try {
    const resultado = calcularPrecioPorCosto(fullPack(pack.id), { costoUsd, pesoLbs, envioVariante });
    res.json(resultado);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

module.exports = router;

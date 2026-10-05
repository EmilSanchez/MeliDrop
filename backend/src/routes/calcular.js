const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { calcularPrecio } = require('../pricing/calcular');
const { fullPack } = require('./pricePacks.helpers');
const { getTrm } = require('../pricing/trm');
const { getProducto } = require('../amazon');

const router = express.Router();
router.use(requireAuth);

// POST /api/calcular-precio
// body: { packId, costoUsd, pesoLbs }
// Devuelve un resultado por logística (Aguachica y Servientrega).
router.post('/', async (req, res) => {
  const { packId, costoUsd, pesoLbs } = req.body;

  if (!packId || !Number.isFinite(costoUsd) || !Number.isFinite(pesoLbs) || costoUsd < 0 || pesoLbs < 0) {
    return res.status(400).json({ error: 'packId, costoUsd y pesoLbs son obligatorios (números válidos).' });
  }

  const pack = db.prepare('SELECT * FROM price_packs WHERE id = ? AND user_id = ?').get(packId, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });

  try {
    const completo = fullPack(pack.id);
    const respaldo = (completo.extra_charges.find((c) => c.nombre === 'Dolar de respaldo COP') || {}).valor || 0;
    const trm = await getTrm(respaldo);
    if (!(trm.valor > 0)) {
      return res.status(422).json({ error: 'No se pudo obtener el dólar. Configura "Dolar de respaldo COP" en Cobros Extras.' });
    }
    res.json(calcularPrecio(completo, { costoUsd, pesoLbs }, trm));
  } catch (err) {
    res.status(422).json({ error: err.message, code: err.code, maxLibras: err.maxLibras, pesoLbs: err.pesoLbs });
  }
});

// POST /api/calcular-precio/sku
// body: { packId, asin }  -> trae costo y peso de Amazon y calcula
router.post('/sku', async (req, res) => {
  const { packId } = req.body;
  const asin = String(req.body.asin || '').trim().toUpperCase();

  if (!packId || !/^[A-Z0-9]{6,20}$/.test(asin)) {
    return res.status(400).json({ error: 'packId y un SKU/ASIN válido son obligatorios.' });
  }
  const pack = db.prepare('SELECT * FROM price_packs WHERE id = ? AND user_id = ?').get(packId, req.userId);
  if (!pack) return res.status(404).json({ error: 'Pack no encontrado.' });

  try {
    const producto = await getProducto(asin);
    if (!(producto.costoUsd > 0)) {
      return res.status(422).json({
        code: 'SIN_PRECIO',
        error: 'Este producto no tiene un precio disponible en Amazon ahora mismo (puede estar agotado).',
        producto,
      });
    }
    if (!(producto.pesoLbs > 0)) {
      return res.status(422).json({
        code: 'SIN_PESO',
        error: 'Amazon no informa el peso de este producto, por eso no se puede calcular el envío.',
        producto,
      });
    }

    const completo = fullPack(pack.id);
    const respaldo = (completo.extra_charges.find((c) => c.nombre === 'Dolar de respaldo COP') || {}).valor || 0;
    const trm = await getTrm(respaldo);
    if (!(trm.valor > 0)) {
      return res.status(422).json({ error: 'No se pudo obtener el dólar. Configura "Dolar de respaldo COP" en Cobros Extras.' });
    }
    res.json({
      ...calcularPrecio(completo, { costoUsd: producto.costoUsd, pesoLbs: producto.pesoLbs }, trm),
      producto,
    });
  } catch (err) {
    res.status(422).json({ error: err.message, code: err.code, maxLibras: err.maxLibras, pesoLbs: err.pesoLbs });
  }
});

module.exports = router;
// Encuentra el tramo que le corresponde a `valor`: el primero (ordenados por
// inicio) cuyo límite alcanza el valor. Así los decimales que caen entre dos
// tramos enteros (ej. 5.99 entre "0-5" y "6-10", o 1.5 lbs entre "0-1" y "2-15")
// pasan al tramo siguiente en vez de quedar sin tramo.
function buscarTramo(tiers, valor, campoInicial, campoLimite) {
  const ordenados = [...tiers].sort((a, b) => a[campoInicial] - b[campoInicial]);
  return ordenados.find((t) => valor <= t[campoLimite]) || null;
}

const redondear2 = (n) => Math.round(n * 100) / 100;

/**
 * Calcula el precio de venta a partir de un pack de configuración completo
 * (el que devuelve GET /api/price-packs/:id) y los datos del producto.
 *
 * @param {object} pack - resultado de fullPack(): incluye profit_tiers, tax_tiers,
 *                         shipping_tiers_mercado_envios / _custom, extra_charges
 * @param {object} producto - { costoUsd, pesoLbs, envioVariante: 'mercado_envios'|'custom' }
 */
function calcularPrecioPorCosto(pack, producto) {
  const { costoUsd, pesoLbs, envioVariante = 'mercado_envios' } = producto;

  const tramoGanancia = buscarTramo(pack.profit_tiers, costoUsd, 'precio_inicial', 'precio_limite');
  if (!tramoGanancia) {
    throw new Error(`No hay tramo de ganancia configurado para el precio ${costoUsd} USD.`);
  }

  // El envío se cobra por libra: la tabla da la tarifa por libra según el rango
  // de peso, y se multiplica por las libras facturadas (peso redondeado hacia
  // arriba, mínimo 1 lb).
  const pesoFacturadoLbs = Math.max(1, Math.ceil(pesoLbs));
  const shippingTiers =
    envioVariante === 'custom' ? pack.shipping_tiers_custom : pack.shipping_tiers_mercado_envios;
  const tramoEnvio = buscarTramo(shippingTiers, pesoFacturadoLbs, 'peso_inicial', 'peso_limite');
  if (!tramoEnvio) {
    throw new Error(`No hay tramo de envío configurado para el peso ${pesoLbs} lbs.`);
  }
  const envioTotalUsd = redondear2(tramoEnvio.precio_usd * pesoFacturadoLbs);

  const extras = Object.fromEntries(pack.extra_charges.map((c) => [c.nombre, c.valor]));
  const impuestoAmazonPct = extras['Impuesto Amazon %'] || 0;
  const impuestoVentaPct = extras['Impuesto Venta %'] || 0;
  const comisionPubPct = extras['Comision tipo de pub. %'] || 0;

  // Costo base + envío + lo que Amazon cobra sobre el costo
  const costoConImpuestoAmazon = costoUsd * (1 + impuestoAmazonPct / 100);
  const costoTotal = costoConImpuestoAmazon + envioTotalUsd;

  // Margen de ganancia sobre el costo total
  const conGanancia = costoTotal * (1 + tramoGanancia.porcentaje / 100);

  // Tramo de impuesto nacional se evalúa sobre el precio ya con ganancia
  const tramoImpuesto = buscarTramo(pack.tax_tiers, conGanancia, 'precio_inicial', 'precio_limite');
  const impuestoNacionalPct = tramoImpuesto ? tramoImpuesto.porcentaje : 0;

  const conImpuestoNacional = conGanancia * (1 + impuestoNacionalPct / 100);

  // Comisión de Mercado Libre y % de impuesto de venta, al final
  const precioFinal = conImpuestoNacional * (1 + comisionPubPct / 100) * (1 + impuestoVentaPct / 100);

  return {
    costoUsd,
    pesoLbs,
    envioVariante,
    tramoGananciaPct: tramoGanancia.porcentaje,
    pesoFacturadoLbs,
    envioPorLibraUsd: tramoEnvio.precio_usd,
    envioUsd: envioTotalUsd, // total del envío (tarifa por libra x libras facturadas)
    impuestoAmazonPct,
    impuestoNacionalPct,
    comisionPubPct,
    impuestoVentaPct,
    precioFinalUsd: Math.round(precioFinal * 100) / 100,
  };
}

module.exports = { calcularPrecioPorCosto, buscarTramo };

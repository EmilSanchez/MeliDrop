const { LOGISTICAS, MAX_LIBRAS } = require('./logisticas');

// Primer tramo (ordenado por inicio) cuyo límite alcanza el valor; así los
// decimales entre dos tramos enteros (5.99 entre "0-5" y "6-10") pasan al siguiente.
function buscarTramo(tiers, valor, campoInicial, campoLimite) {
  const ordenados = [...tiers].sort((a, b) => a[campoInicial] - b[campoInicial]);
  return ordenados.find((t) => valor <= t[campoLimite]) || null;
}

const redondear2 = (n) => Math.round(n * 100) / 100;

// Sube al siguiente precio terminado en 990 (807.857 -> 807.990; 807.991 -> 808.990)
const redondear990 = (n) => Math.ceil((n + 10) / 1000) * 1000 - 10;

class PesoExcedidoError extends Error {
  constructor(pesoLbs) {
    super(
      pesoLbs > MAX_LIBRAS
        ? `El producto pesa ${pesoLbs} lb y el máximo que se puede importar es ${MAX_LIBRAS} lb.`
        : `El producto pesa ${pesoLbs} lb; con la libra extra de empaque supera el máximo de ${MAX_LIBRAS} lb que se puede importar.`
    );
    this.code = 'PESO_EXCEDIDO';
    this.pesoLbs = pesoLbs;
    this.maxLibras = MAX_LIBRAS;
  }
}

/**
 * Calcula el precio de venta en COP por cada logística (Aguachica y Servientrega).
 * @param {object} pack - resultado de fullPack()
 * @param {object} producto - { costoUsd, pesoLbs }
 * @param {object} trm - { valor, fuente, fecha }  (dólar en COP)
 */
function calcularPrecio(pack, producto, trm) {
  const { costoUsd, pesoLbs } = producto;

  // Peso que se cobra: el peso redondeado hacia arriba + 1 libra de empaque
  // (0.96 lb -> 2 lb; 33 lb -> 34 lb)
  const pesoFacturadoLbs = Math.ceil(pesoLbs) + 1;
  if (pesoFacturadoLbs > MAX_LIBRAS) throw new PesoExcedidoError(pesoLbs);

  const tramoGanancia = buscarTramo(pack.profit_tiers, costoUsd, 'precio_inicial', 'precio_limite');
  if (!tramoGanancia) {
    throw new Error(`No hay tramo de ganancia configurado para el precio ${costoUsd} USD.`);
  }

  const extras = Object.fromEntries(pack.extra_charges.map((c) => [c.nombre, c.valor]));
  const impuestoAmazonPct = extras['Impuesto Amazon %'] || 0;
  const impuestoVentaPct = extras['Impuesto Venta %'] || 0;
  const comisionPubPct = extras['Comision tipo de pub. %'] || 0;
  const reputacionCop = extras['Costo Reputacion COP'] || 0;
  const margenDolar = extras['Margen sobre el dolar COP'] || 0;
  // Dólar con el que se calcula = TRM del día + margen fijo (ej: 3209 + 100 = 3309)
  const dolarAplicado = trm.valor + margenDolar;
  const diasStock = extras['Dias de disponibilidad en stock'] || 0;

  // Compra en Amazon (igual para todas las logísticas)
  const impuestoAmazonUsd = redondear2(costoUsd * (impuestoAmazonPct / 100));
  const totalCompraUsd = redondear2(costoUsd + impuestoAmazonUsd);
  const gananciaUsd = redondear2(totalCompraUsd * (tramoGanancia.porcentaje / 100));

  // Impuesto de importación: se calcula sobre el costo del producto en Amazon
  // (sin impuesto de Amazon ni ganancia), tanto para elegir el tramo como para el valor.
  const tramoImpuesto = buscarTramo(pack.tax_tiers, costoUsd, 'precio_inicial', 'precio_limite');
  const importacionPct = tramoImpuesto ? tramoImpuesto.porcentaje : 0;
  const importacionUsd = redondear2(costoUsd * (importacionPct / 100));

  const resultados = Object.keys(LOGISTICAS).map((lg) => {
    const cfg = pack.logistics[lg];
    const base = { logistica: lg, nombre: LOGISTICAS[lg].nombre };
    const fila = cfg.rates.find((r) => r.libras === pesoFacturadoLbs);
    if (!fila || !(fila.total_usd > 0)) {
      return { ...base, estado: 'SIN_TARIFA', mensaje: 'Falta configurar la tarifa de esta logística.' };
    }

    const envioUsd = fila.total_usd;
    // Seguro sobre el valor declarado (= costo en Amazon), con mínimo
    const seguroUsd =
      cfg.seguro_porcentaje > 0 || cfg.seguro_minimo_usd > 0
        ? redondear2(Math.max((costoUsd * cfg.seguro_porcentaje) / 100, cfg.seguro_minimo_usd))
        : 0;

    const subtotalUsd = redondear2(totalCompraUsd + gananciaUsd + importacionUsd + envioUsd + seguroUsd);
    const totalCop = redondear2(subtotalUsd * dolarAplicado);

    // Mercado Libre: la comisión es un % del precio de venta (se suma "hacia arriba"),
    // y el impuesto de venta se calcula sobre lo que queda antes de ese impuesto.
    const baseCop = totalCop + reputacionCop;
    const antesImpVenta = comisionPubPct < 100 ? baseCop / (1 - comisionPubPct / 100) : baseCop;
    const comisionCop = redondear2(antesImpVenta - baseCop);
    const impuestoVentaCop = redondear2(antesImpVenta * (impuestoVentaPct / 100));
    const precioSinRedondearCop = antesImpVenta + impuestoVentaCop;

    return {
      ...base,
      estado: 'OK',
      // El seguro va incluido en el valor del envío (no se muestra aparte)
      envioUsd: redondear2(envioUsd + seguroUsd),
      envioTarifaUsd: envioUsd,
      seguroUsd,
      subtotalUsd,
      totalCop,
      reputacionCop,
      comisionCop,
      impuestoVentaCop,
      precioSinRedondearCop: redondear2(precioSinRedondearCop),
      precioFinalCop: redondear990(precioSinRedondearCop),
    };
  });

  const validos = resultados.filter((r) => r.estado === 'OK');
  const masEconomica = validos.length
    ? validos.reduce((a, b) => (b.precioFinalCop < a.precioFinalCop ? b : a)).logistica
    : null;

  return {
    costoUsd,
    pesoLbs,
    pesoFacturadoLbs,
    diasStock,
    compra: { impuestoAmazonPct, impuestoAmazonUsd, totalCompraUsd },
    ganancia: { porcentaje: tramoGanancia.porcentaje, usd: gananciaUsd },
    importacion: { porcentaje: importacionPct, usd: importacionUsd },
    trm: { ...trm, margen: margenDolar, aplicado: dolarAplicado },
    comisionPubPct,
    impuestoVentaPct,
    resultados,
    masEconomica,
  };
}

module.exports = { calcularPrecio, buscarTramo, redondear990, PesoExcedidoError };
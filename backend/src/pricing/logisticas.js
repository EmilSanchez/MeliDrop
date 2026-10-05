const { MAX_LIBRAS, SEGURO_PORCENTAJE, SEGURO_MINIMO_USD, TOTAL_USD } = require('./tarifaServientrega');

const LOGISTICAS = {
  aguachica: { id: 'aguachica', nombre: 'Aguachica (Logística de CENTRIS)' },
  servientrega: { id: 'servientrega', nombre: 'Servientrega (Logística de GLOBAL BOX - GBX)' },
};

// Valores iniciales de cada logística al crear un pack.
// Aguachica arranca sin valores (en 0) hasta que el usuario los configure.
const DEFAULTS = {
  aguachica: { seguro_porcentaje: 0, seguro_minimo_usd: 0, totales: Array(MAX_LIBRAS).fill(0) },
  servientrega: {
    seguro_porcentaje: SEGURO_PORCENTAJE,
    seguro_minimo_usd: SEGURO_MINIMO_USD,
    totales: TOTAL_USD,
  },
};

module.exports = { LOGISTICAS, DEFAULTS, MAX_LIBRAS };
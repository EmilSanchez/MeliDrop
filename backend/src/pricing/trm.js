// TRM oficial de Colombia (datos abiertos, Superfinanciera) con caché de 6 horas.
// Si no hay internet o falla, se usa el "Dolar de respaldo COP" del pack.
const URL =
  'https://www.datos.gov.co/resource/32sa-8pi3.json?$select=valor,vigenciadesde&$order=vigenciadesde%20DESC&$limit=1';
const TTL_MS = 6 * 60 * 60 * 1000;

let cache = null; // { valor, fecha, at }

async function getTrm(respaldo) {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { valor: cache.valor, fuente: 'TRM oficial', fecha: cache.fecha };
  }
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const [row] = await res.json();
    const valor = Number(row && row.valor);
    if (!(valor > 0)) throw new Error('TRM inválida');
    cache = { valor, fecha: String(row.vigenciadesde).slice(0, 10), at: Date.now() };
    return { valor, fuente: 'TRM oficial', fecha: cache.fecha };
  } catch (_) {
    // Si ya había una TRM guardada (aunque vieja), es mejor que el respaldo manual
    if (cache) return { valor: cache.valor, fuente: 'TRM oficial (última guardada)', fecha: cache.fecha };
    return { valor: respaldo, fuente: 'Dólar de respaldo (sin conexión a la TRM)', fecha: null };
  }
}

module.exports = { getTrm };
// Datos de producto de Amazon.com (precio, peso, título, foto) vía Keepa.
// Requiere KEEPA_API_KEY en backend/.env
const GRAMOS_POR_LIBRA = 453.592;
const TTL_MS = 10 * 60 * 1000; // caché de 10 min: no gasta tokens si repites el mismo ASIN
const cache = new Map();

class AmazonError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

// Keepa guarda los precios en centavos; -1 = no disponible
const centavos = (v) => (typeof v === 'number' && v > 0 ? v / 100 : null);

function interpretar(asin, p) {
  const cur = (p.stats && p.stats.current) || [];
  // 18 = Buy Box nuevo, 0 = vendido por Amazon, 1 = nuevo de terceros
  const costoUsd = centavos(cur[18]) ?? centavos(cur[0]) ?? centavos(cur[1]);

  const gramos = p.packageWeight > 0 ? p.packageWeight : p.itemWeight > 0 ? p.itemWeight : null;
  const pesoLbs = gramos ? Math.round((gramos / GRAMOS_POR_LIBRA) * 100) / 100 : null;

  const img = p.imagesCSV ? p.imagesCSV.split(',')[0] : null;
  return {
    asin,
    titulo: p.title || null,
    imagen: img ? `https://m.media-amazon.com/images/I/${img}` : null,
    costoUsd,
    pesoLbs,
  };
}

async function getProducto(asin) {
  const key = process.env.KEEPA_API_KEY;
  if (!key) {
    throw new AmazonError(
      'SIN_CLAVE',
      'Falta conectar Amazon: agrega KEEPA_API_KEY en el archivo backend/.env y reinicia el backend.'
    );
  }

  const hit = cache.get(asin);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  let res;
  try {
    const base = process.env.KEEPA_BASE_URL || 'https://api.keepa.com';
    const url = `${base}/product?key=${encodeURIComponent(key)}&domain=1&asin=${encodeURIComponent(asin)}&stats=1`;
    res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (_) {
    throw new AmazonError('KEEPA_ERROR', 'No se pudo consultar Amazon (sin conexión con Keepa). Intenta de nuevo.');
  }

  let body = null;
  try {
    body = await res.json();
  } catch (_) {}

  if (!res.ok || !body || body.error) {
    const detalle = body && body.error && (body.error.message || body.error.details);
    if (res.status === 402 || res.status === 429 || (body && body.tokensLeft < 0)) {
      throw new AmazonError('KEEPA_SIN_TOKENS', 'Keepa se quedó sin consultas por ahora. Espera unos minutos o revisa tu plan.');
    }
    if (res.status === 401 || res.status === 403) {
      throw new AmazonError('KEEPA_CLAVE_INVALIDA', 'La clave de Keepa no es válida. Revisa KEEPA_API_KEY en backend/.env.');
    }
    throw new AmazonError('KEEPA_ERROR', `Keepa respondió con un error${detalle ? ': ' + detalle : ` (${res.status})`}.`);
  }

  const p = body.products && body.products[0];
  if (!p) throw new AmazonError('NO_ENCONTRADO', `No se encontró el producto ${asin} en Amazon.com.`);

  const data = interpretar(asin, p);
  cache.set(asin, { at: Date.now(), data });
  return data;
}

module.exports = { getProducto, interpretar, AmazonError };
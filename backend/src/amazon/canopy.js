// Datos de producto de Amazon.com vía Canopy API (https://www.canopyapi.co).
// Requiere CANOPY_API_KEY en backend/.env
const { AmazonError } = require('./keepa');

const TTL_MS = 10 * 60 * 1000; // caché de 10 min: repetir un ASIN no gasta otra consulta
const cache = new Map();

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Acepta número, "154.99", "$154.99" o { value, ... }
function leerPrecio(price) {
  if (price == null) return null;
  if (typeof price === 'object') {
    return num(price.value) ?? num(price.amount) ?? leerPrecio(price.display);
  }
  if (typeof price === 'number') return price > 0 ? price : null;
  const n = parseFloat(String(price).replace(/[^0-9.]/g, ''));
  return n > 0 ? n : null;
}

const A_LIBRAS = { lb: 1, lbs: 1, pound: 1, pounds: 1, oz: 1 / 16, ounce: 1 / 16, ounces: 1 / 16, g: 1 / 453.592, gram: 1 / 453.592, grams: 1 / 453.592, kg: 2.20462, kilogram: 2.20462, kilograms: 2.20462 };

// Acepta "2.5 pounds", "16 ounces", { value: 2, unit: "pounds" } o un número (se asume libras)
function leerPesoLbs(w) {
  if (w == null) return null;
  let valor;
  let unidad = 'lb';
  if (typeof w === 'number') valor = w;
  else if (typeof w === 'object') {
    valor = num(w.value) ?? parseFloat(w.value);
    unidad = String(w.unit || w.unidad || 'lb').toLowerCase();
  } else {
    const m = String(w).toLowerCase().match(/([0-9]+(?:[.,][0-9]+)?)\s*([a-z]+)?/);
    if (!m) return null;
    valor = parseFloat(m[1].replace(',', '.'));
    unidad = m[2] || 'lb';
  }
  const factor = A_LIBRAS[unidad.replace(/\.$/, '')];
  if (!(valor > 0) || !factor) return null;
  return Math.round(valor * factor * 100) / 100;
}

// El peso puede venir en distintos lugares según el producto. Se busca:
//  1) campos llamados weight / itemWeight / shippingWeight (en cualquier nivel)
//  2) listas de especificaciones tipo [{ name: "Item Weight", value: "15.29 ounces" }]
//  3) tablas tipo { "Item Weight": "15.29 ounces" }
const ES_CLAVE_PESO = /(^|[\s_-])(item\s*)?weight|peso|shipping\s*weight/i;
const NO_ES_PESO = /capacity|unit|limit|count|max|recomm/i;

function buscarPeso(obj, nivel = 0) {
  if (obj == null || nivel > 6) return null;
  if (Array.isArray(obj)) {
    for (const it of obj) {
      if (it && typeof it === 'object' && !Array.isArray(it)) {
        const nombre = it.name || it.key || it.label || it.title || it.attribute;
        if (typeof nombre === 'string' && ES_CLAVE_PESO.test(nombre) && !NO_ES_PESO.test(nombre)) {
          const w = leerPesoLbs(it.value ?? it.text ?? it.data);
          if (w) return w;
        }
      }
      const r = buscarPeso(it, nivel + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (ES_CLAVE_PESO.test(k) && !NO_ES_PESO.test(k)) {
        const w = leerPesoLbs(v);
        if (w) return w;
      }
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') {
        const r = buscarPeso(v, nivel + 1);
        if (r) return r;
      }
    }
  }
  return null;
}

function interpretar(asin, body) {
  const p =
    (body && body.data && body.data.amazonProduct) ||
    (body && body.amazonProduct) ||
    (body && body.data) ||
    body ||
    {};
  return {
    asin,
    titulo: p.title || null,
    imagen: p.mainImageUrl || (Array.isArray(p.imageUrls) && p.imageUrls[0]) || null,
    costoUsd: leerPrecio(p.price),
    pesoLbs: leerPesoLbs(p.weight) ?? leerPesoLbs(p.itemWeight) ?? leerPesoLbs(p.shippingWeight) ?? buscarPeso(p),
    _existe: Boolean(p.title || p.price || p.asin),
  };
}

async function getProducto(asin) {
  const key = process.env.CANOPY_API_KEY;
  if (!key) {
    throw new AmazonError(
      'SIN_CLAVE',
      'Falta conectar Amazon: agrega CANOPY_API_KEY en el archivo backend/.env y reinicia el backend.'
    );
  }

  const hit = cache.get(asin);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const base = process.env.CANOPY_BASE_URL || 'https://rest.canopyapi.co';
  let res;
  try {
    res = await fetch(`${base}/api/amazon/product?asin=${encodeURIComponent(asin)}&domain=US`, {
      headers: { 'API-KEY': key, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
  } catch (_) {
    throw new AmazonError('KEEPA_ERROR', 'No se pudo consultar Amazon (sin conexión con Canopy). Intenta de nuevo.');
  }

  let body = null;
  try {
    body = await res.json();
  } catch (_) {}

  if (process.env.AMAZON_DEBUG) console.log('[canopy]', asin, res.status, JSON.stringify(body).slice(0, 4000));

  if (res.status === 401 || res.status === 403) {
    throw new AmazonError('KEEPA_CLAVE_INVALIDA', 'La clave de Canopy no es válida. Revisa CANOPY_API_KEY en backend/.env.');
  }
  if (res.status === 402 || res.status === 429) {
    throw new AmazonError('KEEPA_SIN_TOKENS', 'Se acabaron las consultas gratis de Canopy de este mes (o vas muy rápido). Revisa tu plan.');
  }
  if (res.status === 404) throw new AmazonError('NO_ENCONTRADO', `No se encontró el producto ${asin} en Amazon.com.`);
  if (!res.ok || !body) throw new AmazonError('KEEPA_ERROR', `Canopy respondió con un error (${res.status}).`);
  if (body.errors && body.errors.length) {
    throw new AmazonError('KEEPA_ERROR', 'Canopy respondió con un error: ' + (body.errors[0].message || 'desconocido'));
  }

  const { _existe, ...data } = interpretar(asin, body);
  if (!_existe) throw new AmazonError('NO_ENCONTRADO', `No se encontró el producto ${asin} en Amazon.com.`);

  if (process.env.AMAZON_DEBUG && !data.pesoLbs) console.log('[canopy] SIN PESO para', asin, '- campos recibidos:', Object.keys((body.data && body.data.amazonProduct) || body.data || body));
  cache.set(asin, { at: Date.now(), data });
  return data;
}

module.exports = { getProducto, interpretar, leerPrecio, leerPesoLbs, buscarPeso };
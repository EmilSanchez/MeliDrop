// Elige el proveedor de datos de Amazon según backend/.env:
//   AMAZON_PROVIDER=canopy  (por defecto)  |  keepa
const proveedor = (process.env.AMAZON_PROVIDER || 'canopy').toLowerCase();

module.exports = proveedor === 'keepa' ? require('./keepa') : require('./canopy');
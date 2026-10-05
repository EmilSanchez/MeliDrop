// Migración: a los packs ya creados les agrega los cobros extras nuevos
// (Costo Reputacion COP, Margen sobre el dolar COP, Dolar de respaldo COP) y pasa la comisión de 12 a 14
// solo si todavía tiene el valor inicial de fábrica.
const NUEVOS = [
  { nombre: 'Costo Reputacion COP', valor: 10900 },
  { nombre: 'Margen sobre el dolar COP', valor: 100 },
  { nombre: 'Dolar de respaldo COP', valor: 3300 },
];

function migrateExtras(db) {
  const packs = db.prepare('SELECT id FROM price_packs').all();
  const tieneExtra = db.prepare('SELECT 1 FROM extra_charges WHERE pack_id = ? AND nombre = ?');
  const maxPos = db.prepare('SELECT COALESCE(MAX(posicion), -1) AS m FROM extra_charges WHERE pack_id = ?');
  const ins = db.prepare('INSERT INTO extra_charges (pack_id, nombre, valor, posicion) VALUES (?, ?, ?, ?)');
  const upd = db.prepare(
    "UPDATE extra_charges SET valor = 14 WHERE pack_id = ? AND nombre = 'Comision tipo de pub. %' AND valor = 12"
  );
  db.transaction(() => {
    for (const { id } of packs) {
      NUEVOS.forEach((n) => {
        if (!tieneExtra.get(id, n.nombre)) ins.run(id, n.nombre, n.valor, maxPos.get(id).m + 1);
      });
      upd.run(id);
    }
  })();
}

module.exports = { migrateExtras };
// =====================================================================
// MODELO DE GÉNEROS
// =====================================================================

const db = require('../config/db');

/**
 * Lista los géneros que tienen al menos una película en el catálogo,
 * ordenados por nombre. Se usa para el desplegable de filtros.
 * (El JOIN hace que no aparezcan géneros sin películas.)
 */
async function listar() {
  const [generos] = await db.query(
    `SELECT g.id, g.nombre, COUNT(*) AS peliculas
       FROM generos g
       JOIN peliculas_generos pg ON pg.genero_id = g.id
      GROUP BY g.id, g.nombre
      ORDER BY g.nombre`
  );
  return generos;
}

module.exports = { listar };
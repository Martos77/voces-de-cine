// =====================================================================
// MODELO DE ACTORES ORIGINALES
// =====================================================================

const db = require('../config/db');

/**
 * Ficha de un actor original: quién le ha doblado en España (y cuántas
 * veces) y sus películas en el catálogo, con la voz de cada una.
 * @param {number} id
 * @returns {object|null} null si no existe
 */
async function obtenerPorId(id) {
  // 1. Sus datos
  const [[actor]] = await db.query('SELECT * FROM actores_originales WHERE id = ?', [id]);
  if (!actor) return null;

  // 2. Sus voces en castellano y cuántas veces le ha doblado cada una
  const [voces] = await db.query(
    `SELECT ad.id, ad.nombre, COUNT(*) AS veces
       FROM personajes pe
       JOIN doblajes d          ON d.personaje_id = pe.id AND d.version = 'castellano'
       JOIN actores_doblaje ad  ON ad.id = d.actor_doblaje_id
      WHERE pe.actor_original_id = ?
      GROUP BY ad.id, ad.nombre
      ORDER BY veces DESC, ad.nombre`,
    [id]
  );

  // 3. Sus películas, con el personaje y la voz (si la conocemos).
  //    LEFT JOIN: la película aparece aunque no tenga voz registrada.
  const [peliculas] = await db.query(
    `SELECT p.id          AS pelicula_id,
            p.titulo,
            p.anio,
            p.poster_path,
            pe.nombre     AS personaje,
            ad.nombre     AS actor_doblaje
       FROM personajes pe
       JOIN peliculas p             ON p.id = pe.pelicula_id
       LEFT JOIN doblajes d         ON d.personaje_id = pe.id AND d.version = 'castellano'
       LEFT JOIN actores_doblaje ad ON ad.id = d.actor_doblaje_id
      WHERE pe.actor_original_id = ?
      ORDER BY p.anio DESC, p.titulo`,
    [id]
  );

  return { ...actor, voces, peliculas };
}

module.exports = { obtenerPorId };
// =====================================================================
// MODELO: PROFESIONALES DEL DOBLAJE FAVORITOS DE CADA USUARIO
// =====================================================================
// Tabla "usuarios_voces": una fila por cada voz favorita de un usuario.
// =====================================================================

const db = require('../config/db');

/**
 * ¿Tiene el usuario a este profesional del doblaje como favorito?
 */
async function esFavorita(usuarioId, actorDoblajeId) {
  const [filas] = await db.query(
    'SELECT 1 FROM usuarios_voces WHERE usuario_id = ? AND actor_doblaje_id = ?',
    [usuarioId, actorDoblajeId]
  );
  return filas.length > 0;
}

/**
 * Añade una voz a las favoritas. INSERT IGNORE: si ya lo era, no hace
 * nada (en lugar de dar error por la clave primaria repetida).
 */
async function anadir(usuarioId, actorDoblajeId) {
  await db.query(
    'INSERT IGNORE INTO usuarios_voces (usuario_id, actor_doblaje_id) VALUES (?, ?)',
    [usuarioId, actorDoblajeId]
  );
}

/**
 * Quita una voz de las favoritas.
 */
async function quitar(usuarioId, actorDoblajeId) {
  await db.query(
    'DELETE FROM usuarios_voces WHERE usuario_id = ? AND actor_doblaje_id = ?',
    [usuarioId, actorDoblajeId]
  );
}

/**
 * Voces favoritas de un usuario, con su número de películas en el
 * catálogo, de la añadida más recientemente a la más antigua.
 */
async function listar(usuarioId) {
  const [filas] = await db.query(
    `SELECT ad.id, ad.nombre, COUNT(DISTINCT pe.pelicula_id) AS num_peliculas
       FROM usuarios_voces uv
       JOIN actores_doblaje ad ON ad.id = uv.actor_doblaje_id
       LEFT JOIN doblajes d    ON d.actor_doblaje_id = ad.id
       LEFT JOIN personajes pe ON pe.id = d.personaje_id
      WHERE uv.usuario_id = ?
      GROUP BY ad.id, ad.nombre, uv.creado_en
      ORDER BY uv.creado_en DESC`,
    [usuarioId]
  );
  return filas;
}

module.exports = { esFavorita, anadir, quitar, listar };
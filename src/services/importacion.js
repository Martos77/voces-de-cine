// =====================================================================
// SERVICIO DE IMPORTACIÓN
// =====================================================================
// Contiene la lógica para guardar en la base de datos una película
// descargada de TMDB. La usan los dos scripts de importación:
//   - scripts/importar.js            → películas del CSV de doblajes
//   - scripts/importar-populares.js  → catálogo de películas populares
// Al tenerla en un solo sitio, si hay que cambiarla, se cambia una vez.
// =====================================================================

require('dotenv').config({ quiet: true });
const db = require('../config/db');
const tmdb = require('./tmdb');

// Cuántos actores del principio del reparto guardamos siempre.
// Además se guardan los que aparezcan en el CSV, estén donde estén.
const MAX_REPARTO = 15;

/**
 * Prepara un texto para compararlo: minúsculas y sin tildes.
 * Así "Óscar" y "oscar" se consideran iguales.
 */
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Descarga una película de TMDB y la guarda con sus géneros y su reparto.
 * Se hace en una TRANSACCIÓN: o se guarda todo o no se guarda nada, para
 * que no queden películas a medias si algo falla.
 *
 * @param {number} tmdbId - número de la película en TMDB
 * @param {Set<string>} [actoresCsv] - nombres (normalizados) de los
 *        actores originales del CSV, que se guardan aunque estén más
 *        abajo en el reparto. Si no se indica, solo los MAX_REPARTO primeros.
 * @returns {number} el id de la película en nuestra base de datos
 */
async function guardarPelicula(tmdbId, actoresCsv = new Set()) {
  const p = await tmdb.obtenerPelicula(tmdbId);

  // Pedimos una conexión del pool para hacer la transacción
  const con = await db.getConnection();

  try {
    await con.beginTransaction();

    // --- Película ---
    // ON DUPLICATE KEY UPDATE: si ya existe (mismo tmdb_id), actualiza sus datos
    await con.query(
      `INSERT INTO peliculas
         (tmdb_id, titulo, titulo_original, sinopsis, anio, duracion,
          valoracion, popularidad, director, poster_path, fondo_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         titulo = VALUES(titulo), titulo_original = VALUES(titulo_original),
         sinopsis = VALUES(sinopsis), anio = VALUES(anio), duracion = VALUES(duracion),
         valoracion = VALUES(valoracion), popularidad = VALUES(popularidad),
         director = VALUES(director), poster_path = VALUES(poster_path),
         fondo_path = VALUES(fondo_path)`,
      [p.tmdbId, p.titulo, p.tituloOriginal, p.sinopsis, p.anio, p.duracion,
       p.valoracion, p.popularidad, p.director, p.posterPath, p.fondoPath]
    );
    const [[{ id: peliculaId }]] = await con.query(
      'SELECT id FROM peliculas WHERE tmdb_id = ?', [tmdbId]
    );

    // --- Géneros ---
    // Borramos los enlaces antiguos (por si han cambiado) y los creamos de nuevo
    await con.query('DELETE FROM peliculas_generos WHERE pelicula_id = ?', [peliculaId]);
    for (const genero of p.generos) {
      await con.query(
        'INSERT INTO generos (id, nombre) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)',
        [genero.id, genero.nombre]
      );
      await con.query(
        'INSERT INTO peliculas_generos (pelicula_id, genero_id) VALUES (?, ?)',
        [peliculaId, genero.id]
      );
    }

    // --- Reparto original ---
    // Guardamos los MAX_REPARTO primeros y, además, los actores que
    // aparecen en el CSV aunque estén más abajo en el reparto.
    for (const [posicion, persona] of p.reparto.entries()) {
      const estaEnCsv = actoresCsv.has(normalizar(persona.nombre));
      if (posicion >= MAX_REPARTO && !estaEnCsv) continue; // este no lo necesitamos

      // Guardamos el actor (o actualizamos sus datos si ya existía)
      await con.query(
        `INSERT INTO actores_originales (tmdb_id, nombre, foto_path) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), foto_path = VALUES(foto_path)`,
        [persona.tmdbId, persona.nombre, persona.fotoPath]
      );
      const [[{ id: actorId }]] = await con.query(
        'SELECT id FROM actores_originales WHERE tmdb_id = ?', [persona.tmdbId]
      );

      // Creamos el personaje solo si no existía ya (por si se reimporta)
      const [[existente]] = await con.query(
        'SELECT id FROM personajes WHERE pelicula_id = ? AND actor_original_id = ?',
        [peliculaId, actorId]
      );
      if (!existente) {
        await con.query(
          'INSERT INTO personajes (pelicula_id, nombre, actor_original_id, orden) VALUES (?, ?, ?, ?)',
          [peliculaId, persona.personaje, actorId, persona.orden]
        );
      }
    }

    await con.commit(); // confirmamos todos los cambios
    console.log(`  Película guardada: ${p.titulo} (${p.anio || 'sin año'})`);
    return peliculaId;
  } catch (error) {
    await con.rollback(); // si algo ha fallado, deshacemos todo
    throw error;
  } finally {
    con.release(); // devolvemos la conexión al pool, pase lo que pase
  }
}

module.exports = { guardarPelicula, normalizar };
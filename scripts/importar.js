// =====================================================================
// SCRIPT: IMPORTAR DATOS        ·   npm run importar
// =====================================================================
// Carga en la base de datos los doblajes de data/doblajes.csv.
// Para cada película del CSV:
//   1. Si aún no está en la base de datos, descarga sus datos de TMDB
//      (título, sinopsis, géneros, reparto...) y los guarda.
//   2. Busca cada personaje del CSV en el reparto, le pone el nombre en
//      español y le asigna su actor o actriz de doblaje.
//
// Uso:
//   npm run importar                   → importa data/doblajes.csv
//   npm run importar -- --actualizar   → vuelve a descargar todo de TMDB
// =====================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('../src/config/db');
const { guardarPelicula, normalizar } = require('../src/services/importacion');

const RUTA_CSV = path.join(__dirname, '..', 'data', 'doblajes.csv');

// ---------------------------------------------------------------------
// 1. LEER Y VALIDAR EL CSV
// ---------------------------------------------------------------------

/**
 * Lee el CSV, comprueba cada fila y devuelve solo las correctas.
 * Por cada fila descartada muestra un aviso con su número de línea.
 */

function leerCsv(ruta) {
  const contenido = fs.readFileSync(ruta, 'utf8');

  // columns: true → cada fila se convierte en un objeto:
  // { tmdb_id: '857', personaje: 'Capitán...', actor_original: ..., actor_doblaje: ... }
  const filas = parse(contenido, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    comment: '#',
  });

  const validas = [];
  const yaVistas = new Set(); // para detectar filas repetidas

  filas.forEach((fila, i) => {
    const linea = i + 2; // +2 porque la línea 1 es la cabecera
    const tmdbId = Number(fila.tmdb_id);

    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return console.warn(`  [Línea ${linea}] tmdb_id no válido. Se descarta.`);
    }
    if (!fila.actor_original || !fila.actor_doblaje) {
      return console.warn(`  [Línea ${linea}] Falta el actor original o el de doblaje. Se descarta.`);
    }

    const clave = `${tmdbId}|${normalizar(fila.actor_original)}|${normalizar(fila.personaje)}`;
    if (yaVistas.has(clave)) {
      return console.warn(`  [Línea ${linea}] Fila repetida. Se ignora.`);
    }
    yaVistas.add(clave);

    validas.push({
      tmdbId,
      personaje: fila.personaje || null,
      actorOriginal: fila.actor_original,
      actorDoblaje: fila.actor_doblaje,
    });
  });

  return validas;
}

// ---------------------------------------------------------------------
// 2. ASIGNAR LOS DOBLAJES
// ---------------------------------------------------------------------

/**
 * Busca el personaje de la fila del CSV dentro de la película.
 * Se busca por el ACTOR ORIGINAL, porque el nombre del personaje en el
 * CSV está en español y en TMDB en inglés. Si ese actor hace varios
 * papeles en la película, se desempata por el nombre del personaje.
 * @returns {object|null} el personaje, o null si no se encuentra
 */
async function buscarPersonaje(peliculaId, fila) {
  const [personajes] = await db.query(
    `SELECT pe.id, pe.nombre, ao.nombre AS actor_original
       FROM personajes pe
       JOIN actores_originales ao ON ao.id = pe.actor_original_id
      WHERE pe.pelicula_id = ?`,
    [peliculaId]
  );

  const delActor = personajes.filter(
    (p) => normalizar(p.actor_original) === normalizar(fila.actorOriginal)
  );

  if (delActor.length === 1) return delActor[0];
  return delActor.find((p) => normalizar(p.nombre) === normalizar(fila.personaje)) || null;
}

/**
 * Pone al personaje su nombre en español y le asigna su voz.
 */
async function guardarDoblaje(personaje, fila) {
  // 1. Nombre del personaje en español (si viene en el CSV)
  if (fila.personaje) {
    await db.query('UPDATE personajes SET nombre = ? WHERE id = ?', [fila.personaje, personaje.id]);
  }

  // 2. Actor de doblaje: lo buscamos por nombre y, si no existe, lo creamos
  let [[actor]] = await db.query('SELECT id FROM actores_doblaje WHERE nombre = ?', [fila.actorDoblaje]);
  if (!actor) {
    const [resultado] = await db.query('INSERT INTO actores_doblaje (nombre) VALUES (?)', [fila.actorDoblaje]);
    actor = { id: resultado.insertId };
  }

  // 3. Doblaje: si el personaje ya tenía voz en castellano, se sustituye
  await db.query(
    `INSERT INTO doblajes (personaje_id, actor_doblaje_id, version) VALUES (?, ?, 'castellano')
     ON DUPLICATE KEY UPDATE actor_doblaje_id = VALUES(actor_doblaje_id)`,
    [personaje.id, actor.id]
  );
}

// ---------------------------------------------------------------------
// PROGRAMA PRINCIPAL
// ---------------------------------------------------------------------

async function main() {
  const actualizar = process.argv.includes('--actualizar');

  console.log('Leyendo el CSV...');
  const filas = leerCsv(RUTA_CSV);
  console.log(`${filas.length} filas correctas.\n`);

  // Agrupamos las filas por película: { 857 => [fila, fila], 13 => [fila] }
  const porPelicula = new Map();
  for (const fila of filas) {
    if (!porPelicula.has(fila.tmdbId)) porPelicula.set(fila.tmdbId, []);
    porPelicula.get(fila.tmdbId).push(fila);
  }

  let doblajesGuardados = 0;
  const avisos = [];

  for (const [tmdbId, filasPelicula] of porPelicula) {
    console.log(`Película TMDB ${tmdbId}`);
    try {
      // ¿Ya estaba en la base de datos? Si es así, no la volvemos a
      // descargar (salvo que se pida con --actualizar)
      const [[existente]] = await db.query('SELECT id, titulo FROM peliculas WHERE tmdb_id = ?', [tmdbId]);
      let peliculaId;
      if (existente && !actualizar) {
        peliculaId = existente.id;
        console.log(`  Ya estaba importada: ${existente.titulo}`);
      } else {
        // Nombres de los actores originales de esta película en el CSV
        const actoresCsv = new Set(filasPelicula.map((f) => normalizar(f.actorOriginal)));
        peliculaId = await guardarPelicula(tmdbId, actoresCsv);
      }

            for (const fila of filasPelicula) {
        const personaje = await buscarPersonaje(peliculaId, fila);
        if (!personaje) {
          const aviso = existente && !actualizar
            ? `  No se encuentra a "${fila.actorOriginal}" en TMDB ${tmdbId}. Si lo acabas de añadir al CSV, ejecuta: npm run importar -- --actualizar`
            : `  No se encuentra a "${fila.actorOriginal}" en el reparto de TMDB ${tmdbId}. Revisa cómo está escrito.`;
          console.warn(aviso);
          avisos.push(aviso);
          continue; // pasamos a la siguiente fila
        }
        await guardarDoblaje(personaje, fila);
        doblajesGuardados++;
      }
    } catch (error) {
      // Si una película falla, la anotamos y seguimos con las demás
      const aviso = `  Error en la película ${tmdbId}: ${error.message}`;
      console.error(aviso);
      avisos.push(aviso);
    }
  }

  console.log('\n--- Resumen ---');
  console.log(`Películas en el CSV:  ${porPelicula.size}`);
  console.log(`Doblajes guardados:   ${doblajesGuardados}`);
  console.log(`Avisos:               ${avisos.length}`);

  await db.end(); // cerramos las conexiones para que el script termine
}

main().catch(async (error) => {
  console.error('La importación se ha detenido:', error.message);
  await db.end();
  process.exit(1);
});
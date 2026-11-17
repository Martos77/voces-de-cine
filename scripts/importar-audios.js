// =====================================================================
// SCRIPT: IMPORTAR AUDIOS        ·   npm run importar-audios
// =====================================================================
// Registra en la base de datos los fragmentos de voz de data/audios.csv.
// Los archivos .mp3 tienen que estar ya en public/audio/.
//
// Formato del CSV (una fila por archivo):
//   tmdb_id, personaje, actor_original, version, archivo
//   862, Woody, Tom Hanks, original, toy-story_woody_original.mp3
//
// Para cada fila:
//   1. Comprueba que el archivo existe y que la versión es válida.
//   2. Busca la película (tiene que estar importada antes, con
//      npm run importar) y, dentro de ella, el personaje por su actor
//      original (y por su nombre, si ese actor hace varios papeles).
//   3. Guarda el audio. Si ya había uno de ese personaje y versión,
//      lo sustituye.
// =====================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('../src/config/db');
const { normalizar } = require('../src/services/importacion');

const RUTA_CSV = path.join(__dirname, '..', 'data', 'audios.csv');
const CARPETA_AUDIO = path.join(__dirname, '..', 'public', 'audio');
const VERSIONES = ['original', 'castellano'];

/**
 * Busca el personaje de la fila dentro de la película: por el actor
 * original y, si ese actor tiene varios personajes, por el nombre.
 * @returns {number|null} id del personaje
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
    (p) => normalizar(p.actor_original) === normalizar(fila.actor_original)
  );
  if (delActor.length === 1) return delActor[0].id;

  const porNombre = delActor.find((p) => normalizar(p.nombre) === normalizar(fila.personaje));
  return porNombre ? porNombre.id : null;
}

async function main() {
  const filas = parse(fs.readFileSync(RUTA_CSV, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    comment: '#',
  });
  console.log(`${filas.length} audios en el CSV.\n`);

  let guardados = 0;
  const avisos = [];
  const avisar = (texto) => {
    console.warn(`  ${texto}`);
    avisos.push(texto);
  };

  for (const fila of filas) {
    const etiqueta = `${fila.personaje} (${fila.version})`;

    // 1. Comprobaciones
    if (!VERSIONES.includes(fila.version)) {
      avisar(`${etiqueta}: la versión tiene que ser "original" o "castellano".`);
      continue;
    }
    if (!fs.existsSync(path.join(CARPETA_AUDIO, fila.archivo))) {
      avisar(`${etiqueta}: no existe el archivo public/audio/${fila.archivo}`);
      continue;
    }

    // 2. Película y personaje
    const [[pelicula]] = await db.query('SELECT id FROM peliculas WHERE tmdb_id = ?', [Number(fila.tmdb_id)]);
    if (!pelicula) {
      avisar(`${etiqueta}: la película ${fila.tmdb_id} no está importada (npm run importar).`);
      continue;
    }
    const personajeId = await buscarPersonaje(pelicula.id, fila);
    if (!personajeId) {
      avisar(`${etiqueta}: no se encuentra a "${fila.actor_original}" en la película ${fila.tmdb_id}.`);
      continue;
    }

    // 3. Guardar (o sustituir) el audio
    await db.query(
      `INSERT INTO audios (personaje_id, version, archivo) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE archivo = VALUES(archivo)`,
      [personajeId, fila.version, fila.archivo]
    );
    console.log(`  ✓ ${etiqueta}`);
    guardados++;
  }

  console.log('\n--- Resumen ---');
  console.log(`Audios guardados: ${guardados}`);
  console.log(`Avisos:           ${avisos.length}`);
  await db.end();
}

main().catch(async (error) => {
  console.error('La importación se ha detenido:', error.message);
  await db.end();
  process.exit(1);
});
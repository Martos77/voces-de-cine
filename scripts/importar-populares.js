// =====================================================================
// SCRIPT: IMPORTAR PELÍCULAS POPULARES   ·   npm run importar-populares
// =====================================================================
// Descarga de TMDB las películas más populares en España y las guarda
// en la base de datos, para que el catálogo no se limite a las películas
// del CSV. Estas películas se guardan SIN doblaje: las voces se añaden
// después, a las que se quiera, mediante el CSV y npm run importar.
//
// Las películas que ya están en la base de datos no se vuelven a
// descargar, así que se puede ejecutar varias veces sin problema.
//
// Uso:
//   npm run importar-populares          → 20 páginas (unas 400 películas)
//   npm run importar-populares -- 5     → 5 páginas (unas 100 películas)
// =====================================================================

require('dotenv').config({ quiet: true });
const db = require('../src/config/db');
const tmdb = require('../src/services/tmdb');
const { guardarPelicula } = require('../src/services/importacion');

// TMDB devuelve 20 películas por página
const PAGINAS_POR_DEFECTO = 20;

async function main() {
  // Número de páginas: el que se escriba tras el comando, o el de por defecto
  const paginas = Number(process.argv[2]) || PAGINAS_POR_DEFECTO;
  console.log(`Descargando ${paginas} páginas de películas populares (20 por página)...\n`);

  let nuevas = 0;
  let yaEstaban = 0;
  const errores = [];

  for (let pagina = 1; pagina <= paginas; pagina++) {
    console.log(`Página ${pagina} de ${paginas}`);
    const { ids, totalPaginas } = await tmdb.listarPopulares(pagina);

    for (const tmdbId of ids) {
      // Si ya la tenemos (por ejemplo, porque está en el CSV), la saltamos
      const [[existente]] = await db.query('SELECT id FROM peliculas WHERE tmdb_id = ?', [tmdbId]);
      if (existente) {
        yaEstaban++;
        continue;
      }

      // Si una película falla, la anotamos y seguimos con las demás
      try {
        await guardarPelicula(tmdbId);
        nuevas++;
      } catch (error) {
        console.error(`  Error en la película ${tmdbId}: ${error.message || error.code || error}`);
        errores.push(tmdbId);
      }
    }

    // Por si TMDB tiene menos páginas de las que hemos pedido
    if (pagina >= totalPaginas) break;
  }

  console.log('\n--- Resumen ---');
  console.log(`Películas nuevas:     ${nuevas}`);
  console.log(`Ya estaban:           ${yaEstaban}`);
  console.log(`Con error:            ${errores.length}`);

  await db.end(); // cerramos las conexiones para que el script termine
}

main().catch(async (error) => {
  console.error('La importación se ha detenido:', error.message || error.code || error);
  await db.end();
  process.exit(1);
});
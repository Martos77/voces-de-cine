// =====================================================================
// SERVICIO TMDB
// =====================================================================
// Agrupa todas las llamadas a la API de The Movie Database (TMDB).
// Solo lo usará el script de importación: la web NO consulta TMDB en
// cada visita, sino que lee los datos ya guardados en nuestra base de
// datos (es más rápido y no dependemos de que TMDB esté disponible).
//
// Documentación: https://developer.themoviedb.org/docs
// =====================================================================

require('dotenv').config();

const URL_BASE = 'https://api.themoviedb.org/3';


/**
 * Hace una petición a la API de TMDB y devuelve la respuesta en JSON.
 * @param {string} ruta - por ejemplo "/movie/862"
 * @param {object} parametros - parámetros extra para la URL
 */
async function peticion(ruta, parametros = {}) {
  const clave = process.env.TMDB_API_KEY;
  if (!clave) {
    throw new Error('Falta TMDB_API_KEY en el archivo .env');
  }

  // Construimos la URL con la clave, el idioma (español de España)
  // y los parámetros que nos pasen
  const url = new URL(URL_BASE + ruta);
  url.searchParams.set('api_key', clave);
  url.searchParams.set('language', 'es-ES');
  for (const [nombre, valor] of Object.entries(parametros)) {
    url.searchParams.set(nombre, valor);
  }

  // fetch() hace la petición a internet (viene incluido en Node.js)
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`TMDB respondió con el error ${respuesta.status} en ${ruta}`);
  }
  return respuesta.json();
}

/**
 * Descarga una película con su reparto y la devuelve "limpia",
 * solo con los campos que necesitamos para nuestra base de datos.
 * @param {number} tmdbId - número de la película en TMDB
 */
async function obtenerPelicula(tmdbId) {
  // append_to_response=credits trae el reparto en la misma petición
  const datos = await peticion(`/movie/${tmdbId}`, { append_to_response: 'credits' });

  // El director está en el "equipo técnico" (crew), con el trabajo "Director"
  const director = (datos.credits?.crew || [])
    .filter((persona) => persona.job === 'Director')
    .map((persona) => persona.name)
    .join(', ');

    // Reparto original completo. El script de importación decide cuáles guardar.
  const reparto = (datos.credits?.cast || [])
    .map((persona) => ({
      tmdbId: persona.id,
      nombre: persona.name,
      // TMDB añade a veces "(voice)" o "(uncredited)" al personaje: lo quitamos
      personaje: (persona.character || '').replace(/\s*\((voice|uncredited)\)/gi, '').trim() || 'Sin nombre',
      fotoPath: persona.profile_path,
      orden: persona.order,
    }));

  // Devolvemos los datos con nombres en español y el formato de nuestras tablas
  return {
    tmdbId: datos.id,
    titulo: datos.title,
    tituloOriginal: datos.original_title,
    sinopsis: datos.overview,
    anio: datos.release_date ? Number(datos.release_date.slice(0, 4)) : null,
    duracion: datos.runtime || null,
    valoracion: datos.vote_average ?? null,
    popularidad: datos.popularity ?? null,
    director: director || null,
    posterPath: datos.poster_path,
    fondoPath: datos.backdrop_path,
    generos: (datos.genres || []).map((g) => ({ id: g.id, nombre: g.name })),
    reparto,
  };
}

/**
 * Devuelve una página del listado de películas más conocidas: las que
 * tienen más votos en TMDB, de cualquier época. Es mejor criterio que
 * "populares", que solo refleja lo que más se busca en este momento
 * (sobre todo estrenos).
 * Cada página trae 20 películas. Solo nos quedamos con sus id de TMDB,
 * porque los datos completos se descargan después con obtenerPelicula().
 * @param {number} pagina - número de página (empieza en 1)
 * @returns {{ ids: number[], totalPaginas: number }}
 */
async function listarPopulares(pagina = 1) {
  const datos = await peticion('/discover/movie', {
    page: pagina,
    sort_by: 'vote_count.desc',  // de más votos a menos
    include_adult: 'false',
  });
  return {
    ids: datos.results.map((p) => p.id),
    totalPaginas: datos.total_pages,
  };
}

/**
 * Busca películas en TMDB por título y devuelve una lista resumida.
 * La usaremos para encontrar películas que no estén en nuestra base de datos.
 * @param {string} texto - el título a buscar
 */
async function buscarPeliculas(texto) {
  const datos = await peticion('/search/movie', { query: texto });
  return datos.results.map((p) => ({
    tmdbId: p.id,
    titulo: p.title,
    tituloOriginal: p.original_title,
    anio: p.release_date ? Number(p.release_date.slice(0, 4)) : null,
    posterPath: p.poster_path,
  }));
}

// Solo exportamos lo que necesitan otros archivos
module.exports = { obtenerPelicula, buscarPeliculas, listarPopulares };
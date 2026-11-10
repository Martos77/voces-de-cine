// =====================================================================
// MODELO DE PELÍCULAS
// =====================================================================
// Contiene las consultas SQL relacionadas con las películas.
//
// IMPORTANTE: los valores que pueden venir del usuario NUNCA se pegan
// dentro del texto SQL. Se ponen como "?" y se pasan aparte, en una
// lista. La librería mysql2 se encarga de tratarlos de forma segura.
// Así se evita la inyección SQL.
// =====================================================================

const db = require('../config/db');

// =====================================================================
// UTILIDADES PARA LEER LOS PARÁMETROS DE LAS PETICIONES
// =====================================================================
// Todo lo que llega en una dirección (?anio=1995) es texto. Estas
// funciones lo convierten al tipo correcto y descartan los valores no
// válidos, para que los modelos reciban siempre datos limpios.
// Si un valor no es válido, devuelven null, que significa "sin filtro".
// =====================================================================

// Formas de ordenar permitidas. Es una "lista blanca": el usuario elige
// una clave (por ejemplo "valoracion") y nosotros ponemos el SQL. Así el
// usuario nunca puede escribir SQL directamente en la consulta.
const ORDENES = {
  popularidad: 'p.popularidad DESC',
  valoracion: 'p.valoracion DESC',
  recientes: 'p.anio DESC',
  titulo: 'p.titulo ASC',
};

// Películas que se muestran en cada página del catálogo
const POR_PAGINA = 24;

/**
 * Busca películas aplicando los filtros recibidos. Todos son opcionales:
 * si no llega ninguno, devuelve el catálogo completo.
 */
async function buscar(filtros) {
  // Vamos guardando cada condición en "condiciones" y su valor en
  // "valores", en el mismo orden. Al final se unen con AND.
  const condiciones = [];
  const valores = [];

  if (filtros.texto) {
    // LIKE '%toy%' busca películas cuyo título CONTENGA "toy"
    condiciones.push('(p.titulo LIKE ? OR p.titulo_original LIKE ?)');
    valores.push(`%${filtros.texto}%`, `%${filtros.texto}%`);
  }
  if (filtros.genero) {
    condiciones.push(`EXISTS (SELECT 1 FROM peliculas_generos pg
                              WHERE pg.pelicula_id = p.id AND pg.genero_id = ?)`);
    valores.push(filtros.genero);
  }
  if (filtros.anioDesde) {
    condiciones.push('p.anio >= ?');
    valores.push(filtros.anioDesde);
  }
  if (filtros.anioHasta) {
    condiciones.push('p.anio <= ?');
    valores.push(filtros.anioHasta);
  }
  if (filtros.duracionMax) {
    condiciones.push('p.duracion <= ?');
    valores.push(filtros.duracionMax);
  }
  if (filtros.valoracionMin) {
    condiciones.push('p.valoracion >= ?');
    valores.push(filtros.valoracionMin);
  }
  if (filtros.director) {
    condiciones.push('p.director LIKE ?');
    valores.push(`%${filtros.director}%`);
  }
  if (filtros.actor) {
    condiciones.push(`EXISTS (SELECT 1 FROM personajes pe
                              JOIN actores_originales ao ON ao.id = pe.actor_original_id
                              WHERE pe.pelicula_id = p.id AND ao.nombre LIKE ?)`);
    valores.push(`%${filtros.actor}%`);
  }
  if (filtros.soloDoblaje) {
    condiciones.push(`EXISTS (SELECT 1 FROM personajes pe
                              JOIN doblajes d ON d.personaje_id = pe.id
                              WHERE pe.pelicula_id = p.id)`);
  }

  // Si hay condiciones, montamos el WHERE; si no, queda vacío
  const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

    // Si el orden no es válido (o no se indica), por popularidad
  const orden = ORDENES[filtros.orden] || ORDENES.popularidad;

  // Página pedida (mínimo la 1) y cuántas películas hay que saltarse
  const pagina = Math.max(1, Number(filtros.pagina) || 1);
  const desplazamiento = (pagina - 1) * POR_PAGINA;

  // 1. Cuántas películas cumplen los filtros en total
  //    (para saber cuántas páginas hay)
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM peliculas p ${where}`,
    valores
  );

  // 2. Solo las películas de la página pedida.
  //    LIMIT ? OFFSET ? = "dame POR_PAGINA, saltándote las primeras desplazamiento"
  const [peliculas] = await db.query(
    `SELECT p.id, p.titulo, p.anio, p.duracion, p.valoracion, p.poster_path,
            EXISTS (SELECT 1 FROM personajes pe
                    JOIN doblajes d ON d.personaje_id = pe.id
                    WHERE pe.pelicula_id = p.id) AS tiene_doblaje
       FROM peliculas p
       ${where}
      ORDER BY ${orden}, p.id
      LIMIT ? OFFSET ?`,
    [...valores, POR_PAGINA, desplazamiento]
  );

  // Devolvemos las películas y los datos necesarios para la paginación
  return {
    peliculas,
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  };
}

/**
 * Número entero positivo. "1995" → 1995; "abc" o "-3" → null.
 */
function entero(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

/**
 * Número con decimales. "7.5" → 7.5; vacío o "abc" → null.
 */
function decimal(valor) {
  if (valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Texto sin espacios sobrantes y de 100 caracteres como máximo.
 * Si queda vacío, null.
 */
function texto(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().slice(0, 100);
  return limpio || null;
}

module.exports = { entero, decimal, texto };

/**
 * Devuelve la ficha completa de una película: sus datos, sus géneros
 * y su reparto con las voces en castellano.
 * @param {number} id - id de la película en nuestra base de datos
 * @returns {object|null} la película, o null si no existe
 */
async function obtenerPorId(id) {
  // 1. Datos de la película.
  // [[pelicula]] coge directamente la primera fila del resultado.
  const [[pelicula]] = await db.query('SELECT * FROM peliculas WHERE id = ?', [id]);
  if (!pelicula) return null;

  // 2. Sus géneros
  const [generos] = await db.query(
    `SELECT g.id, g.nombre
       FROM generos g
       JOIN peliculas_generos pg ON pg.genero_id = g.id
      WHERE pg.pelicula_id = ?
      ORDER BY g.nombre`,
    [id]
  );

  // 3. Su reparto con el actor original y la voz en castellano.
  // LEFT JOIN = el personaje aparece aunque no tenga voz registrada
  // (en ese caso, los campos del doblaje vienen vacíos, como null).
  // El ORDER BY pone primero los personajes CON voz y, dentro de cada
  // grupo, en el orden del reparto.
  const [reparto] = await db.query(
    `SELECT pe.id         AS personaje_id,
            pe.nombre     AS personaje,
            ao.id         AS actor_original_id,
            ao.nombre     AS actor_original,
            ao.foto_path  AS actor_original_foto,
            ad.id         AS actor_doblaje_id,
            ad.nombre     AS actor_doblaje
       FROM personajes pe
       LEFT JOIN actores_originales ao ON ao.id = pe.actor_original_id
       LEFT JOIN doblajes d            ON d.personaje_id = pe.id AND d.version = 'castellano'
       LEFT JOIN actores_doblaje ad    ON ad.id = d.actor_doblaje_id
      WHERE pe.pelicula_id = ?
      ORDER BY (ad.id IS NULL), pe.orden`,
    [id]
  );

  // Devolvemos todo junto: los datos de la película más dos listas
  return { ...pelicula, generos, reparto };
}

/**
 * Devuelve las películas que comparten actores de doblaje con la indicada,
 * ordenadas de más a menos voces en común (como máximo 12).
 * @param {number} id - id de la película de partida
 */
async function vocesCompartidas(id) {
  // Explicación de la consulta:
  //  - d1 y pe1: los doblajes de la película de partida.
  //  - d2: otros doblajes hechos por los MISMOS actores de doblaje
  //    (por eso los unimos con d2.actor_doblaje_id = d1.actor_doblaje_id).
  //  - pe2 y p: a qué personaje y película pertenecen esos otros doblajes.
  //  - WHERE: partimos de nuestra película y descartamos que se encuentre
  //    a sí misma (pe2.pelicula_id <> ?).
  //  - GROUP BY: juntamos los resultados por película. COUNT cuenta
  //    cuántas voces distintas comparte, y GROUP_CONCAT une sus nombres
  //    en un solo texto ("Voz 1, Voz 2").
  const [peliculas] = await db.query(
    `SELECT p.id, p.titulo, p.anio, p.poster_path,
            COUNT(DISTINCT d2.actor_doblaje_id) AS voces_en_comun,
            GROUP_CONCAT(DISTINCT ad.nombre ORDER BY ad.nombre SEPARATOR ', ') AS voces
       FROM doblajes d1
       JOIN personajes pe1      ON pe1.id = d1.personaje_id
       JOIN doblajes d2         ON d2.actor_doblaje_id = d1.actor_doblaje_id
       JOIN personajes pe2      ON pe2.id = d2.personaje_id
       JOIN peliculas p         ON p.id = pe2.pelicula_id
       JOIN actores_doblaje ad  ON ad.id = d2.actor_doblaje_id
      WHERE pe1.pelicula_id = ? AND pe2.pelicula_id <> ?
      GROUP BY p.id, p.titulo, p.anio, p.poster_path, p.popularidad
      ORDER BY voces_en_comun DESC, p.popularidad DESC
      LIMIT 12`,
    [id, id]
  );
  return peliculas;
}

/**
 * Dada una lista de id de TMDB, averigua cuáles están ya en nuestra base
 * de datos. Devuelve un Map: id de TMDB → id en nuestra base de datos.
 * Los que no estén, simplemente no aparecen en el Map.
 * @param {number[]} tmdbIds
 */
async function buscarPorTmdbIds(tmdbIds) {
  if (tmdbIds.length === 0) return new Map();
  // IN (?) con una lista: mysql2 la convierte en IN (1, 2, 3...)
  const [filas] = await db.query(
    'SELECT id, tmdb_id FROM peliculas WHERE tmdb_id IN (?)',
    [tmdbIds]
  );
  return new Map(filas.map((f) => [f.tmdb_id, f.id]));
}

module.exports = { buscar, obtenerPorId, vocesCompartidas, buscarPorTmdbIds };
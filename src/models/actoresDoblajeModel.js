// =====================================================================
// MODELO DE ACTORES Y ACTRICES DE DOBLAJE
// =====================================================================

const db = require('../config/db');
const { normalizar } = require('../services/importacion');

// Id del género "Animación" en TMDB. En las películas de animación lo
// importante es el personaje, no el actor original que lo interpreta.
const GENERO_ANIMACION = 16;

// Cuántos elementos se muestran en cada sección de la ficha
const NUM_DESTACADOS = 4;
const NUM_HABITUALES = 5;

/**
 * Ordena los trabajos de "más destacado" a "menos destacado":
 *   1. Primero los papeles principales (entre los 4 primeros del reparto).
 *   2. Dentro de cada grupo, de la película más popular a la menos.
 * Devuelve una lista nueva; no modifica la original.
 */
function ordenarPorRelevancia(trabajos) {
  return [...trabajos].sort((a, b) => {
    const aPrincipal = a.orden <= 3 ? 1 : 0;
    const bPrincipal = b.orden <= 3 ? 1 : 0;
    if (aPrincipal !== bPrincipal) return bPrincipal - aPrincipal;
    return (b.popularidad || 0) - (a.popularidad || 0);
  });
}

// Palabras que no sirven para saber si dos personajes son el mismo
// (cargos y tratamientos: "Agente", "Coronel"...). Sin tildes.
const PALABRAS_COMUNES = new Set([
  'agente', 'coronel', 'capitan', 'comandante', 'general', 'sargento', 'teniente',
  'profesor', 'profesora', 'doctor', 'doctora', 'inspector', 'oficial', 'presidente',
  'senor', 'senora', 'joven', 'nino', 'nina', 'anciano', 'anciana',
]);

/**
 * Palabras importantes del nombre de un personaje: sin tildes, de 4
 * letras o más y sin cargos. "Coronel Nick Furia" → ['nick', 'furia']
 */
function palabrasClave(nombre) {
  return normalizar(nombre)
    .split(/[^a-z0-9]+/)
    .filter((palabra) => palabra.length >= 4 && !PALABRAS_COMUNES.has(palabra));
}

/**
 * ¿Son el mismo personaje en dos películas distintas? Lo son si los
 * interpreta el mismo actor original y sus nombres comparten alguna
 * palabra importante. Así se juntan "Nick Furia" y "Coronel Nick Furia",
 * pero no "Narrador" y "Nick Furia" (los dos de Samuel L. Jackson).
 */
function mismoPersonaje(a, b) {
  if (!a.actor_original_id || a.actor_original_id !== b.actor_original_id) return false;
  const claves = new Set(palabrasClave(a.personaje));
  return palabrasClave(b.personaje).some((palabra) => claves.has(palabra));
}

/**
 * Junta los personajes que se repiten en varias películas (por ejemplo,
 * Tony Stark en las tres de Iron Man). Se queda con el primero de cada
 * uno (el más relevante, porque la lista ya viene ordenada) y le añade
 * num_peliculas: en cuántas películas le ha puesto voz.
 */
function agruparPersonajes(trabajos) {
  const grupos = [];
  for (const trabajo of trabajos) {
    const grupo = grupos.find((g) => mismoPersonaje(g, trabajo));
    if (grupo) {
      grupo.num_peliculas++;
    } else {
      grupos.push({ ...trabajo, num_peliculas: 1 });
    }
  }
  return grupos;
}

/**
 * Ficha completa de un actor o actriz de doblaje.
 * @param {number} id
 * @returns {object|null} null si no existe. Si existe, devuelve sus datos y:
 *   - destacados: sus personajes más relevantes (los NUM_DESTACADOS primeros)
 *   - habituales: los actores originales a los que más ha doblado,
 *                 sin contar las películas de animación
 *   - trabajos:   toda su filmografía, de la más reciente a la más antigua
 */
async function obtenerPorId(id) {
  // 1. Sus datos
  const [[actor]] = await db.query('SELECT * FROM actores_doblaje WHERE id = ?', [id]);
  if (!actor) return null;

  // 2. Todos sus trabajos. Además de la película y el personaje, traemos
  //    la posición en el reparto y la popularidad (para elegir los
  //    destacados) y si la película es de animación.
  const [trabajos] = await db.query(
    `SELECT p.id          AS pelicula_id,
            p.titulo,
            p.anio,
            p.poster_path,
            p.fondo_path,
            p.popularidad,
            pe.nombre     AS personaje,
            pe.orden,
            ao.id         AS actor_original_id,
            ao.nombre     AS actor_original,
            EXISTS (SELECT 1 FROM peliculas_generos pg
                    WHERE pg.pelicula_id = p.id AND pg.genero_id = ?) AS es_animacion
       FROM doblajes d
       JOIN personajes pe              ON pe.id = d.personaje_id
       JOIN peliculas p                ON p.id = pe.pelicula_id
       LEFT JOIN actores_originales ao ON ao.id = pe.actor_original_id
      WHERE d.actor_doblaje_id = ?
      ORDER BY p.anio DESC, p.titulo`,
    [GENERO_ANIMACION, id]
  );

  // 3. Actores habituales: a quién ha doblado más veces, SIN contar las
  //    películas de animación (NOT EXISTS descarta las que tienen ese género)
  const [habituales] = await db.query(
    `SELECT ao.id, ao.nombre, ao.foto_path, COUNT(*) AS veces
       FROM doblajes d
       JOIN personajes pe          ON pe.id = d.personaje_id
       JOIN actores_originales ao  ON ao.id = pe.actor_original_id
      WHERE d.actor_doblaje_id = ?
        AND NOT EXISTS (SELECT 1 FROM peliculas_generos pg
                        WHERE pg.pelicula_id = pe.pelicula_id AND pg.genero_id = ?)
      GROUP BY ao.id, ao.nombre, ao.foto_path
      ORDER BY veces DESC, ao.nombre
      LIMIT ?`,
    [id, GENERO_ANIMACION, NUM_HABITUALES]
  );

    // 4. Personajes destacados: los más relevantes según ordenarPorRelevancia().
  //    Cada personaje sale una sola vez, aunque lo haya doblado en varias películas
  const destacados = agruparPersonajes(ordenarPorRelevancia(trabajos)).slice(0, NUM_DESTACADOS);

  return { ...actor, destacados, habituales, trabajos };
}

// ---------------------------------------------------------------------
// BUSCADOR DE VOCES
// ---------------------------------------------------------------------

// Máximo de profesionales que devuelve una búsqueda
const MAX_RESULTADOS = 60;

// Cuántos nombres se muestran en cada tarjeta ("Robert Downey Jr. · Michael Shannon")
const NUM_CONOCIDO_POR = 3;

/**
 * Lo que se muestra de cada trabajo en la tarjeta de una voz:
 * el ACTOR ORIGINAL al que dobla o, en animación (o si no se conoce
 * el actor), el PERSONAJE. Es el mismo criterio que en su ficha.
 */
function etiqueta(trabajo) {
  return trabajo.es_animacion || !trabajo.actor_original
    ? trabajo.personaje
    : trabajo.actor_original;
}

/**
 * Los nombres que más se repiten en sus trabajos, sin repetir ninguno.
 * Primero los que más veces ha doblado; si empatan, el más relevante
 * (la lista llega ordenada por ordenarPorRelevancia).
 * Ejemplo (Juan Antonio Bernal): Robert Downey Jr. (3) · Michael Shannon (1) · Pato Lucas (1)
 */
function masDoblados(trabajos) {
  const veces = new Map();   // nombre normalizado → { nombre, veces, posicion }
  trabajos.forEach((t, posicion) => {
    const nombre = etiqueta(t);
    const clave = normalizar(nombre);
    if (!veces.has(clave)) veces.set(clave, { nombre, veces: 0, posicion });
    veces.get(clave).veces++;
  });

  return [...veces.values()]
    .sort((a, b) => b.veces - a.veces || a.posicion - b.posicion)
    .slice(0, NUM_CONOCIDO_POR)
    .map((e) => e.nombre);
}

/**
 * Busca profesionales del doblaje por su nombre o por el nombre de un
 * personaje al que han puesto voz. Sin texto, devuelve todos.
 * @param {string|null} texto
 * @returns {Array} [{ id, nombre, num_peliculas, conocido_por: [personajes] }],
 *                  de más a menos películas.
 */
async function buscar(texto) {
  // 1. Condición de búsqueda (solo si se ha escrito algo).
  //    LIKE '%texto%' encuentra el texto en cualquier parte del nombre.
  //    EXISTS comprueba si ha doblado algún personaje con ese nombre.
  let condicion = '';
  const valores = [];
  if (texto) {
    const patron = `%${texto}%`;
    condicion = `WHERE ad.nombre LIKE ?
                    OR EXISTS (SELECT 1
                                 FROM doblajes d2
                                 JOIN personajes p2 ON p2.id = d2.personaje_id
                                WHERE d2.actor_doblaje_id = ad.id
                                  AND p2.nombre LIKE ?)`;
    valores.push(patron, patron);
  }

  // 2. Profesionales que cumplen la condición, con su número de películas.
  //    El texto del usuario va siempre en los "?", protegido frente a
  //    inyección SQL.
  const [actores] = await db.query(
    `SELECT ad.id, ad.nombre, COUNT(DISTINCT pe.pelicula_id) AS num_peliculas
       FROM actores_doblaje ad
       LEFT JOIN doblajes d    ON d.actor_doblaje_id = ad.id
       LEFT JOIN personajes pe ON pe.id = d.personaje_id
       ${condicion}
      GROUP BY ad.id, ad.nombre
      ORDER BY num_peliculas DESC, ad.nombre
      LIMIT ?`,
    [...valores, MAX_RESULTADOS]
  );

  if (actores.length === 0) return [];

  // 3. Personajes de todos esos profesionales, en una sola consulta.
  //    "IN (?)" con una lista: mysql2 la convierte en IN (1, 2, 3...).
    const [personajes] = await db.query(
    `SELECT d.actor_doblaje_id, pe.nombre AS personaje, pe.orden, p.popularidad,
            ao.nombre AS actor_original,
            EXISTS (SELECT 1 FROM peliculas_generos pg
                    WHERE pg.pelicula_id = p.id AND pg.genero_id = ?) AS es_animacion
       FROM doblajes d
       JOIN personajes pe              ON pe.id = d.personaje_id
       JOIN peliculas p                ON p.id = pe.pelicula_id
       LEFT JOIN actores_originales ao ON ao.id = pe.actor_original_id
      WHERE d.actor_doblaje_id IN (?)`,
    [GENERO_ANIMACION, actores.map((a) => a.id)]
  );

  // 4. Agrupamos los personajes por profesional (Map: id → lista)
  const porActor = new Map();
  for (const p of personajes) {
    if (!porActor.has(p.actor_doblaje_id)) porActor.set(p.actor_doblaje_id, []);
    porActor.get(p.actor_doblaje_id).push(p);
  }

    // 5. A cada profesional le añadimos los actores (o personajes, en
  //    animación) que más ha doblado, sin repetir
  return actores.map((actor) => ({
    ...actor,
    conocido_por: masDoblados(ordenarPorRelevancia(porActor.get(actor.id) ?? [])),
  }));
}

module.exports = { obtenerPorId, buscar };
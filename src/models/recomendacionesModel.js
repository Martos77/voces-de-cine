// =====================================================================
// MODELO: RECOMENDACIONES (F22–F24)
// =====================================================================
// Recomienda películas a partir de lo que le ha gustado al usuario.
//
// 1. Películas de partida ("base"): las favoritas, las valoradas con
//    4 o 5 estrellas y las vistas que no ha valorado mal. Las
//    favoritas y las de 4-5 estrellas cuentan el doble (peso 2).
// 2. Cada película candidata suma puntos por lo que tiene en común:
//      - una voz de sus voces favoritas ........... 4 puntos
//      - una voz de una película de partida ....... 3 × peso
//      - un actor original de una película base ... 2 × peso
//      - sus géneros (según cuánto le gustan) ..... hasta 3 por género
//    Las voces puntúan más porque son el centro de la aplicación.
// 3. Se ordenan por puntos (y, si empatan, por popularidad) y cada una
//    lleva el motivo principal: "Comparte voz con Toy Story".
// 4. Sin historial (o si faltan), se completa con las más populares.
//
// Nunca se recomienda una película que el usuario ya tenga en sus
// listas (vista, favorita o pendiente).
// =====================================================================

const db = require('../config/db');

// Cuántas películas se recomiendan como máximo
const LIMITE = 12;

// Puntos de cada tipo de coincidencia
const PUNTOS = { vozFavorita: 4, voz: 3, actor: 2, genero: 3 };

// Subconsulta con las películas de partida y su peso.
// Se reutiliza en varias consultas (siempre con el id del usuario como "?").
const BASE = `
  SELECT pelicula_id,
         CASE WHEN favorita OR valoracion >= 4 THEN 2 ELSE 1 END AS peso
    FROM usuarios_peliculas
   WHERE usuario_id = ?
     AND (favorita OR vista)
     AND (valoracion IS NULL OR valoracion >= 3)`;

// Condición para descartar las películas que el usuario ya tiene
const NO_SUYA = `
  NOT EXISTS (SELECT 1 FROM usuarios_peliculas up
               WHERE up.usuario_id = ? AND up.pelicula_id = %s)`;

/**
 * Películas con voces que el usuario ha marcado como favoritas.
 */
async function porVocesFavoritas(usuarioId) {
  const [filas] = await db.query(
    `SELECT DISTINCT pe.pelicula_id AS id, ad.nombre AS voz
       FROM usuarios_voces uv
       JOIN actores_doblaje ad ON ad.id = uv.actor_doblaje_id
       JOIN doblajes d         ON d.actor_doblaje_id = uv.actor_doblaje_id AND d.version = 'castellano'
       JOIN personajes pe      ON pe.id = d.personaje_id
      WHERE uv.usuario_id = ?
        AND ${NO_SUYA.replace('%s', 'pe.pelicula_id')}`,
    [usuarioId, usuarioId]
  );
  return filas;
}

/**
 * Películas que comparten voz con alguna película de partida.
 * Es la misma idea que "Con las mismas voces" de la ficha de película,
 * pero partiendo de todas las películas que le han gustado.
 */
async function porVocesCompartidas(usuarioId) {
  const [filas] = await db.query(
    `SELECT DISTINCT pe2.pelicula_id AS id, ad.nombre AS voz,
            origen.titulo AS origen, base.peso
       FROM (${BASE}) base
       JOIN peliculas origen   ON origen.id = base.pelicula_id
       JOIN personajes pe1     ON pe1.pelicula_id = base.pelicula_id
       JOIN doblajes d1        ON d1.personaje_id = pe1.id AND d1.version = 'castellano'
       JOIN doblajes d2        ON d2.actor_doblaje_id = d1.actor_doblaje_id AND d2.version = 'castellano'
       JOIN personajes pe2     ON pe2.id = d2.personaje_id
       JOIN actores_doblaje ad ON ad.id = d1.actor_doblaje_id
      WHERE ${NO_SUYA.replace('%s', 'pe2.pelicula_id')}`,
    [usuarioId, usuarioId]
  );
  return filas;
}

/**
 * Películas con los mismos actores originales que las de partida.
 * Solo se cuentan los papeles principales (los 5 primeros del reparto),
 * para no recomendar algo por un actor que salía de figurante.
 */
async function porActores(usuarioId) {
  const [filas] = await db.query(
    `SELECT DISTINCT pe2.pelicula_id AS id, ao.nombre AS actor,
            origen.titulo AS origen, base.peso
       FROM (${BASE}) base
       JOIN peliculas origen      ON origen.id = base.pelicula_id
       JOIN personajes pe1        ON pe1.pelicula_id = base.pelicula_id AND pe1.orden < 5
       JOIN personajes pe2        ON pe2.actor_original_id = pe1.actor_original_id AND pe2.orden < 5
       JOIN actores_originales ao ON ao.id = pe1.actor_original_id
      WHERE ${NO_SUYA.replace('%s', 'pe2.pelicula_id')}`,
    [usuarioId, usuarioId]
  );
  return filas;
}

/**
 * Películas de los géneros que más le gustan.
 * "perfil" calcula qué parte de sus películas es de cada género
 * (por ejemplo, Animación 0.75 si 3 de cada 4 son de animación).
 * Cada candidata suma esa proporción por cada género que tenga.
 */
async function porGeneros(usuarioId) {
  const [filas] = await db.query(
    `SELECT pg.pelicula_id AS id,
            SUM(perfil.proporcion) AS proporcion,
            GROUP_CONCAT(g.nombre ORDER BY perfil.proporcion DESC SEPARATOR ', ') AS generos
       FROM (SELECT pg.genero_id,
                    SUM(base.peso) / (SELECT SUM(peso) FROM (${BASE}) total) AS proporcion
               FROM (${BASE}) base
               JOIN peliculas_generos pg ON pg.pelicula_id = base.pelicula_id
              GROUP BY pg.genero_id) perfil
       JOIN peliculas_generos pg ON pg.genero_id = perfil.genero_id
       JOIN generos g            ON g.id = perfil.genero_id
      WHERE ${NO_SUYA.replace('%s', 'pg.pelicula_id')}
      GROUP BY pg.pelicula_id
      ORDER BY proporcion DESC
      LIMIT 200`,
    [usuarioId, usuarioId, usuarioId]
  );
  return filas;
}

/**
 * Las películas más populares que el usuario no tiene en sus listas.
 * Primero las que tienen doblaje registrado. Sirven para quien aún no
 * tiene historial y para completar la lista si faltan recomendaciones.
 */
async function populares(usuarioId, cuantas, excluir = []) {
  const [filas] = await db.query(
    `SELECT p.id
       FROM peliculas p
      WHERE ${NO_SUYA.replace('%s', 'p.id')}
        ${excluir.length > 0 ? 'AND p.id NOT IN (?)' : ''}
      ORDER BY EXISTS (SELECT 1 FROM personajes pe JOIN doblajes d ON d.personaje_id = pe.id
                        WHERE pe.pelicula_id = p.id) DESC,
               p.popularidad DESC
      LIMIT ?`,
    excluir.length > 0 ? [usuarioId, excluir, cuantas] : [usuarioId, cuantas]
  );
  return filas.map((f) => f.id);
}

/**
 * Datos para las tarjetas de una lista de películas, en el mismo orden.
 */
async function datosPeliculas(ids) {
  if (ids.length === 0) return [];
  const [filas] = await db.query(
    `SELECT p.id, p.titulo, p.anio, p.poster_path, p.popularidad,
            EXISTS (SELECT 1 FROM personajes pe JOIN doblajes d ON d.personaje_id = pe.id
                     WHERE pe.pelicula_id = p.id) AS tiene_doblaje
       FROM peliculas p
      WHERE p.id IN (?)`,
    [ids]
  );
  const porId = new Map(filas.map((f) => [f.id, f]));
  return ids.map((id) => porId.get(id)).filter(Boolean);
}

/**
 * Recomendaciones para un usuario.
 * @returns {{ personalizadas: boolean, peliculas: Array }}
 *   personalizadas es false si no tiene historial (solo populares).
 *   Cada película lleva "motivo": por qué se recomienda.
 */
async function obtener(usuarioId) {
  const [vocesFavoritas, voces, actores, generos] = await Promise.all([
    porVocesFavoritas(usuarioId),
    porVocesCompartidas(usuarioId),
    porActores(usuarioId),
    porGeneros(usuarioId),
  ]);

  // candidatas: id de película → { puntos, motivos }
  // Cada motivo lleva su "fuerza" para elegir después el más importante.
  const candidatas = new Map();
  function sumar(id, puntos, fuerza, texto) {
    if (!candidatas.has(id)) candidatas.set(id, { puntos: 0, motivos: [] });
    const c = candidatas.get(id);
    c.puntos += puntos;
    c.motivos.push({ fuerza, texto });
  }

  for (const f of vocesFavoritas) {
    sumar(f.id, PUNTOS.vozFavorita, 4, `Con ${f.voz}, una de tus voces favoritas`);
  }
  for (const f of voces) {
    sumar(f.id, PUNTOS.voz * f.peso, 3, `Comparte la voz de ${f.voz} con ${f.origen}`);
  }
  for (const f of actores) {
    sumar(f.id, PUNTOS.actor * f.peso, 2, `Con ${f.actor}, como en ${f.origen}`);
  }
  for (const f of generos) {
    sumar(f.id, PUNTOS.genero * f.proporcion, 1, `Por tus géneros: ${f.generos}`);
  }

  const personalizadas = candidatas.size > 0;
  const ordenadas = [...candidatas.entries()].map(([id, c]) => ({ id, ...c }));

  // Para desempatar por popularidad necesitamos los datos de las películas
  const datos = await datosPeliculas(ordenadas.map((c) => c.id));
  const popularidad = new Map(datos.map((p) => [p.id, Number(p.popularidad) || 0]));

  ordenadas.sort((a, b) => b.puntos - a.puntos || popularidad.get(b.id) - popularidad.get(a.id));
  const elegidas = ordenadas.slice(0, LIMITE);

  // El motivo que se muestra es el más fuerte (voz favorita > voz > actor > género)
  const motivoDe = new Map(elegidas.map((c) => [
    c.id,
    c.motivos.reduce((mejor, m) => (m.fuerza > mejor.fuerza ? m : mejor)).texto,
  ]));

  // Si faltan, se completa con populares
  const ids = elegidas.map((c) => c.id);
  if (ids.length < LIMITE) {
    for (const id of await populares(usuarioId, LIMITE - ids.length, ids)) {
      ids.push(id);
      motivoDe.set(id, 'Popular en el catálogo');
    }
  }

  const peliculas = (await datosPeliculas(ids)).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    anio: p.anio,
    poster_path: p.poster_path,
    tiene_doblaje: !!p.tiene_doblaje,
    motivo: motivoDe.get(p.id),
  }));

  return { personalizadas, peliculas };
}

module.exports = { obtener };
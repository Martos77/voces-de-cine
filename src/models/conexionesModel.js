// =====================================================================
// MODELO: CONEXIONES (F31) · el grafo de voces, películas y actores
// =====================================================================
// Devuelve una red (grafo) alrededor de un elemento central. Las voces
// y las películas se unen siempre a través del actor original al que
// se dobla (voz — actor — película), con el personaje en cada línea:
//
//   - Una VOZ:        voz → actores a los que dobla → películas.
//   - Un ACTOR:       actor → voces que le han doblado → películas.
//   - Una PELÍCULA:   película → actores → sus voces → otras películas
//                     de esas voces.
//
// Formato de la respuesta (el que espera D3.js en el navegador):
//   {
//     centro:  { id: 'voz-12', tipo: 'voz', nombre: '...' },
//     nodos:   [{ id: 'voz-12', tipo: 'voz', ref: 12, nombre: '...' }, ...],
//     enlaces: [{ source: 'voz-12', target: 'pelicula-3', etiquetas: ['Woody'] }, ...]
//   }
// "ref" es el id en la base de datos (para enlazar a su ficha) e "id"
// lo hace único en el grafo (una voz y una película pueden tener el
// mismo número).
// =====================================================================

const db = require('../config/db');

const { normalizar } = require('../services/importacion');

// Id del género "Animación" en TMDB (en animación importa el personaje)
const GENERO_ANIMACION = 16;

// Límites para que el grafo se pueda leer (y no tarde en dibujarse)
const MAX_PAPELES_PELICULA = 12;    // personajes doblados de la película central   // los papeles principales de cada película
const MAX_PELICULAS_POR_VOZ = 3;    // las más populares de cada voz

/**
 * Apariciones: cada personaje doblado con su película, su voz y su
 * actor original. Es la materia prima de todos los grafos.
 * @param {string} condicion - condición SQL con "?" (nunca texto del usuario)
 * @param {Array} valores - valores para los "?"
 */
async function apariciones(condicion, valores) {
    const [filas] = await db.query(
        `SELECT p.id  AS pelicula_id, p.titulo, p.anio, p.poster_path,
            ad.id AS voz_id, ad.nombre AS voz,
            ao.id AS actor_id, ao.nombre AS actor, ao.foto_path,
            pe.nombre AS personaje, pe.orden,
            EXISTS (SELECT 1 FROM peliculas_generos pg
                    WHERE pg.pelicula_id = p.id AND pg.genero_id = ?) AS es_animacion
       FROM doblajes d
       JOIN personajes pe              ON pe.id = d.personaje_id
       JOIN peliculas p                ON p.id = pe.pelicula_id
       JOIN actores_doblaje ad         ON ad.id = d.actor_doblaje_id
       LEFT JOIN actores_originales ao ON ao.id = pe.actor_original_id
      WHERE d.version = 'castellano' AND ${condicion}
      ORDER BY p.popularidad DESC, pe.orden`,
        [GENERO_ANIMACION, ...valores]   // el primer "?" es el del género
    );
    return filas;
}

/**
 * Ayudante para ir construyendo el grafo sin repetir nodos ni enlaces.
 * Los Map usan el id como clave: si un nodo ya existe, no se añade otra vez.
 */
function crearGrafo() {
    const nodos = new Map();
    const enlaces = new Map();

    return {
        // Añade un nodo (si no estaba) y devuelve su id.
        // "clave" sirve para distinguirlo; normalmente es su ref
        nodo(tipo, ref, nombre, extra = {}, clave = ref) {
            const id = `${tipo}-${clave}`;
            if (!nodos.has(id)) nodos.set(id, { id, tipo, ref, nombre, ...extra });
            return id;
        },
        // Une dos nodos. Si ya estaban unidos, solo añade la etiqueta
        enlace(origen, destino, etiqueta) {
            const clave = [origen, destino].sort().join('|');
            if (!enlaces.has(clave)) enlaces.set(clave, { source: origen, target: destino, etiquetas: [] });
            const e = enlaces.get(clave);
            if (etiqueta && !e.etiquetas.includes(etiqueta)) e.etiquetas.push(etiqueta);
        },
        resultado(centro) {
            return { centro, nodos: [...nodos.values()], enlaces: [...enlaces.values()] };
        },
    };
}

// Nodos de cada tipo a partir de una aparición
const nodoPelicula = (g, a) => g.nodo('pelicula', a.pelicula_id, a.titulo, { anio: a.anio, poster_path: a.poster_path });
const nodoVoz = (g, a) => g.nodo('voz', a.voz_id, a.voz);
const nodoActor = (g, a) => g.nodo('actor', a.actor_id, a.actor, { foto_path: a.foto_path });

// Personaje de animación. Su "ref" es la película (para enlazar a su
// ficha) y su clave, el nombre + el actor original: así Woody es un
// solo nodo aunque salga en varias películas de Toy Story.
const nodoPersonaje = (g, a) => g.nodo(
  'personaje', a.pelicula_id, a.personaje, {},
  `${a.actor_id || 0}-${normalizar(a.personaje).replace(/[^a-z0-9]+/g, '-')}`
);

// Texto de un enlace voz–película: "Woody (Tom Hanks)"
const papel = (a) => (a.actor ? `${a.personaje} (${a.actor})` : a.personaje);

/**
 * Une una voz con una película a través de quien pone voz:
 *   - en imagen real, el ACTOR ORIGINAL:  voz — Samuel L. Jackson — Iron Man
 *   - en animación (o si no se conoce el actor), el PERSONAJE:
 *                                          voz — Pumba — El rey león
 * Cada línea lleva el nombre del personaje.
 */
function cadena(g, a) {
  const voz = nodoVoz(g, a);
  const pelicula = nodoPelicula(g, a);
  const medio = a.es_animacion || !a.actor_id ? nodoPersonaje(g, a) : nodoActor(g, a);
  g.enlace(voz, medio, a.personaje);
  g.enlace(medio, pelicula, a.personaje);
}

/**
 * Grafo alrededor de una VOZ: voz → actores a los que dobla → películas.
 */
async function desdeVoz(id) {
    const propias = await apariciones('d.actor_doblaje_id = ?', [id]);
    if (propias.length === 0) return null;

    const g = crearGrafo();
    const centro = nodoVoz(g, propias[0]);
    for (const a of propias) cadena(g, a);

    return g.resultado({ id: centro, tipo: 'voz', nombre: propias[0].voz });
}

/**
 * Grafo alrededor de un ACTOR ORIGINAL: actor → sus voces → películas.
 * Así se ve si siempre le dobla la misma persona.
 */
async function desdeActor(id) {
    const propias = await apariciones('pe.actor_original_id = ?', [id]);
    if (propias.length === 0) return null;

    const g = crearGrafo();
    const centro = nodoActor(g, propias[0]);
    for (const a of propias) {
        const voz = nodoVoz(g, a);
        g.enlace(centro, voz, a.personaje);
        g.enlace(voz, nodoPelicula(g, a), a.personaje);
    }

    return g.resultado({ id: centro, tipo: 'actor', nombre: propias[0].actor });
}

/**
 * Grafo alrededor de una PELÍCULA:
 * película → actores principales → sus voces → otras películas de esas voces.
 */
async function desdePelicula(id) {
    const propias = await apariciones('p.id = ?', [id]);
    if (propias.length === 0) return null;

    const g = crearGrafo();
    const centro = nodoPelicula(g, propias[0]);

      // Sus personajes doblados (película — actor o personaje — voz).
  // Los primeros según el orden del reparto, contando solo los que
  // tienen doblaje (en TMDB pueden estar muy abajo: Bugs Bunny en Space Jam)
  const elegidos = propias.slice(0, MAX_PAPELES_PELICULA);
  for (const a of elegidos) cadena(g, a);

    // Otras películas de esas voces (las más populares de cada una).
    // Aquí la voz se une directamente a la película, para no llenar el
    // grafo de actores; el actor aparece en el texto de la línea.
    const vozIds = [...new Set(elegidos.map((a) => a.voz_id))];
    const cuantas = new Map();   // voz → películas añadidas
    for (const a of await apariciones('d.actor_doblaje_id IN (?) AND p.id <> ?', [vozIds, id])) {
        const n = cuantas.get(a.voz_id) || 0;
        if (n >= MAX_PELICULAS_POR_VOZ) continue;
        cuantas.set(a.voz_id, n + 1);
        g.enlace(nodoVoz(g, a), nodoPelicula(g, a), papel(a));
    }

    return g.resultado({ id: centro, tipo: 'pelicula', nombre: propias[0].titulo });
}

// ---------------------------------------------------------------------
// BUSCADOR DE LA PÁGINA DE CONEXIONES
// ---------------------------------------------------------------------

// Resultados de cada tipo que se devuelven como máximo
const MAX_POR_TIPO = 5;

// Condición para que solo salga lo que tiene doblaje (si no, su grafo estaría vacío)
const CON_DOBLAJE = `EXISTS (SELECT 1 FROM personajes pe JOIN doblajes d ON d.personaje_id = pe.id
                              WHERE %s)`;

/**
 * Busca voces, actores originales, películas y personajes a la vez.
 * Los personajes llevan a la película en la que salen.
 * @returns {Array} [{ tipo, id, nombre, detalle, marca }]
 *   tipo: el grafo que se abre (voz, actor o pelicula)
 *   marca: cómo se muestra (igual que tipo, salvo 'personaje')
 */
async function buscar(texto) {
  const patron = `%${texto}%`;

  const [[voces], [actores], [peliculas], [personajes]] = await Promise.all([
    db.query(
      `SELECT ad.id, ad.nombre FROM actores_doblaje ad
        WHERE ad.nombre LIKE ? ORDER BY ad.nombre LIMIT ?`,
      [patron, MAX_POR_TIPO]
    ),
    db.query(
      `SELECT ao.id, ao.nombre FROM actores_originales ao
        WHERE ao.nombre LIKE ? AND ${CON_DOBLAJE.replace('%s', 'pe.actor_original_id = ao.id')}
        ORDER BY ao.nombre LIMIT ?`,
      [patron, MAX_POR_TIPO]
    ),
    db.query(
      `SELECT p.id, p.titulo AS nombre, p.anio FROM peliculas p
        WHERE p.titulo LIKE ? AND ${CON_DOBLAJE.replace('%s', 'pe.pelicula_id = p.id')}
        ORDER BY p.popularidad DESC LIMIT ?`,
      [patron, MAX_POR_TIPO]
    ),
    db.query(
      `SELECT DISTINCT p.id, pe.nombre, p.titulo FROM personajes pe
         JOIN doblajes d  ON d.personaje_id = pe.id
         JOIN peliculas p ON p.id = pe.pelicula_id
        WHERE pe.nombre LIKE ?
        ORDER BY p.popularidad DESC LIMIT ?`,
      [patron, MAX_POR_TIPO]
    ),
  ]);

  return [
    ...voces.map((v) => ({ tipo: 'voz', marca: 'voz', id: v.id, nombre: v.nombre, detalle: 'Voz en castellano' })),
    ...actores.map((a) => ({ tipo: 'actor', marca: 'actor', id: a.id, nombre: a.nombre, detalle: 'Actor o actriz original' })),
    ...peliculas.map((p) => ({ tipo: 'pelicula', marca: 'pelicula', id: p.id, nombre: p.nombre, detalle: p.anio ? `Película (${p.anio})` : 'Película' })),
    ...personajes.map((p) => ({ tipo: 'pelicula', marca: 'personaje', id: p.id, nombre: p.nombre, detalle: `Personaje de ${p.titulo}` })),
  ];
}

// Qué función se usa para cada tipo de centro
const DESDE = { voz: desdeVoz, pelicula: desdePelicula, actor: desdeActor };
const TIPOS = Object.keys(DESDE);

/**
 * @param {string} tipo - 'voz', 'pelicula' o 'actor'
 * @param {number} id
 * @returns {object|null} el grafo, o null si no hay datos de doblaje
 */
async function obtener(tipo, id) {
    return DESDE[tipo](id);
}

module.exports = { obtener, buscar, TIPOS };
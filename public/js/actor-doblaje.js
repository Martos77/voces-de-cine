// =====================================================================
// FICHA DE ACTOR O ACTRIZ DE DOBLAJE (actor-doblaje.html?id=...)
// =====================================================================
// Se organiza de lo más reconocible a lo más completo:
//   1. Cabecera: retrato (iniciales), nombre y un panel con su
//      trayectoria, sus películas y los actores a los que da voz.
//   2. Personajes destacados: sus papeles más conocidos, con un
//      fotograma de la película. Se muestra el PERSONAJE en grande,
//      porque es lo que reconoce el público.
//   3. Voz habitual de: a quién ha doblado más veces, sin contar la
//      animación.
//   4. Filmografía: todas sus películas en un carrusel horizontal.
// =====================================================================

import {
  pedirApi, enviarApi, escapar, poster, tarjetaPelicula, parametroUrl, mostrarError,
  htmlCarrusel, activarCarruseles, iniciales,
} from './comun.js';
import { obtenerUsuario, enlaceEntrar } from './sesion.js';

const ficha = document.getElementById('ficha');

// Dirección del servidor de imágenes de TMDB
const IMAGENES_TMDB = 'https://image.tmdb.org/t/p/';

// Iconos del panel de datos (dibujados con líneas, como el logotipo)
const ICONOS = {
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  claqueta: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M4 9l2-5 14 3-1 2M9 5l2 3M14 6l2 3"/>',
  microfono: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  conexiones: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
};

/**
 * HTML de un icono SVG a partir de su nombre en ICONOS.
 */
function icono(nombre, clase) {
  return `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">${ICONOS[nombre]}</svg>`;
}

/**
 * Calcula los datos del panel a partir de sus trabajos:
 * años de la primera y la última película, número de películas y
 * número de actores originales distintos a los que ha doblado.
 */
function calcularDatos(trabajos) {
  const anios = trabajos.map((t) => t.anio).filter(Boolean);
  const desde = Math.min(...anios);
  const hasta = Math.max(...anios);

  // Set: colección sin repetidos. Su "size" es cuántos elementos distintos hay.
  const peliculas = new Set(trabajos.map((t) => t.pelicula_id)).size;
  const actores = new Set(trabajos.map((t) => t.actor_original).filter(Boolean)).size;

  return {
    trayectoria: anios.length === 0 ? '—' : (desde === hasta ? `${desde}` : `${desde} – ${hasta}`),
    peliculas,
    actores,
  };
}

/**
 * Cabecera: retrato con las iniciales, nombre, botón de conexiones
 * (todavía no disponible) y panel de datos.
 */
function htmlCabecera(actor) {
  const datos = calcularDatos(actor.trabajos);

  // Cada fila del panel: [icono, valor, descripción]
  const filas = [
    ['calendario', datos.trayectoria, 'Trayectoria en el catálogo'],
    ['claqueta', datos.peliculas, datos.peliculas === 1 ? 'Película doblada' : 'Películas dobladas'],
    ['microfono', datos.actores, datos.actores === 1 ? 'Actor al que da voz' : 'Actores a los que da voz'],
  ].map(([nombreIcono, valor, texto]) => `
    <div class="panel-datos__fila">
      ${icono(nombreIcono, 'panel-datos__icono')}
      <dt>${texto}</dt>
      <dd>${escapar(valor)}</dd>
    </div>`).join('');

  return `
    <header class="perfil">
      <span class="perfil__retrato" aria-hidden="true">${escapar(iniciales(actor.nombre))}</span>
      <div class="perfil__principal">
        <h1>${escapar(actor.nombre)}</h1>
        <p class="ficha__secundario">Actor o actriz de doblaje</p>
        ${actor.biografia ? `<p class="ficha__sinopsis">${escapar(actor.biografia)}</p>` : ''}
                <div class="perfil__acciones">
          <!-- Aquí se pondrá el botón de voz favorita -->
          <span id="voz-favorita"></span>
          <!-- Las conexiones (el grafo) se añadirán más adelante -->
          <span class="boton boton--secundario boton--pronto" aria-disabled="true" title="Próximamente">
            ${icono('conexiones', 'boton__icono')} Ver en conexiones
          </span>
        </div>
      </div>
      <!-- <dl>: lista de datos con su descripción (dt) y su valor (dd) -->
      <dl class="panel-datos">${filas}</dl>
    </header>`;
}

/**
 * Imagen de un personaje destacado. De momento es el póster de la
 * película (si no hay póster, poster() muestra un recuadro con el
 * título). Más adelante, si el personaje tiene una imagen propia, se
 * usará esa primero.
 */
function htmlImagenPersonaje(t) {
  return poster(t.poster_path, t.titulo);
}

/**
 * Personajes destacados: tarjetas horizontales con el fotograma arriba,
 * el personaje en grande y, debajo, el actor original o, si es de
 * animación, el título de la película.
 */
function htmlDestacados(destacados) {
  if (destacados.length === 0) return '';

  const tarjetas = destacados.map((t) => {
    const detalle = !t.es_animacion && t.actor_original
      ? escapar(t.actor_original)
      : `${escapar(t.titulo)}${t.anio ? ` (${t.anio})` : ''}`;
      // Si ha doblado al mismo personaje en varias películas, se indica
    const veces = t.num_peliculas > 1 ? ` · ${t.num_peliculas} películas` : '';
      return `
      <li>
        <a class="personaje-tarjeta" href="pelicula.html?id=${t.pelicula_id}">
                    ${htmlImagenPersonaje(t)}
          <span class="personaje-tarjeta__texto">
            <span class="personaje-tarjeta__nombre">${escapar(t.personaje)}</span>
            <span class="personaje-tarjeta__detalle">${detalle}${veces}</span>
          </span>
        </a>
      </li>`;
  }).join('');

  return `
    <section class="bloque">
      <h2>Personajes destacados</h2>
      <ul class="personajes">${tarjetas}</ul>
    </section>`;
}

/**
 * "Voz habitual de": los actores originales a los que más veces ha
 * doblado (sin contar la animación), en filas con su foto, nombre y
 * número de películas. Si no hay foto, se muestran sus iniciales.
 */
function htmlHabituales(habituales) {
  if (habituales.length === 0) return '';

  const filas = habituales.map((a) => {
    const foto = a.foto_path
      ? `<img src="${IMAGENES_TMDB}w185${escapar(a.foto_path)}" alt="" loading="lazy">`
      : escapar(iniciales(a.nombre));
    return `
      <li>
        <a class="fila-persona" href="actor-original.html?id=${a.id}">
          <span class="fila-persona__foto" aria-hidden="true">${foto}</span>
          <span class="fila-persona__texto">
            <span class="fila-persona__nombre">${escapar(a.nombre)}</span>
            <span class="fila-persona__dato">${a.veces === 1 ? '1 película' : `${a.veces} películas`}</span>
          </span>
        </a>
      </li>`;
  }).join('');

  return `
    <section class="bloque">
      <h2>Voz habitual de</h2>
      <ul class="filas-personas">${filas}</ul>
    </section>`;
}

/**
 * Filmografía completa en un carrusel. Solo se muestra si tiene más
 * películas de las que ya aparecen en "Personajes destacados".
 */
function htmlFilmografia(trabajos, numDestacados) {
  if (trabajos.length <= numDestacados) return '';

  // tarjetaPelicula usa el campo "id"; aquí la película viene como "pelicula_id"
  const tarjetas = trabajos
    .map((t) => tarjetaPelicula({ ...t, id: t.pelicula_id }, `Voz de ${escapar(t.personaje)}`))
    .join('');

  return `
    <section class="bloque">
      <h2>Filmografía</h2>
      ${htmlCarrusel(tarjetas, 'Filmografía')}
    </section>`;
}

// Dibujo del corazón (el mismo de la ficha de película)
const CORAZON = `
  <svg class="accion__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>
  </svg>`;

/**
 * Botón para guardar al profesional en las voces favoritas.
 * - Sin sesión: un enlace a la página de acceso.
 * - Con sesión: un botón que se activa y desactiva (aria-pressed).
 * @param {number} actorId
 */
async function cargarVozFavorita(actorId) {
  const hueco = document.getElementById('voz-favorita');
  const usuario = await obtenerUsuario();

  if (!usuario) {
    hueco.innerHTML = `<a class="accion" href="${enlaceEntrar()}">${CORAZON} Añadir a favoritas</a>`;
    return;
  }

  const ruta = `/api/usuario/voces/${actorId}`;
  const { favorita } = await pedirApi(ruta);
  hueco.innerHTML = `
    <button type="button" class="accion" data-campo="favorita" aria-pressed="${favorita}">
      ${CORAZON} Voz favorita
    </button>`;

  const boton = hueco.querySelector('button');
  boton.addEventListener('click', async () => {
    const activar = boton.getAttribute('aria-pressed') !== 'true';
    // PUT la añade y DELETE la quita; la API devuelve { favorita }
    const respuesta = await enviarApi(ruta, activar ? 'PUT' : 'DELETE');
    boton.setAttribute('aria-pressed', respuesta.favorita);
  });
}

async function iniciar() {
  const id = parametroUrl('id');
  if (!id) {
    mostrarError(ficha, 'No se ha indicado ningún profesional del doblaje.');
    return;
  }

  try {
    const actor = await pedirApi(`/api/actores-doblaje/${encodeURIComponent(id)}`);
    document.title = `${actor.nombre} · Voces de Cine`;

    ficha.innerHTML =
      htmlCabecera(actor) +
      htmlDestacados(actor.destacados) +
      htmlHabituales(actor.habituales) +
      htmlFilmografia(actor.trabajos, actor.destacados.length);

    // Las flechas del carrusel necesitan que ya exista su HTML
    activarCarruseles(ficha);
    
    // Botón de voz favorita (depende de si hay sesión)
    cargarVozFavorita(actor.id);
  } catch (error) {
    mostrarError(ficha, error.message);
  }
}

iniciar();
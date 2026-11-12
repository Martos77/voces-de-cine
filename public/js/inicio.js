// =====================================================================
// PÁGINA DE INICIO (index.html)
// =====================================================================
// Muestra las "Películas destacadas": las más populares de entre las
// que tienen doblaje registrado, que son las que mejor enseñan lo que
// ofrece la plataforma. No necesita una ruta nueva en la API: usa la
// misma del catálogo con el filtro "soloDoblaje".
// =====================================================================

  import {
  pedirApi, tarjetaPelicula, tarjetaVoz, mostrarError, escapar, poster,
  htmlCarrusel, activarCarruseles, tarjetaRecomendada,
} from './comun.js';
import { obtenerUsuario } from './sesion.js';
// Número de películas que se muestran (una fila de 4 en escritorio)
const NUM_DESTACADAS = 4;
   // Número de voces destacadas (dos filas de 3 en escritorio)
   const NUM_VOCES = 6;

const lista = document.getElementById('destacadas');

async function cargarDestacadas() {
  try {
    // Mismos parámetros que usaría el catálogo: ?soloDoblaje=1&orden=popularidad
    const datos = await pedirApi('/api/peliculas?soloDoblaje=1&orden=popularidad');

    // La API devuelve una página entera (24); nos quedamos con las primeras
    const peliculas = datos.peliculas.slice(0, NUM_DESTACADAS);

    if (peliculas.length === 0) {
      lista.innerHTML = '<li class="resumen">Todavía no hay películas con doblaje registrado.</li>';
      return;
    }

    lista.innerHTML = peliculas.map((p) => tarjetaPelicula(p)).join('');
  } catch (error) {
    mostrarError(lista, error.message);
  }
}

   /**
    * Voces destacadas: los profesionales con más películas.
    * La ruta del buscador, sin texto, ya los devuelve en ese orden.
    */
   async function cargarVocesDestacadas() {
     const listaVoces = document.getElementById('voces-destacadas');
     try {
       const voces = await pedirApi('/api/actores-doblaje');
       listaVoces.innerHTML = voces.slice(0, NUM_VOCES).map(tarjetaVoz).join('');
     } catch (error) {
       mostrarError(listaVoces, error.message);
     }
   }

   // --- Una voz, muchos personajes ------------------------------------------

// Mínimo de películas para que un profesional pueda salir en esta sección
const MIN_PELICULAS_UNA_VOZ = 2;

// Profesionales que pueden aparecer, y el que se está mostrando ahora
let candidatos = [];
let vozActual = null;

/**
 * Une una lista en una frase: ["A", "B", "C"] → "A, B y C".
 */
function unirLista(elementos) {
  if (elementos.length <= 1) return elementos.join('');
  return `${elementos.slice(0, -1).join(', ')} y ${elementos.at(-1)}`;
}

/**
 * HTML de la tarjeta de un personaje: póster, nombre del personaje en
 * grande y la película debajo. Usa los mismos estilos que los
 * "Personajes destacados" de la ficha del actor de doblaje.
 */
function tarjetaPersonaje(t) {
  // En animación no se muestra el actor original: el público reconoce
  // al personaje, no a quien lo interpreta en la versión original
  const original = !t.es_animacion && t.actor_original
    ? `<span class="destacado__original">${escapar(t.actor_original)}</span>`
    : '';

  return `
    <li class="destacado">
      <a href="pelicula.html?id=${t.pelicula_id}">
        ${poster(t.poster_path, t.titulo)}
        <span class="destacado__personaje">${escapar(t.personaje)}</span>
        ${original}
        <span class="destacado__detalle">${escapar(t.titulo)}${t.anio ? ` (${t.anio})` : ''}</span>
      </a>
    </li>`;
}

/**
 * Elige al azar un profesional distinto del que se está mostrando,
 * pide su ficha a la API y muestra sus personajes destacados.
 */
async function mostrarOtraVoz() {
  const contenedor = document.getElementById('una-voz');

  // Quitamos el actual de la lista, para que al pulsar "Otra voz" cambie
  const opciones = candidatos.filter((v) => v.id !== vozActual);
  const elegida = opciones[Math.floor(Math.random() * opciones.length)];
  vozActual = elegida.id;

  try {
    // La ficha ya trae sus personajes destacados (los 4 más relevantes)
    const actor = await pedirApi(`/api/actores-doblaje/${elegida.id}`);
    const personajes = actor.destacados.map((t) => `<strong>${escapar(t.personaje)}</strong>`);

    contenedor.innerHTML = `
      <p class="una-voz__frase">
        <a href="actor-doblaje.html?id=${actor.id}">${escapar(actor.nombre)}</a>
        es la voz de ${unirLista(personajes)}.
      </p>
            <ul class="rejilla rejilla--pequena">${actor.destacados.map(tarjetaPersonaje).join('')}</ul>`;
  } catch (error) {
    mostrarError(contenedor, error.message);
  }
}

/**
 * Prepara la sección: busca los profesionales con varias películas y
 * muestra uno. Si no hay ninguno, oculta la sección entera.
 */
async function iniciarUnaVoz() {
  const seccion = document.getElementById('seccion-una-voz');
  try {
    const voces = await pedirApi('/api/actores-doblaje');
    candidatos = voces.filter((v) => v.num_peliculas >= MIN_PELICULAS_UNA_VOZ);

    if (candidatos.length === 0) {
      seccion.hidden = true;
      return;
    }

    // Con un solo candidato, el botón "Otra voz" no tiene sentido
    document.getElementById('otra-voz').hidden = candidatos.length < 2;

    await mostrarOtraVoz();
  } catch (error) {
    mostrarError(document.getElementById('una-voz'), error.message);
  }
}

// Botón "Otra voz"
document.getElementById('otra-voz').addEventListener('click', mostrarOtraVoz);

// --- Recomendado para ti -----------------------------------------------

/**
 * Si el usuario ha iniciado sesión, muestra sus recomendaciones en un
 * carrusel. Sin sesión, la sección sigue oculta.
 */
async function cargarRecomendadas() {
  const usuario = await obtenerUsuario();
  if (!usuario) return;

  const seccion = document.getElementById('seccion-recomendadas');
  const contenedor = document.getElementById('recomendadas');
  seccion.hidden = false;
  contenedor.innerHTML = '<p class="resumen">Cargando…</p>';

  try {
    const datos = await pedirApi('/api/usuario/recomendaciones');

    // Sin historial: se explica cómo conseguir recomendaciones propias
    document.getElementById('aviso-recomendadas').hidden = datos.personalizadas;

    if (datos.peliculas.length === 0) {
      contenedor.innerHTML = '<p class="resumen">Ya tienes todo el catálogo en tus listas.</p>';
      return;
    }

    const tarjetas = datos.peliculas.map(tarjetaRecomendada).join('');
    contenedor.innerHTML = htmlCarrusel(tarjetas, 'Recomendado para ti');
    activarCarruseles(contenedor);
  } catch (error) {
    mostrarError(contenedor, error.message);
  }
}

// --- Inicio -------------------------------------------------------------
cargarRecomendadas();
cargarDestacadas();
iniciarUnaVoz();
cargarVocesDestacadas();
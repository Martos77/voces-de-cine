// =====================================================================
// FICHA DE ACTOR ORIGINAL (actor-original.html?id=...)
// =====================================================================
// Muestra quién le ha doblado en España (y cuántas veces) y sus
// películas en el catálogo, con su personaje y su voz.
// =====================================================================

import { pedirApi, escapar, tarjetaPelicula, parametroUrl, mostrarError } from './comun.js';

const ficha = document.getElementById('ficha');

/**
 * Lista de sus voces en castellano, con el nº de películas de cada una.
 */
function htmlVoces(voces) {
  if (voces.length === 0) {
    return '<p class="aviso">Todavía no hay ningún doblaje registrado para este actor.</p>';
  }

  const filas = voces.map((v) => `
    <li>
      <a href="actor-doblaje.html?id=${v.id}">
        <span class="lista-voces__nombre">${escapar(v.nombre)}</span>
        <span class="lista-voces__dato">${v.veces === 1 ? '1 película' : `${v.veces} películas`}</span>
      </a>
    </li>`).join('');

  return `
    <section class="bloque">
      <h2>Sus voces en castellano</h2>
      <ul class="lista-voces">${filas}</ul>
    </section>`;
}

/**
 * Cuadrícula con sus películas: debajo de cada una, su personaje y su voz.
 */
function htmlPeliculas(peliculas) {
  const tarjetas = peliculas.map((p) => {
    const voz = p.actor_doblaje ? `<br>Voz: ${escapar(p.actor_doblaje)}` : '';
    return tarjetaPelicula({ ...p, id: p.pelicula_id }, `${escapar(p.personaje)}${voz}`);
  }).join('');

  return `
    <section class="bloque">
      <h2>Películas</h2>
      <ul class="rejilla">${tarjetas}</ul>
    </section>`;
}

async function iniciar() {
  const id = parametroUrl('id');
  if (!id) {
    mostrarError(ficha, 'No se ha indicado ningún actor.');
    return;
  }

  try {
    const actor = await pedirApi(`/api/actores-originales/${encodeURIComponent(id)}`);
    document.title = `${actor.nombre} · Voces de Cine`;

    // La foto viene de TMDB, igual que los pósters
    const foto = actor.foto_path
      ? `<img class="ficha__foto" src="https://image.tmdb.org/t/p/w185${actor.foto_path}" alt="Fotografía de ${escapar(actor.nombre)}">`
      : '';

    ficha.innerHTML = `
      <header class="ficha__persona">
        ${foto}
        <p class="ficha__secundario">Actor o actriz original</p>
        <h1>${escapar(actor.nombre)}</h1>
      </header>
      ${htmlVoces(actor.voces)}
      ${htmlPeliculas(actor.peliculas)}`;
  } catch (error) {
    mostrarError(ficha, error.message);
  }
}

iniciar();
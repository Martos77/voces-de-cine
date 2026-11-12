// =====================================================================
// FICHA DE ACTOR O ACTRIZ ORIGINAL (actor-original.html?id=...)
// =====================================================================
// Sigue el mismo esquema que la ficha del actor de doblaje:
//   1. Cabecera: foto, nombre, su voz habitual en castellano
//      destacada y un panel con su trayectoria, sus películas y
//      cuántas voces ha tenido.
//   2. Sus voces en castellano: cada voz con una barra que muestra
//      en qué parte de sus películas le ha doblado.
//   3. Películas: cuadrícula con el personaje y la voz de cada una.
// =====================================================================

import {
  pedirApi, escapar, tarjetaPelicula, parametroUrl, mostrarError, iniciales,
} from './comun.js';

const ficha = document.getElementById('ficha');

// Dirección del servidor de imágenes de TMDB
const IMAGENES_TMDB = 'https://image.tmdb.org/t/p/';

// Iconos del panel de datos (los mismos de la ficha del actor de doblaje)
const ICONOS = {
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  claqueta: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M4 9l2-5 14 3-1 2M9 5l2 3M14 6l2 3"/>',
  estreno: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
};

function icono(nombre, clase) {
  return `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">${ICONOS[nombre]}</svg>`;
}

/**
 * Calcula los datos del panel a partir de sus películas:
 * años de la primera y la última, número de películas distintas y
 * cuántas de ellas tienen voz en castellano registrada.
 */
function calcularDatos(peliculas) {
  const anios = peliculas.map((p) => p.anio).filter(Boolean);
  const desde = Math.min(...anios);
  const hasta = Math.max(...anios);

  // Set: colección sin repetidos (un actor puede tener dos personajes en una película)
  const total = new Set(peliculas.map((p) => p.pelicula_id)).size;
  const conVoz = new Set(peliculas.filter((p) => p.actor_doblaje).map((p) => p.pelicula_id)).size;
// La primera es la más reciente: el servidor las ordena por año descendente
  const ultima = peliculas[0];

  return {
    trayectoria: anios.length === 0 ? '—' : (desde === hasta ? `${desde}` : `${desde} – ${hasta}`),
    total,
    conVoz,
    ultima: ultima ? `${ultima.titulo}${ultima.anio ? ` (${ultima.anio})` : ''}` : '—',
  };
}

/**
 * Bloque "Su voz habitual en castellano", dentro de la cabecera:
 * la voz que más veces le ha doblado, en grande y en violeta.
 */
function htmlVozPrincipal(voz, datos) {
  if (!voz) {
    return '<p class="ficha__secundario">Todavía no hay ninguna voz en castellano registrada.</p>';
  }
  return `
    <a class="voz-principal" href="actor-doblaje.html?id=${voz.id}">
      <span class="voz-principal__retrato" aria-hidden="true">${escapar(iniciales(voz.nombre))}</span>
      <span class="voz-principal__texto">
        <span class="voz-principal__etiqueta">Su voz habitual en castellano</span>
        <span class="voz-principal__nombre">${escapar(voz.nombre)}</span>
        <span class="voz-principal__dato">
          Le ha doblado en ${Math.min(voz.veces, datos.conVoz)} de ${datos.conVoz} ${datos.conVoz === 1 ? 'película' : 'películas'} con doblaje registrado
        </span>
      </span>
    </a>`;
}

/**
 * Cabecera: [foto] [nombre y voz habitual] [panel de datos]
 */
function htmlCabecera(actor) {
  const datos = calcularDatos(actor.peliculas);

  // Si no hay foto, las iniciales (como en la ficha del actor de doblaje)
  const retrato = actor.foto_path
    ? `<img class="perfil__retrato perfil__retrato--foto" src="${IMAGENES_TMDB}w342${escapar(actor.foto_path)}"
            alt="Fotografía de ${escapar(actor.nombre)}">`
    : `<span class="perfil__retrato" aria-hidden="true">${escapar(iniciales(actor.nombre))}</span>`;

  const filas = [
    ['calendario', datos.trayectoria, 'Trayectoria en el catálogo'],
    ['claqueta', datos.total, datos.total === 1 ? 'Película en el catálogo' : 'Películas en el catálogo'],
    ['estreno', datos.ultima, 'Última película en el catálogo'],
  ].map(([nombreIcono, valor, texto]) => `
    <div class="panel-datos__fila">
      ${icono(nombreIcono, 'panel-datos__icono')}
      <dt>${texto}</dt>
      <dd>${escapar(valor)}</dd>
    </div>`).join('');

  return `
    <header class="perfil">
      ${retrato}
      <div class="perfil__principal">
        <h1>${escapar(actor.nombre)}</h1>
        <p class="ficha__secundario">Actor o actriz original</p>
        ${htmlVozPrincipal(actor.voces[0], datos)}
      </div>
      <dl class="panel-datos">${filas}</dl>
    </header>`;
}

/**
 * "Sus voces en castellano": una fila por voz, con una barra que
 * muestra qué parte de sus doblajes ha hecho cada una.
 * Solo se muestra si ha tenido más de una voz (si solo tiene una,
 * ya aparece en la cabecera).
 */
function htmlVoces(voces) {
  if (voces.length < 2) return '';

  // El total de doblajes es la suma de las veces de cada voz
  const total = voces.reduce((suma, v) => suma + v.veces, 0);

  const filas = voces.map((v) => {
    const porcentaje = Math.round((v.veces / total) * 100);
    return `
      <li>
        <a class="fila-persona" href="actor-doblaje.html?id=${v.id}">
          <span class="fila-persona__foto fila-persona__foto--voz" aria-hidden="true">${escapar(iniciales(v.nombre))}</span>
          <span class="fila-persona__texto">
            <span class="fila-persona__nombre">${escapar(v.nombre)}</span>
            <span class="fila-persona__dato">${v.veces === 1 ? '1 película' : `${v.veces} películas`} · ${porcentaje} %</span>
            <span class="barra" aria-hidden="true"><span style="width: ${porcentaje}%"></span></span>
          </span>
        </a>
      </li>`;
  }).join('');

  return `
    <section class="bloque">
      <h2>Sus voces en castellano</h2>
      <ul class="filas-personas">${filas}</ul>
    </section>`;
}

/**
 * Cuadrícula con sus películas: debajo de cada una, su personaje y su voz.
 */
function htmlPeliculas(peliculas) {
  if (peliculas.length === 0) return '';

  const tarjetas = peliculas.map((p) => {
    const voz = p.actor_doblaje ? `<br>Voz: ${escapar(p.actor_doblaje)}` : '';
    return tarjetaPelicula({ ...p, id: p.pelicula_id }, `${escapar(p.personaje)}${voz}`);
  }).join('');

  return `
    <section class="bloque">
      <h2>Películas</h2>
      <ul class="rejilla rejilla--mini">${tarjetas}</ul>
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

    ficha.innerHTML = `
      ${htmlCabecera(actor)}
      ${htmlVoces(actor.voces)}
      ${htmlPeliculas(actor.peliculas)}`;
  } catch (error) {
    mostrarError(ficha, error.message);
  }
}

iniciar();
// =====================================================================
// FICHA DE PELÍCULA (pelicula.html?id=...)
// =====================================================================
// 1. Lee el id de la dirección (?id=3).
// 2. Pide la película a la API.
// 3. Muestra una cabecera con el fotograma de fondo, el póster y los
//    datos principales, y debajo tres pestañas: Información, Reparto
//    original y Reparto de doblaje (abierta por defecto si hay voces).
// 4. Si hay sesión, botones para marcar la película como favorita,
//    vista o pendiente, y estrellas para valorarla.
// 5. Al final, las películas que comparten voces con esta.
// =====================================================================

import {
  pedirApi, enviarApi, escapar, poster, tarjetaPelicula, parametroUrl, mostrarError, iniciales,
  htmlCarrusel, activarCarruseles,
} from './comun.js';
import { obtenerUsuario, enlaceEntrar } from './sesion.js';

const ficha = document.getElementById('ficha');

// Dirección del servidor de imágenes de TMDB
const IMAGENES_TMDB = 'https://image.tmdb.org/t/p/';

// Icono de onda de voz (el mismo del logotipo), para el reparto de doblaje
const ICONO_ONDA = `
  <svg class="reparto-fila__onda" viewBox="0 0 28 28" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <path d="M3 12v4M7 9v10M11 5v18M15 9v10M19 6v16M23 11v6"/>
  </svg>`;

/**
 * HTML de la cabecera: fotograma de fondo, póster, título, datos,
 * sinopsis y botones.
 * @param {object} p - la película que devuelve la API
 * @param {boolean} hayVoces - si tiene algún doblaje registrado
 */
function htmlCabecera(p, hayVoces) {
  // Línea de datos: "2014 · Ciencia ficción · Drama · 169 min".
  // filter(Boolean) quita los que no existan, para no dejar huecos.
  const datos = [
    p.anio,
    ...p.generos.map((g) => g.nombre),
    p.duracion ? `${p.duracion} min` : null,
  ].filter(Boolean);

  // El fotograma se pasa al CSS como una variable (--fondo-imagen)
  const fondo = p.fondo_path
    ? `style="--fondo-imagen: url('${IMAGENES_TMDB}w1280${escapar(p.fondo_path)}')"`
    : '';

  // El botón del reparto de doblaje solo aparece si hay voces registradas
  const botonReparto = hayVoces
    ? '<a class="boton" href="#pestanas" data-abrir="doblaje">Ver reparto de doblaje <span aria-hidden="true">▷</span></a>'
    : '';

  return `
    <header class="ficha-portada" ${fondo}>
            <div class="ficha-portada__contenido">
        ${poster(p.poster_path, p.titulo, 'w500')}
        <div>
          <h1>${escapar(p.titulo)}</h1>
          <p class="ficha-portada__datos">${datos.map(escapar).join(' · ')}</p>
          ${p.sinopsis ? `<p class="ficha__sinopsis">${escapar(p.sinopsis)}</p>` : ''}
          <div class="ficha-portada__acciones">
            ${botonReparto}
            <!-- Las conexiones (el grafo) se añadirán más adelante -->
            <span class="boton boton--secundario boton--pronto" aria-disabled="true" title="Próximamente">
              Explorar conexiones
            </span>
          </div>
          <!-- Aquí se pondrán los botones del usuario (favorita, vista...) -->
          <div class="acciones-usuario" id="acciones-usuario"></div>
        </div>
      </div>
    </header>`;
}

/**
 * Recuadro con la foto de una persona o, si no hay foto, sus iniciales.
 * @param {string|null} ruta - foto en TMDB (o null)
 * @param {string} nombre
 * @param {string} [variante] - clase extra, por ejemplo para las voces
 */
function htmlFoto(ruta, nombre, variante = '') {
  const contenido = ruta
    ? `<img src="${IMAGENES_TMDB}w185${escapar(ruta)}" alt="" loading="lazy">`
    : escapar(iniciales(nombre));
  return `<span class="reparto-fila__foto ${variante}" aria-hidden="true">${contenido}</span>`;
}

/**
 * Lado izquierdo de una fila del reparto: personaje y actor original.
 * Si conocemos al actor, es un enlace a su ficha.
 */
function htmlLadoOriginal(r) {
  const contenido = `
    ${htmlFoto(r.actor_original_foto, r.actor_original || r.personaje)}
    <span class="reparto-fila__textos">
      <span class="reparto-fila__principal">${escapar(r.personaje)}</span>
      <span class="reparto-fila__secundario">${escapar(r.actor_original || 'Actor desconocido')}</span>
    </span>`;

  return r.actor_original_id
    ? `<a class="reparto-fila__lado" href="actor-original.html?id=${r.actor_original_id}">${contenido}</a>`
    : `<span class="reparto-fila__lado">${contenido}</span>`;
}

/**
 * Pestaña "Información": los datos generales de la película.
 */
function htmlInformacion(p) {
  // Cada dato es una pareja [nombre, valor]; los vacíos no se muestran
  const datos = [
    ['Título original', p.titulo_original !== p.titulo ? p.titulo_original : null],
    ['Dirección', p.director],
    ['Año', p.anio],
    ['Duración', p.duracion ? `${p.duracion} minutos` : null],
    ['Valoración en TMDB', p.valoracion ? `${p.valoracion} / 10` : null],
  ].filter(([, valor]) => valor);

  const generos = p.generos
    .map((g) => `<span class="etiqueta">${escapar(g.nombre)}</span>`)
    .join('');

  return `
    <dl class="datos">
      ${datos.map(([nombre, valor]) => `<dt>${nombre}</dt><dd>${escapar(valor)}</dd>`).join('')}
      ${generos ? `<dt>Géneros</dt><dd class="etiquetas">${generos}</dd>` : ''}
    </dl>`;
}

/**
 * Pestaña "Reparto original": carrusel horizontal con la foto de cada
 * actor, su nombre y su personaje. Se recorre con las flechas o
 * deslizando (el mismo carrusel de la filmografía).
 */
function htmlRepartoOriginal(reparto) {
  if (reparto.length === 0) {
    return '<p class="aviso">No hay información sobre el reparto de esta película.</p>';
  }

  const tarjetas = reparto.map((r) => {
    const foto = r.actor_original_foto
      ? `<img src="${IMAGENES_TMDB}w185${escapar(r.actor_original_foto)}" alt="" loading="lazy">`
      : `<span aria-hidden="true">${escapar(iniciales(r.actor_original || r.personaje))}</span>`;
    const contenido = `
      <span class="tarjeta-reparto__foto">${foto}</span>
      <span class="tarjeta-reparto__actor">${escapar(r.actor_original || 'Actor desconocido')}</span>
      <span class="tarjeta-reparto__personaje">${escapar(r.personaje)}</span>`;
    // Si conocemos al actor, la tarjeta es un enlace a su ficha
    return r.actor_original_id
      ? `<li><a class="tarjeta-reparto" href="actor-original.html?id=${r.actor_original_id}">${contenido}</a></li>`
      : `<li><span class="tarjeta-reparto">${contenido}</span></li>`;
  }).join('');

  return `<div class="carrusel-reparto">${htmlCarrusel(tarjetas, 'Reparto original')}</div>`;
}

// Número de personajes que se ven a la vez en "Reparto de doblaje"
const POR_PAGINA_REPARTO = 8;

/**
 * Pestaña "Reparto de doblaje": cada personaje con su actor original
 * y, al otro lado de la flecha, su voz en castellano. Se muestran de 8
 * en 8, en dos columnas, con flechas para ver los siguientes.
 * @param {Array} conVoz - personajes con voz registrada
 * @param {number} sinVoz - cuántos personajes no tienen voz registrada
 */
function htmlRepartoDoblaje(conVoz, sinVoz) {
  if (conVoz.length === 0) {
    return '<p class="aviso">Todavía no hay datos de doblaje para esta película.</p>';
  }

  const filas = conVoz.map((r) => `
    <li class="reparto-fila">
      ${htmlLadoOriginal(r)}
      <span class="reparto-fila__flecha" aria-hidden="true">→</span>
      <a class="reparto-fila__lado reparto-fila__lado--voz" href="actor-doblaje.html?id=${r.actor_doblaje_id}">
        ${htmlFoto(null, r.actor_doblaje, 'reparto-fila__foto--voz')}
        <span class="reparto-fila__principal">
          <span class="visualmente-oculto">Voz en castellano: </span>${escapar(r.actor_doblaje)}
        </span>
        ${ICONO_ONDA}
      </a>
    </li>`).join('');

  // Las flechas solo hacen falta si hay más de una página
  const controles = conVoz.length > POR_PAGINA_REPARTO
    ? `<div class="reparto-paginas">
         <button type="button" class="reparto-paginas__boton" data-reparto="-1" aria-label="Personajes anteriores">&#8249;</button>
         <span class="reparto-paginas__texto" aria-live="polite"></span>
         <button type="button" class="reparto-paginas__boton" data-reparto="1" aria-label="Personajes siguientes">&#8250;</button>
       </div>`
    : '';

  const nota = sinVoz > 0
    ? `<p class="ficha__secundario">Hay ${sinVoz === 1 ? '1 personaje más' : `${sinVoz} personajes más`} sin voz registrada. Puedes verlos en «Reparto original».</p>`
    : '';

  return `
    <div class="seccion-cabecera">
      <h2>Reparto de doblaje (castellano)</h2>
      ${controles}
    </div>
    <ol class="reparto reparto--doble" id="lista-doblaje">${filas}</ol>
    ${nota}`;
}

/**
 * Hace que funcionen las flechas del reparto de doblaje: muestra los
 * personajes de la página actual (de 8 en 8) y oculta los demás.
 */
function activarPaginasReparto() {
  const lista = document.getElementById('lista-doblaje');
  const controles = ficha.querySelector('.reparto-paginas');
  if (!lista || !controles) return;   // sin doblaje, o caben en una página

  const filas = [...lista.children];
  const totalPaginas = Math.ceil(filas.length / POR_PAGINA_REPARTO);
  let pagina = 0;

    /**
   * @param {number} direccion - 1 si se avanza, -1 si se retrocede,
   *                             0 al cargar la página (sin animación)
   */
  function mostrarPagina(direccion = 0) {
    // Math.floor(i / 8) es la página en la que está cada fila: 0, 0... 1, 1...
    filas.forEach((fila, i) => {
      fila.hidden = Math.floor(i / POR_PAGINA_REPARTO) !== pagina;
      // Posición dentro de su página (0 a 7), para que entren una detrás de otra
      fila.style.setProperty('--orden', i % POR_PAGINA_REPARTO);
    });
    const desde = pagina * POR_PAGINA_REPARTO + 1;
    const hasta = Math.min(desde + POR_PAGINA_REPARTO - 1, filas.length);
    controles.querySelector('.reparto-paginas__texto').textContent = `${desde}–${hasta} de ${filas.length}`;
    controles.querySelector('[data-reparto="-1"]').disabled = pagina === 0;
    controles.querySelector('[data-reparto="1"]').disabled = pagina === totalPaginas - 1;

    if (direccion !== 0) {
      // Las filas entran por el lado hacia el que se avanza
      lista.dataset.direccion = direccion > 0 ? 'siguiente' : 'anterior';
      // Para repetir una animación CSS hay que quitar la clase, obligar
      // al navegador a "darse cuenta" (leer offsetWidth) y volver a ponerla
      lista.classList.remove('reparto--animando');
      void lista.offsetWidth;
      lista.classList.add('reparto--animando');
    }
  }

  controles.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-reparto]');
    if (!boton) return;
    const direccion = Number(boton.dataset.reparto);
    pagina += direccion;
    mostrarPagina(direccion);
  });

  mostrarPagina();
}

/**
 * Las tres pestañas con su contenido. Se abre la del reparto de
 * doblaje si hay voces; si no, la del reparto original.
 */
function htmlPestanas(p, conVoz) {
  const pestanas = [
    { id: 'info', titulo: 'Información', contenido: htmlInformacion(p) },
    { id: 'original', titulo: 'Reparto original', contenido: htmlRepartoOriginal(p.reparto) },
    { id: 'doblaje', titulo: 'Reparto de doblaje', contenido: htmlRepartoDoblaje(conVoz, p.reparto.length - conVoz.length) },
  ];
  const abierta = conVoz.length > 0 ? 'doblaje' : 'original';

  // Botones de las pestañas. role="tab", aria-selected y aria-controls
  // indican a los lectores de pantalla qué pestaña está abierta y qué
  // panel muestra cada una.
  const botones = pestanas.map((t) => `
    <button type="button" role="tab" id="pestana-${t.id}" aria-controls="panel-${t.id}"
            aria-selected="${t.id === abierta}" tabindex="${t.id === abierta ? 0 : -1}">${t.titulo}</button>`).join('');

  // Paneles: solo se ve el de la pestaña abierta (los demás, hidden)
  const paneles = pestanas.map((t) => `
    <div role="tabpanel" id="panel-${t.id}" aria-labelledby="pestana-${t.id}" ${t.id === abierta ? '' : 'hidden'}>
      ${t.contenido}
    </div>`).join('');

  return `
    <section class="pestanas" id="pestanas">
      <div class="pestanas__lista" role="tablist" aria-label="Información de la película">${botones}</div>
      ${paneles}
    </section>`;
}

/**
 * Abre una pestaña: la marca como seleccionada y muestra su panel.
 * @param {string} id - 'info', 'original' o 'doblaje'
 */
function abrirPestana(id) {
  for (const boton of ficha.querySelectorAll('[role="tab"]')) {
    const esta = boton.id === `pestana-${id}`;
    boton.setAttribute('aria-selected', esta);
    boton.tabIndex = esta ? 0 : -1;
    document.getElementById(boton.getAttribute('aria-controls')).hidden = !esta;
  }
}

/**
 * Hace que funcionen las pestañas: con el ratón (clic) y con el
 * teclado (flechas izquierda y derecha), como recomiendan las pautas
 * de accesibilidad para este tipo de componente.
 */
function activarPestanas() {
  const botones = [...ficha.querySelectorAll('[role="tab"]')];

  ficha.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[role="tab"]');
    if (boton) abrirPestana(boton.id.replace('pestana-', ''));

    // Botón "Ver reparto de doblaje" de la cabecera
    const enlace = evento.target.closest('[data-abrir]');
    if (enlace) abrirPestana(enlace.dataset.abrir);
  });

  ficha.addEventListener('keydown', (evento) => {
    const actual = evento.target.closest('[role="tab"]');
    if (!actual || !['ArrowLeft', 'ArrowRight'].includes(evento.key)) return;
    const paso = evento.key === 'ArrowRight' ? 1 : -1;
    // % botones.length: después de la última pestaña vuelve a la primera
    const siguiente = botones[(botones.indexOf(actual) + paso + botones.length) % botones.length];
    abrirPestana(siguiente.id.replace('pestana-', ''));
    siguiente.focus();
  });
}

// --- Acciones del usuario: favorita, vista, pendiente y valoración ---------

// Botones de las acciones: [campo, texto, dibujo del icono]
const ACCIONES = [
  ['favorita', 'Favorita', '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'],
  ['vista', 'Vista', '<path d="M5 12l5 5 9-10"/>'],
  ['pendiente', 'Pendiente', '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'],
];

/**
 * HTML de los botones y las estrellas. Su estado (pulsado o no, cuántas
 * estrellas) lo pone después aplicarEstado().
 * - Los botones usan aria-pressed: un lector de pantalla anuncia
 *   "Favorita, botón, activado" o "desactivado".
 * - Las estrellas son botones de opción (radio) dentro de un <fieldset>:
 *   se pueden elegir con el ratón o con las flechas del teclado.
 */
function htmlAcciones() {
  const botones = ACCIONES.map(([campo, texto, dibujo]) => `
    <button type="button" class="accion" data-campo="${campo}" aria-pressed="false">
      <svg class="accion__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dibujo}</svg>
      ${texto}
    </button>`).join('');

  let estrellas = '';
  for (let n = 1; n <= 5; n++) {
    estrellas += `
      <input type="radio" class="visualmente-oculto" id="estrella-${n}" name="valoracion" value="${n}">
      <label for="estrella-${n}" title="${n} de 5">
        <span aria-hidden="true">★</span><span class="visualmente-oculto">${n} de 5 estrellas</span>
      </label>`;
  }

  return `
    <div class="acciones-usuario__botones">${botones}</div>
    <fieldset class="estrellas">
      <legend class="estrellas__titulo">Tu valoración</legend>
      <div class="estrellas__grupo">${estrellas}</div>
      <button type="button" class="estrellas__quitar" data-quitar hidden>Quitar</button>
    </fieldset>
    <p class="acciones-usuario__error" role="alert"></p>`;
}

/**
 * Pone en los botones y las estrellas el estado que devuelve la API.
 * Se cambian solo los atributos (no se vuelve a escribir el HTML), para
 * que quien use el teclado no pierda el punto en el que estaba.
 * @param {HTMLElement} hueco
 * @param {object} estado - { vista, favorita, pendiente, valoracion }
 */
function aplicarEstado(hueco, estado) {
  for (const boton of hueco.querySelectorAll('[data-campo]')) {
    boton.setAttribute('aria-pressed', estado[boton.dataset.campo]);
  }
  for (const estrella of hueco.querySelectorAll('input[name="valoracion"]')) {
    estrella.checked = Number(estrella.value) === estado.valoracion;
    // "llena": las estrellas hasta la valoración se pintan en violeta
    estrella.nextElementSibling.classList.toggle('llena', Number(estrella.value) <= (estado.valoracion ?? 0));
  }
  hueco.querySelector('[data-quitar]').hidden = estado.valoracion === null;
}

/**
 * Muestra las acciones del usuario en la cabecera de la ficha.
 * Sin sesión, invita a entrar.
 * @param {number} peliculaId
 */
async function cargarAccionesUsuario(peliculaId) {
  const hueco = document.getElementById('acciones-usuario');
  const usuario = await obtenerUsuario();

  if (!usuario) {
    hueco.innerHTML = `
      <p class="acciones-usuario__invitacion">
        <a href="${enlaceEntrar()}">Entra</a> para guardar esta película en favoritas, marcarla como vista o valorarla.
      </p>`;
    return;
  }

  const ruta = `/api/usuario/peliculas/${peliculaId}`;
  hueco.innerHTML = htmlAcciones();
  aplicarEstado(hueco, await pedirApi(ruta));

  const error = hueco.querySelector('.acciones-usuario__error');

  // Envía un cambio a la API y pone el estado que devuelve
  async function guardar(cambios) {
    error.textContent = '';
    try {
      aplicarEstado(hueco, await enviarApi(ruta, 'PUT', cambios));
    } catch (e) {
      error.textContent = e.message;
    }
  }

  // Botones: cambian su campo al valor contrario (activado ↔ desactivado)
  hueco.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-campo]');
    if (boton) {
      guardar({ [boton.dataset.campo]: boton.getAttribute('aria-pressed') !== 'true' });
    }
    if (evento.target.closest('[data-quitar]')) guardar({ valoracion: null });
  });

  // Estrellas: al elegir una, se guarda la valoración
  hueco.addEventListener('change', (evento) => {
    if (evento.target.name === 'valoracion') {
      guardar({ valoracion: Number(evento.target.value) });
    }
  });
}

/**
 * Pide las películas con voces en común y añade su bloque al final
 * de la ficha. Si no hay ninguna, no se muestra nada.
 * @param {number} id - id de la película actual
 */
async function cargarVocesCompartidas(id) {
  const peliculas = await pedirApi(`/api/peliculas/${id}/voces-compartidas`);
  if (peliculas.length === 0) return;

  // Texto bajo cada tarjeta, por ejemplo: "2 voces en común: Voz 1, Voz 2"
  const tarjetas = peliculas.map((p) => {
    const cuantas = p.voces_en_comun === 1 ? '1 voz' : `${p.voces_en_comun} voces`;
    return tarjetaPelicula(p, `${cuantas} en común: ${escapar(p.voces)}`);
  }).join('');

  // Creamos la sección y la añadimos al final de la ficha
  const seccion = document.createElement('section');
  seccion.className = 'bloque';
  seccion.innerHTML = `
    <h2>Con las mismas voces</h2>
    <p class="ficha__secundario">Películas en las que también trabajan profesionales del doblaje de esta.</p>
    <ul class="rejilla rejilla--pequena">${tarjetas}</ul>`;
  ficha.append(seccion);
}

/**
 * Averigua qué película hay que mostrar:
 *   - pelicula.html?id=3     → la película 3 de nuestro catálogo.
 *   - pelicula.html?tmdb=862 → una película de TMDB que aún no está en el
 *     catálogo: primero se añade y después se usa su nuevo id.
 * @returns {string|number|null} el id en nuestra base de datos, o null
 */
async function obtenerIdPelicula() {
  const id = parametroUrl('id');
  if (id) return id;

  const tmdbId = parametroUrl('tmdb');
  if (!tmdbId) return null;

  ficha.innerHTML = '<p class="resumen">Añadiendo la película al catálogo…</p>';
  const respuesta = await pedirApi(`/api/tmdb/importar/${encodeURIComponent(tmdbId)}`, { method: 'POST' });

  // Cambiamos la dirección a ?id=..., sin recargar la página.
  // replaceState (y no pushState) para que el botón "atrás" no vuelva a
  // la dirección de importar.
  history.replaceState(null, '', `pelicula.html?id=${respuesta.id}`);
  return respuesta.id;
}

/**
 * Punto de partida: carga la película y la muestra.
 */
async function iniciar() {
  try {
    const id = await obtenerIdPelicula();

    // Si se abre pelicula.html sin ?id= ni ?tmdb=, no hay nada que mostrar
    if (!id) {
      mostrarError(ficha, 'No se ha indicado ninguna película. Vuelve al catálogo y elige una.');
      return;
    }

    const pelicula = await pedirApi(`/api/peliculas/${encodeURIComponent(id)}`);

    // Ponemos el título de la película en la pestaña del navegador
    document.title = `${pelicula.titulo} · Voces de Cine`;

    // Personajes con voz registrada (la API ya los envía primero)
    const conVoz = pelicula.reparto.filter((r) => r.actor_doblaje_id);

    ficha.innerHTML = htmlCabecera(pelicula, conVoz.length > 0) + htmlPestanas(pelicula, conVoz);
    activarPestanas();
    activarCarruseles(ficha);    // flechas del reparto original
    activarPaginasReparto();     // flechas del reparto de doblaje

        // Botones del usuario (no hace falta esperar a que terminen)
    cargarAccionesUsuario(pelicula.id);

    // Después de mostrar la ficha, cargamos las películas relacionadas
    await cargarVocesCompartidas(pelicula.id);
  } catch (error) {
    // Por ejemplo, si la película no existe (error 404 de la API)
    mostrarError(ficha, error.message);
  }
}

iniciar();
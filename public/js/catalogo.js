// =====================================================================
// PÁGINA DEL CATÁLOGO (catalogo.html)
// =====================================================================
// 1. Al cargar, rellena el desplegable de géneros y copia en el
//    formulario los filtros que haya en la dirección (?genero=16...).
// 2. Pide a la API las películas de la página actual que cumplen esos
//    filtros y las muestra, junto con los botones de paginación.
// 3. Al buscar o cambiar de página, guarda los filtros y la página en
//    la dirección y vuelve a cargar los resultados, sin recargar.
// 4. Si se busca un título, ofrece buscarlo también en TMDB, para
//    encontrar películas que aún no están en el catálogo. Si no hay
//    ningún resultado propio, la búsqueda en TMDB se hace directamente.
//
// Guardar todo en la dirección permite usar el botón "atrás" del
// navegador y compartir una búsqueda copiando el enlace.
// =====================================================================

import { pedirApi, tarjetaPelicula, mostrarError, escapar, poster } from './comun.js';

const formulario = document.getElementById('filtros');
const selectGenero = document.getElementById('genero');
const resumen = document.getElementById('resumen');
const resultados = document.getElementById('resultados');
const paginacion = document.getElementById('paginacion');
const externos = document.getElementById('externos');

/**
 * Añade al desplegable una opción por cada género de la base de datos.
 */
async function cargarGeneros() {
  const generos = await pedirApi('/api/generos');
  for (const genero of generos) {
    const opcion = document.createElement('option');
    opcion.value = genero.id;
    opcion.textContent = genero.nombre; // textContent es seguro frente a XSS
    selectGenero.append(opcion);
  }
}

/**
 * Copia los filtros de la dirección a los campos del formulario,
 * para que el usuario vea qué filtros están aplicados.
 */
function direccionAFormulario() {
  const parametros = new URLSearchParams(window.location.search);

  for (const campo of formulario.elements) {
    if (!campo.name) continue; // los botones no tienen name
    const valor = parametros.get(campo.name);

    if (campo.type === 'checkbox') {
      campo.checked = valor === '1';
    } else if (campo.name === 'orden') {
      campo.value = valor || 'popularidad';
    } else {
      campo.value = valor ?? '';
    }
  }

   // Si hay algún filtro del panel "Más filtros" aplicado, lo abrimos
  // para que se vea (los demás filtros ya están siempre a la vista)
  const avanzados = ['anioDesde', 'anioHasta', 'director', 'actor'];
  if (avanzados.some((nombre) => parametros.get(nombre))) {
    formulario.querySelector('details').open = true;
  }
}

/**
 * Convierte el formulario en parámetros de dirección, sin los vacíos.
 * Si la página es mayor que 1, la añade. Por ejemplo: texto=toy&pagina=2
 * @param {number} pagina
 */
function formularioAParametros(pagina = 1) {
  const parametros = new URLSearchParams();
  for (const [nombre, valor] of new FormData(formulario)) {
    if (valor !== '') parametros.set(nombre, valor);
  }
  if (pagina > 1) parametros.set('pagina', pagina);
  return parametros;
}

// --- Resultados de TMDB -------------------------------------------------

/**
 * HTML de la tarjeta de una película de TMDB que aún no está en el
 * catálogo. Enlaza a pelicula.html?tmdb=..., que la añade al abrirla.
 */
function tarjetaExterna(p) {
  return `
    <li class="tarjeta">
      <a href="pelicula.html?tmdb=${p.tmdbId}">
        ${poster(p.posterPath, p.titulo)}
        <span class="tarjeta__titulo">${escapar(p.titulo)}</span>
        <span class="tarjeta__dato">${escapar(p.anio ?? '')}</span>
      </a>
    </li>`;
}

/**
 * Busca el título en TMDB y muestra las películas que aún no están en
 * el catálogo (las que ya están ya aparecen en los resultados normales).
 * @param {string} textoBuscado
 */
async function cargarExternos(textoBuscado) {
  externos.hidden = false;
  externos.innerHTML = '<p class="resumen">Buscando en TMDB…</p>';
  try {
    const encontradas = await pedirApi(`/api/tmdb/buscar?texto=${encodeURIComponent(textoBuscado)}`);
    const nuevas = encontradas.filter((p) => p.id === null);

    if (nuevas.length === 0) {
      externos.innerHTML = `<p class="resumen">TMDB no tiene más películas que coincidan con «${escapar(textoBuscado)}».</p>`;
      return;
    }

    externos.innerHTML = `
      <h2>Más resultados en TMDB</h2>
      <p class="ficha__secundario">Estas películas aún no están en el catálogo. Al abrir una, se añadirá automáticamente.</p>
      <ul class="rejilla">${nuevas.map(tarjetaExterna).join('')}</ul>`;
  } catch (error) {
    mostrarError(externos, error.message);
  }
}

/**
 * Muestra el botón para buscar en TMDB (cuando sí hay resultados
 * propios, pero puede que la película buscada no esté entre ellos).
 */
function ofrecerExternos() {
  externos.hidden = false;
  externos.innerHTML = `
    <button type="button" class="boton boton--secundario" id="buscar-tmdb">
      ¿No está la que buscas? Buscar en TMDB
    </button>`;
}

/**
 * Oculta y vacía la sección de resultados de TMDB.
 */
function ocultarExternos() {
  externos.hidden = true;
  externos.innerHTML = '';
}

// --- Catálogo -----------------------------------------------------------

/**
 * Pide las películas de la página actual y las muestra.
 * Si se ha buscado un título, ofrece (o hace) la búsqueda en TMDB.
 */
async function cargarPeliculas() {
  resumen.textContent = 'Cargando…';
  ocultarExternos();

  // Título buscado (o null si no se ha buscado ninguno)
  const textoBuscado = new URLSearchParams(window.location.search).get('texto');

  try {
    const datos = await pedirApi('/api/peliculas' + window.location.search);

    if (datos.total === 0) {
      resumen.textContent = 'Ninguna película del catálogo coincide con estos filtros.';
      resultados.innerHTML = '';
      paginacion.innerHTML = '';
      // Si se buscaba un título, lo buscamos directamente en TMDB
      if (textoBuscado) cargarExternos(textoBuscado);
      return;
    }

    // toLocaleString('es-ES') escribe los miles con punto: 1.234
    const total = datos.total.toLocaleString('es-ES');
    resumen.textContent = datos.total === 1 ? '1 película' : `${total} películas`;

    resultados.innerHTML = datos.peliculas
      .map((p) => tarjetaPelicula(p, p.tiene_doblaje ? '<span class="sello">Con doblaje</span>' : ''))
      .join('');

    pintarPaginacion(datos.pagina, datos.totalPaginas);

    // Hay resultados, pero quizá no el que se buscaba: ofrecemos TMDB
    if (textoBuscado) ofrecerExternos();
  } catch (error) {
    resumen.textContent = '';
    paginacion.innerHTML = '';
    mostrarError(resultados, error.message);
  }
}

/**
 * Números de página que se muestran: la primera, la última, la actual
 * y sus vecinas. Donde se salta algún número se pone "…".
 * Por ejemplo, en la página 5 de 44: [1, "…", 4, 5, 6, "…", 44]
 */
function numerosPagina(actual, total) {
  // Set: sin repetidos (en la página 1, "actual" y "primera" coinciden)
  const numeros = [...new Set([1, actual - 1, actual, actual + 1, total])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);

  const resultado = [];
  numeros.forEach((n, i) => {
    if (i > 0 && n - numeros[i - 1] > 1) resultado.push('…');
    resultado.push(n);
  });
  return resultado;
}

/**
 * Pinta la paginación: flecha anterior, números de página y flecha
 * siguiente. Si solo hay una página, no muestra nada. Cada botón
 * guarda en data-pagina el número de página al que lleva.
 */
function pintarPaginacion(pagina, totalPaginas) {
  if (totalPaginas <= 1) {
    paginacion.innerHTML = '';
    return;
  }

  const numeros = numerosPagina(pagina, totalPaginas).map((n) => {
    if (n === '…') return '<span class="paginacion__puntos" aria-hidden="true">…</span>';
    // aria-current="page" marca la página actual (el CSS la pinta en violeta)
    return n === pagina
      ? `<button class="paginacion__boton" aria-current="page" disabled>${n}</button>`
      : `<button class="paginacion__boton" data-pagina="${n}" aria-label="Página ${n}">${n}</button>`;
  }).join('');

  paginacion.innerHTML = `
    <button class="paginacion__boton" data-pagina="${pagina - 1}" aria-label="Página anterior"
            ${pagina === 1 ? 'disabled' : ''}>‹</button>
    ${numeros}
    <button class="paginacion__boton" data-pagina="${pagina + 1}" aria-label="Página siguiente"
            ${pagina === totalPaginas ? 'disabled' : ''}>›</button>`;
}

/**
 * Cambia la dirección (sin recargar la página) y vuelve a cargar.
 * history.pushState añade una entrada al historial del navegador,
 * para que el botón "atrás" lleve a la página o búsqueda anterior.
 */
function navegar(parametros) {
  const consulta = parametros.toString();
  history.pushState(null, '', consulta ? '?' + consulta : window.location.pathname);
  cargarPeliculas();
}

// --- Eventos ------------------------------------------------------------

// "Buscar": una búsqueda nueva siempre empieza en la página 1
formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  navegar(formularioAParametros(1));
});

// Los desplegables y la casilla se aplican en cuanto se cambian.
// requestSubmit() hace lo mismo que pulsar un botón de enviar: lanza el
// evento "submit" de arriba. Los campos de texto no: esos se aplican al
// pulsar Intro o el botón "Aplicar".
formulario.addEventListener('change', (evento) => {
  if (evento.target.matches('select, input[type="checkbox"]')) {
    formulario.requestSubmit();
  }
});

// "Limpiar": el navegador vacía el formulario solo. setTimeout espera a
// que termine de vaciarlo antes de volver a cargar sin filtros.
formulario.addEventListener('reset', () => {
  setTimeout(() => navegar(new URLSearchParams()), 0);
});

// Botones de paginación. Usamos un solo "escuchador" en el contenedor:
// closest() averigua si el clic ha sido en uno de los botones.
paginacion.addEventListener('click', (evento) => {
  const boton = evento.target.closest('button[data-pagina]');
  if (!boton) return;
  navegar(formularioAParametros(Number(boton.dataset.pagina)));
  window.scrollTo({ top: 0 }); // volvemos arriba para ver la nueva página
});

// Botón "Buscar en TMDB"
externos.addEventListener('click', (evento) => {
  if (!evento.target.closest('#buscar-tmdb')) return;
  const textoBuscado = new URLSearchParams(window.location.search).get('texto');
  cargarExternos(textoBuscado);
});

// Botones "atrás" y "adelante" del navegador
window.addEventListener('popstate', () => {
  direccionAFormulario();
  cargarPeliculas();
});

// --- Inicio -------------------------------------------------------------
await cargarGeneros().catch(() => {});
direccionAFormulario();
cargarPeliculas();
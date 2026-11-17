// =====================================================================
// CONEXIONES (conexiones.html?tipo=voz&id=12)
// =====================================================================
// Dibuja con D3.js el grafo de voces, películas y actores alrededor de
// un elemento central, y muestra en un panel los datos del círculo
// seleccionado.
//   - Un clic (o Intro con el teclado) selecciona un círculo.
//   - Doble clic (o el botón «Explorar desde aquí») lo pone en el centro.
//   - Se puede arrastrar cada círculo, y mover y ampliar el grafo.
// D3 se carga en conexiones.html con una etiqueta <script> normal, así
// que está disponible como variable global (window.d3).
// =====================================================================

import { pedirApi, escapar, mostrarError, parametroUrl } from './comun.js';

const d3 = window.d3;
const contenedor = document.getElementById('grafo');
const panel = document.getElementById('panel');

// Datos de cada tipo de nodo: cómo se llama y dónde está su ficha
const TIPOS = {
  voz: { nombre: 'Voz en castellano', ficha: 'actor-doblaje.html' },
  pelicula: { nombre: 'Película', ficha: 'pelicula.html' },
  actor: { nombre: 'Actor o actriz original', ficha: 'actor-original.html' },
  // Los personajes de animación no tienen ficha propia: llevan a su película
  personaje: { nombre: 'Personaje de animación', ficha: 'pelicula.html' },
};

// Fotos de los actores originales (servidor de imágenes de TMDB)
const IMAGENES_TMDB = 'https://image.tmdb.org/t/p/w185';

// Distancia mínima entre los anillos: el centro está en el anillo 0,
// sus conexiones directas en el 1, las de estas en el 2...
const DISTANCIA_ANILLO = 130;

// Espacio que necesita cada círculo del anillo exterior (con su nombre)
const ESPACIO_POR_NODO = 46;

// Grafo que se está mostrando (lo guardamos para el panel)
let grafoActual = null;
let simulacion = null;

// --- Cargar un grafo ----------------------------------------------------

/**
 * Pide a la API el grafo de un elemento y lo dibuja.
 * @param {boolean} guardar - si se añade a la historia del navegador
 *        (así el botón "Atrás" vuelve al grafo anterior)
 */
async function cargar(tipo, id, guardar = true) {
  contenedor.innerHTML = '<p class="resumen">Cargando…</p>';
  try {
    const grafo = await pedirApi(`/api/conexiones?tipo=${encodeURIComponent(tipo)}&id=${encodeURIComponent(id)}`);
    if (guardar) history.pushState({ tipo, id }, '', `?tipo=${tipo}&id=${id}`);
    document.title = `Conexiones de ${grafo.centro.nombre} · Voces de Cine`;
    dibujar(grafo);
  } catch (error) {
    mostrarError(contenedor, error.message);
    panel.innerHTML = '';
  }
}

// --- Dibujar el grafo ---------------------------------------------------

/**
 * Tamaño de cada círculo: el centro, el más grande; las voces crecen
 * según con cuántos elementos están conectadas.
 */
function radio(nodo) {
  if (nodo.id === grafoActual.centro.id) return 26;
  if (nodo.tipo === 'pelicula') return 15;
  if (nodo.tipo === 'actor') return 18;        // más grande, para que se vea la foto
  if (nodo.tipo === 'personaje') return 12;
  return 7 + Math.min(nodo.grado, 5) * 2;
}

/**
 * Qué nombres se escriben siempre: el centro, las películas, los
 * actores y las voces que conectan varias cosas. El resto, al
 * seleccionarlos (si no, el grafo se llenaría de texto).
 */
function conEtiqueta(nodo) {
  return nodo.nivel <= 2 || nodo.tipo !== 'voz' || nodo.grado > 1;
}

/**
 * Coloca los nodos en anillos alrededor del centro, como un árbol
 * radial (calcula su "nivel" y su posición objetivo tx, ty):
 *   1. Recorrido en anchura desde el centro: nivel de cada nodo (a
 *      cuántos pasos está) y su "padre" (por dónde se ha llegado a él).
 *   2. Cada nodo recibe un trozo del círculo (un ángulo) proporcional
 *      a cuántos nodos cuelgan de él, y sus hijos se reparten ese
 *      trozo. Así cada rama ocupa su propia zona y casi no se cruzan.
 * @returns {number} distancia entre anillos (para dibujar las guías)
 */
function calcularDisposicion(grafo, porId) {
  const vecinosDe = new Map(grafo.nodos.map((n) => [n.id, []]));
  for (const e of grafo.enlaces) {
    vecinosDe.get(e.source).push(e.target);
    vecinosDe.get(e.target).push(e.source);
  }

  // 1. Recorrido en anchura (con una cola)
  const centro = porId.get(grafo.centro.id);
  for (const n of grafo.nodos) {
    n.nivel = Infinity;
    n.hijos = [];
  }
  centro.nivel = 0;
  const cola = [centro];
  while (cola.length > 0) {
    const actual = cola.shift();
    for (const id of vecinosDe.get(actual.id)) {
      const vecino = porId.get(id);
      if (vecino.nivel === Infinity) {
        vecino.nivel = actual.nivel + 1;
        actual.hijos.push(vecino);
        cola.push(vecino);
      }
    }
  }

  // 2. Hojas que cuelgan de cada nodo (las que no tienen hijos cuentan 1)
  function contarHojas(nodo) {
    nodo.hojas = nodo.hijos.length === 0 ? 1 : nodo.hijos.reduce((suma, h) => suma + contarHojas(h), 0);
    return nodo.hojas;
  }
  contarHojas(centro);

  // Separación entre anillos: la mínima, o más si en el exterior no caben
  const nivelMaximo = d3.max(grafo.nodos, (n) => n.nivel);
  const distancia = Math.max(DISTANCIA_ANILLO, (centro.hojas * ESPACIO_POR_NODO) / (2 * Math.PI * nivelMaximo));

  // Reparto de ángulos: cada hijo recibe un trozo proporcional a sus hojas
  function repartir(nodo, desde, hasta) {
    const angulo = (desde + hasta) / 2;
    nodo.tx = Math.cos(angulo) * nodo.nivel * distancia;
    nodo.ty = Math.sin(angulo) * nodo.nivel * distancia;
    let inicio = desde;
    for (const hijo of nodo.hijos) {
      const fin = inicio + ((hasta - desde) * hijo.hojas) / nodo.hojas;
      repartir(hijo, inicio, fin);
      inicio = fin;
    }
  }
  repartir(centro, -Math.PI / 2, (3 * Math.PI) / 2);   // empezando por arriba

  // Los nodos empiezan ya en su sitio
  for (const n of grafo.nodos) {
    n.x = n.tx;
    n.y = n.ty;
  }
  return distancia;
}

/**
 * Ajusta el zoom para que se vea el grafo entero, con un margen.
 */
function encuadrar(svg, zoom, nodos, ancho, alto) {
  const margen = 50;
  const xs = nodos.map((n) => n.x);
  const ys = nodos.map((n) => n.y);
  const [minX, maxX] = [Math.min(...xs) - margen, Math.max(...xs) + margen];
  const [minY, maxY] = [Math.min(...ys) - margen, Math.max(...ys) + margen];

  // La escala que hace caber el grafo (sin pasar de 1,5 si es pequeño)
  const escala = Math.min(1.5, ancho / (maxX - minX), alto / (maxY - minY));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  svg.call(zoom.transform, d3.zoomIdentity.scale(escala).translate(-cx, -cy));
}

function dibujar(grafo) {
  grafoActual = grafo;
  if (simulacion) simulacion.stop();
  contenedor.innerHTML = '';

  // Cuántas conexiones tiene cada nodo (su "grado")
  for (const n of grafo.nodos) n.grado = 0;
  const porId = new Map(grafo.nodos.map((n) => [n.id, n]));
  for (const e of grafo.enlaces) {
    porId.get(e.source).grado++;
    porId.get(e.target).grado++;
  }
  const distancia = calcularDisposicion(grafo, porId);

  const ancho = contenedor.clientWidth;
  const alto = contenedor.clientHeight;

  const svg = d3.select(contenedor)
    .append('svg')
    .attr('viewBox', [-ancho / 2, -alto / 2, ancho, alto])
    .attr('aria-label', `Grafo de conexiones de ${grafo.centro.nombre}`);

  // Molde circular para recortar las fotos (objectBoundingBox: se
  // adapta al tamaño de cada imagen)
  svg.append('defs')
    .append('clipPath')
    .attr('id', 'recorte-circulo')
    .attr('clipPathUnits', 'objectBoundingBox')
    .append('circle')
    .attr('cx', 0.5).attr('cy', 0.5).attr('r', 0.5);

  // Todo va dentro de un grupo <g> para poder moverlo y ampliarlo (zoom)
  const lienzo = svg.append('g');
  const zoom = d3.zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (evento) => lienzo.attr('transform', evento.transform));
  svg.call(zoom);

  // Anillos de fondo (guías): uno por cada nivel que haya
  const niveles = d3.max(grafo.nodos, (n) => n.nivel);
  lienzo.append('g')
    .selectAll('circle')
    .data(d3.range(1, niveles + 1))
    .join('circle')
    .attr('class', 'anillo')
    .attr('r', (nivel) => nivel * distancia);

  // Líneas (enlaces)
  const lineas = lienzo.append('g')
    .attr('class', 'enlaces')
    .selectAll('line')
    .data(grafo.enlaces)
    .join('line')
    .attr('class', 'enlace');

  // Círculos con su nombre (nodos)
  const nodos = lienzo.append('g')
    .selectAll('g')
    .data(grafo.nodos)
    .join('g')
    .attr('class', (n) => `nodo nodo--${n.tipo}${n.id === grafo.centro.id ? ' nodo--centro' : ''}`)
    .attr('tabindex', 0)                       // se puede llegar con el tabulador
    .attr('role', 'button')
    .attr('aria-label', (n) => `${TIPOS[n.tipo].nombre}: ${n.nombre}`)
    .on('click', (evento, n) => seleccionar(n))
    .on('dblclick', (evento, n) => explorar(n))
    .on('keydown', (evento, n) => {
      if (evento.key === 'Enter') seleccionar(n);
    });

  nodos.append('circle').attr('r', radio);

  // Foto de los actores originales, recortada en círculo (si la hay)
  nodos.filter((n) => n.tipo === 'actor' && n.foto_path)
    .append('image')
    .attr('href', (n) => `${IMAGENES_TMDB}${n.foto_path}`)
    .attr('x', (n) => -(radio(n) - 2))
    .attr('y', (n) => -(radio(n) - 2))
    .attr('width', (n) => (radio(n) - 2) * 2)
    .attr('height', (n) => (radio(n) - 2) * 2)
    .attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('clip-path', 'url(#recorte-circulo)');

  nodos.append('text')
    .attr('class', (n) => `nodo__nombre${conEtiqueta(n) ? '' : ' nodo__nombre--oculto'}`)
    .attr('y', (n) => radio(n) + 14)
    .text((n) => n.nombre);

  // El nodo central se queda fijo en el centro
  const centro = porId.get(grafo.centro.id);
  centro.fx = 0;
  centro.fy = 0;

  // Simulación física: cada nodo es atraído hacia su sitio en el
  // anillo (tx, ty) y los círculos no se pueden pisar
  simulacion = d3.forceSimulation(grafo.nodos)
    .force('enlace', d3.forceLink(grafo.enlaces).id((n) => n.id).strength(0))
    .force('x', d3.forceX((n) => n.tx).strength(0.5))
    .force('y', d3.forceY((n) => n.ty).strength(0.5))
    .force('choque', d3.forceCollide().radius((n) => radio(n) + 14))
    .stop();

  // Calculamos la posición final antes de dibujar (120 pasos), para
  // poder encuadrar el grafo entero en la pantalla desde el principio
  simulacion.tick(120);

  function actualizar() {
    lineas
      .attr('x1', (e) => e.source.x).attr('y1', (e) => e.source.y)
      .attr('x2', (e) => e.target.x).attr('y2', (e) => e.target.y);
    nodos.attr('transform', (n) => `translate(${n.x},${n.y})`);
  }
  actualizar();
  encuadrar(svg, zoom, grafo.nodos, ancho, alto);

  // A partir de aquí la simulación sigue viva (para poder arrastrar)
  simulacion.on('tick', actualizar);

  // Arrastrar círculos con el ratón o el dedo
  nodos.call(d3.drag()
    .on('start', (evento, n) => {
      if (!evento.active) simulacion.alphaTarget(0.3).restart();
      n.fx = n.x;
      n.fy = n.y;
    })
    .on('drag', (evento, n) => {
      n.fx = evento.x;
      n.fy = evento.y;
    })
    .on('end', (evento, n) => {
      if (!evento.active) simulacion.alphaTarget(0);
      if (n.id !== grafo.centro.id) {
        n.fx = null;
        n.fy = null;
      }
    }));

  seleccionar(centro);
}

// --- Seleccionar un nodo ------------------------------------------------

/**
 * Vecinos de un nodo: los elementos con los que está conectado y el
 * texto de cada conexión (el personaje).
 */
function vecinos(nodo) {
  return grafoActual.enlaces
    .filter((e) => e.source.id === nodo.id || e.target.id === nodo.id)
    .map((e) => ({ nodo: e.source.id === nodo.id ? e.target : e.source, etiquetas: e.etiquetas }));
}

/**
 * Resalta un nodo y sus conexiones, y muestra sus datos en el panel.
 */
function seleccionar(nodo) {
  const conectados = vecinos(nodo);
  const esCentro = nodo.id === grafoActual.centro.id;
  // Si se selecciona el centro, se ve todo; si no, solo lo conectado con él
  const ids = esCentro
    ? new Set(grafoActual.nodos.map((n) => n.id))
    : new Set([nodo.id, ...conectados.map((v) => v.nodo.id)]);

  // Atenuamos lo que no está conectado con el nodo seleccionado
  d3.select(contenedor).selectAll('.nodo')
    .classed('nodo--seleccionado', (n) => n.id === nodo.id)
    .classed('nodo--atenuado', (n) => !ids.has(n.id))
    .select('text')
    // Nombres visibles: los de siempre y, si no es el centro, los de sus conexiones
    .classed('nodo__nombre--oculto', (n) => !(conEtiqueta(n) || (ids.has(n.id) && !esCentro)));
  d3.select(contenedor).selectAll('.enlace')
    .classed('enlace--activo', (e) => e.source.id === nodo.id || e.target.id === nodo.id)
    .classed('enlace--atenuado', (e) => !esCentro && e.source.id !== nodo.id && e.target.id !== nodo.id);

  mostrarPanel(nodo, conectados);
}

/**
 * Panel lateral: tipo, nombre, enlace a su ficha, botón para explorar
 * desde él y la lista de sus conexiones. Esta lista es también la
 * alternativa en texto al grafo (para lectores de pantalla).
 */
function mostrarPanel(nodo, conectados) {
  const esCentro = nodo.id === grafoActual.centro.id;
  const ficha = `${TIPOS[nodo.tipo].ficha}?id=${nodo.ref}`;

  // Ordenamos las conexiones por tipo y nombre
  conectados.sort((a, b) => a.nodo.tipo.localeCompare(b.nodo.tipo) || a.nodo.nombre.localeCompare(b.nodo.nombre));

  const lista = conectados.map((v) => {
    // El personaje, salvo que sea igual que el nombre (en los personajes de animación)
    const etiquetas = v.etiquetas.filter((e) => e !== v.nodo.nombre);
    return `
    <li>
      <button type="button" class="panel-nodo__vecino" data-id="${escapar(v.nodo.id)}">
        <span class="leyenda__punto leyenda__punto--${v.nodo.tipo}" aria-hidden="true"></span>
        <span>
          <span class="panel-nodo__vecino-nombre">${escapar(v.nodo.nombre)}</span>
          ${etiquetas.length > 0 ? `<span class="panel-nodo__vecino-dato">${etiquetas.map(escapar).join(' · ')}</span>` : ''}
        </span>
      </button>
    </li>`;
  }).join('');

  panel.innerHTML = `
    <p class="panel-nodo__tipo panel-nodo__tipo--${nodo.tipo}">${TIPOS[nodo.tipo].nombre}${esCentro ? ' · centro' : ''}</p>
    <h2 class="panel-nodo__nombre">${escapar(nodo.nombre)}${nodo.anio ? ` <span class="ficha__secundario">(${nodo.anio})</span>` : ''}</h2>
    <div class="panel-nodo__acciones">
      <a class="boton boton--pequeno" href="${ficha}">Ver ficha</a>
      ${esCentro ? '' : '<button type="button" class="boton boton--secundario boton--pequeno" id="explorar">Explorar desde aquí</button>'}
    </div>
    <h3 class="panel-nodo__titulo">${conectados.length === 1 ? '1 conexión' : `${conectados.length} conexiones`}</h3>
    <ul class="panel-nodo__lista">${lista}</ul>`;

  panel.querySelector('#explorar')?.addEventListener('click', () => explorar(nodo));
}

// Pulsar una conexión de la lista la selecciona en el grafo
panel.addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-id]');
  if (!boton) return;
  const nodo = grafoActual.nodos.find((n) => n.id === boton.dataset.id);
  if (nodo) seleccionar(nodo);
});

/**
 * Pone un nodo en el centro: carga su propio grafo. Un personaje de
 * animación no tiene grafo propio: se explora desde su película.
 */
function explorar(nodo) {
  if (nodo.id === grafoActual.centro.id) return;
  const tipo = nodo.tipo === 'personaje' ? 'pelicula' : nodo.tipo;
  cargar(tipo, nodo.ref);
}

// --- Buscador ------------------------------------------------------------

const formulario = document.getElementById('buscar');
const resultados = document.getElementById('resultados');

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = document.getElementById('texto').value.trim();
  if (texto.length < 2) return;

  try {
    const encontrados = await pedirApi(`/api/conexiones/buscar?texto=${encodeURIComponent(texto)}`);
    resultados.hidden = false;
    resultados.innerHTML = encontrados.length === 0
      ? '<li class="resumen">No hay ninguna voz, actor, película ni personaje con ese nombre.</li>'
      : encontrados.map((r) => `
          <li>
            <button type="button" class="conexiones-resultados__boton" data-tipo="${r.tipo}" data-id="${r.id}">
              <span class="leyenda__punto leyenda__punto--${r.marca}" aria-hidden="true"></span>
              ${escapar(r.nombre)}
              <span class="conexiones-resultados__detalle">${escapar(r.detalle)}</span>
            </button>
          </li>`).join('');
  } catch (error) {
    mostrarError(resultados, error.message);
  }
});

resultados.addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-tipo]');
  if (!boton) return;
  resultados.hidden = true;
  cargar(boton.dataset.tipo, boton.dataset.id);
});

// --- Inicio -------------------------------------------------------------

// Botones "Atrás" y "Adelante" del navegador
window.addEventListener('popstate', (evento) => {
  if (evento.state) cargar(evento.state.tipo, evento.state.id, false);
});

async function iniciar() {
  let tipo = parametroUrl('tipo');
  let id = parametroUrl('id');

  // Sin parámetros, empezamos por la voz con más películas
  if (!tipo || !id) {
    try {
      const [primera] = await pedirApi('/api/actores-doblaje');
      if (!primera) {
        mostrarError(contenedor, 'Todavía no hay datos de doblaje.');
        return;
      }
      tipo = 'voz';
      id = primera.id;
    } catch (error) {
      mostrarError(contenedor, error.message);
      return;
    }
  }

  history.replaceState({ tipo, id }, '', `?tipo=${tipo}&id=${id}`);
  cargar(tipo, id, false);
}

iniciar();
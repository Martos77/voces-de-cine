// =====================================================================
// BUSCADOR DE VOCES (voces.html)
// =====================================================================
// 1. Al cargar, copia en el buscador el texto que haya en la dirección
//    (?texto=...) y pide a la API los profesionales que coinciden.
//    Sin texto, la API devuelve todos, de más a menos películas.
// 2. Muestra una tarjeta por profesional: sus iniciales, su nombre, los
//    personajes por los que es más conocido y su número de películas.
// 3. Al buscar, guarda el texto en la dirección y vuelve a cargar, sin
//    recargar la página (igual que el catálogo).
// =====================================================================

   import { pedirApi, mostrarError, tarjetaVoz } from './comun.js';

const formulario = document.getElementById('buscador');
const campoTexto = document.getElementById('texto');
const resumen = document.getElementById('resumen');
const resultados = document.getElementById('resultados');

/**
 * Pide a la API las voces que coinciden con el texto de la dirección
 * y las muestra.
 */
async function cargarVoces() {
  resumen.textContent = 'Cargando…';
  const textoBuscado = new URLSearchParams(window.location.search).get('texto') ?? '';

  try {
    const voces = await pedirApi(`/api/actores-doblaje?texto=${encodeURIComponent(textoBuscado)}`);

    if (voces.length === 0) {
      resumen.textContent = `Ningún profesional del doblaje coincide con «${textoBuscado}».`;
      resultados.innerHTML = '';
      return;
    }

    resumen.textContent = voces.length === 1
      ? '1 profesional del doblaje'
      : `${voces.length} profesionales del doblaje`;
    resultados.innerHTML = voces.map(tarjetaVoz).join('');
  } catch (error) {
    resumen.textContent = '';
    mostrarError(resultados, error.message);
  }
}

// --- Eventos ------------------------------------------------------------

// "Buscar": guarda el texto en la dirección y vuelve a cargar
formulario.addEventListener('submit', (evento) => {
  evento.preventDefault(); // evita que el navegador recargue la página
  const texto = campoTexto.value.trim();
  history.pushState(null, '', texto ? `?texto=${encodeURIComponent(texto)}` : window.location.pathname);
  cargarVoces();
});

// Botones "atrás" y "adelante" del navegador
window.addEventListener('popstate', () => {
  campoTexto.value = new URLSearchParams(window.location.search).get('texto') ?? '';
  cargarVoces();
});

// --- Inicio -------------------------------------------------------------
campoTexto.value = new URLSearchParams(window.location.search).get('texto') ?? '';
cargarVoces();
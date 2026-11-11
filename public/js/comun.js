// =====================================================================
// FUNCIONES COMUNES DEL FRONTEND
// =====================================================================
// Las importan todas las páginas:
//   pedirApi()        → pide datos a nuestra API
//   enviarApi()       → envía datos a nuestra API (JSON)
//   escapar()         → protege frente a XSS al insertar texto en la página
//   poster()          → HTML de un póster (o de un recuadro si no hay imagen)
//   tarjetaPelicula() → HTML de una tarjeta de película
//   parametroUrl()    → lee un valor de la dirección (?id=3 → "3")
//   mostrarError()    → muestra un mensaje de error
// =====================================================================

/**
 * Pide datos a nuestra API y devuelve el JSON.
 * Si la API responde con un error (404, 500...), lanza ese error
 * con el mensaje que haya enviado el servidor.
 * @param {string} ruta - por ejemplo "/api/peliculas"
 * @param {object} [opciones] - opciones de fetch, por ejemplo { method: 'POST' }.
 *                              Si no se indican, es una petición GET.
 */
export async function pedirApi(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, opciones);

  // 204 = "todo bien, sin contenido" (por ejemplo, al cerrar sesión):
  // no hay JSON que leer
  if (respuesta.status === 204) return null;

  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.error || 'No se han podido cargar los datos.');
  }
  return datos;
}

/**
 * Envía datos a la API en formato JSON (para registrarse, iniciar
 * sesión, marcar favoritos...). Devuelve la respuesta, igual que pedirApi.
 * @param {string} ruta - por ejemplo "/api/auth/login"
 * @param {string} metodo - 'POST', 'PUT' o 'DELETE'
 * @param {object} [datos] - los datos que se envían, por ejemplo { email, contrasena }
 */
export function enviarApi(ruta, metodo, datos) {
  return pedirApi(ruta, {
    method: metodo,
    headers: datos ? { 'Content-Type': 'application/json' } : {},
    body: datos ? JSON.stringify(datos) : undefined,
  });
}

/**
 * Convierte en texto seguro los caracteres especiales de HTML.
 * SIEMPRE que metamos un dato en la página con innerHTML hay que
 * pasarlo por aquí. Si un dato contuviera, por ejemplo, "<script>",
 * se mostraría como texto en lugar de ejecutarse (protección XSS).
 */
export function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * HTML del póster de una película.
 * Las imágenes no están en nuestro servidor: se cargan desde TMDB.
 * En la base de datos solo guardamos la ruta ("/abc.jpg") y aquí le
 * añadimos la dirección del servidor de imágenes y el tamaño.
 * Si la película no tiene póster, mostramos un recuadro con el título.
 * loading="lazy": la imagen solo se descarga cuando va a verse.
 */
export function poster(ruta, titulo, tamanio = 'w342') {
  if (!ruta) {
    return `<div class="poster poster--vacio" aria-hidden="true"><span>${escapar(titulo)}</span></div>`;
  }
  return `<img class="poster" src="https://image.tmdb.org/t/p/${tamanio}${ruta}"
               alt="Póster de ${escapar(titulo)}" loading="lazy">`;
}

/**
 * HTML de una tarjeta de película (póster, título y año).
 * La tarjeta entera es un enlace a la ficha de la película.
 * @param {object} pelicula - necesita id, titulo, anio y poster_path
 * @param {string} [extra] - HTML opcional debajo del año.
 *                           Quien lo pase debe haber escapado ya los datos.
 */
export function tarjetaPelicula(pelicula, extra = '') {
  return `
    <li class="tarjeta">
      <a href="pelicula.html?id=${pelicula.id}">
        ${poster(pelicula.poster_path, pelicula.titulo)}
        <span class="tarjeta__titulo">${escapar(pelicula.titulo)}</span>
        <span class="tarjeta__dato">${escapar(pelicula.anio ?? '')}</span>
        ${extra ? `<span class="tarjeta__extra">${extra}</span>` : ''}
      </a>
    </li>`;
}

/**
 * Lee un parámetro de la dirección de la página actual.
 * En "pelicula.html?id=3", parametroUrl('id') devuelve "3".
 */
export function parametroUrl(nombre) {
  return new URLSearchParams(window.location.search).get(nombre);
}

/**
 * Sustituye el contenido de un elemento por un mensaje de error.
 */
export function mostrarError(elemento, mensaje) {
  elemento.innerHTML = `<p class="aviso">${escapar(mensaje)}</p>`;
}

/**
 * HTML de un carrusel horizontal: una fila de tarjetas que se desplaza
 * con las flechas, deslizando el dedo (en el móvil) o con la rueda.
 * @param {string} tarjetas - HTML de las tarjetas (<li>...</li>)
 * @param {string} titulo - nombre del carrusel, para los lectores de pantalla
 */
export function htmlCarrusel(tarjetas, titulo) {
  return `
    <div class="carrusel">
      <button type="button" class="carrusel__boton carrusel__boton--anterior"
              data-direccion="-1" aria-label="Ver anteriores">&#8249;</button>
      <ul class="carrusel__pista" aria-label="${escapar(titulo)}">${tarjetas}</ul>
      <button type="button" class="carrusel__boton carrusel__boton--siguiente"
              data-direccion="1" aria-label="Ver siguientes">&#8250;</button>
    </div>`;
}

/**
 * Hace que funcionen las flechas de todos los carruseles que haya dentro
 * de un elemento. Al pulsar una flecha, la fila se desplaza casi una
 * pantalla hacia ese lado.
 * Se usa un solo "escuchador" en el contenedor, que vale para todos los
 * carruseles, aunque se añadan después.
 * @param {HTMLElement} contenedor
 */
export function activarCarruseles(contenedor) {
  contenedor.addEventListener('click', (evento) => {
    const boton = evento.target.closest('.carrusel__boton');
    if (!boton) return;
    const pista = boton.parentElement.querySelector('.carrusel__pista');
    const direccion = Number(boton.dataset.direccion);
    pista.scrollBy({ left: direccion * pista.clientWidth * 0.8, behavior: 'smooth' });
  });
}

/**
 * Iniciales de un nombre: "Óscar Barberán" → "ÓB".
 * Sustituyen a la foto, porque TMDB no tiene fotos de los profesionales
 * del doblaje.
 */
export function iniciales(nombre) {
  return nombre
    .split(' ')                     // separa las palabras
    .filter(Boolean)                // quita los huecos si hay dos espacios
    .map((palabra) => palabra[0])   // primera letra de cada palabra
    .slice(0, 2)                    // como máximo dos letras
    .join('')
    .toUpperCase();
}

/**
 * HTML de la tarjeta de un profesional del doblaje.
 * La usan el buscador de voces y la página de inicio.
 * La tarjeta entera es un enlace a su ficha.
 * @param {object} voz - { id, nombre, num_peliculas, conocido_por: [...] }
 */
export function tarjetaVoz(voz) {
  const peliculas = voz.num_peliculas === 1 ? '1 película' : `${voz.num_peliculas} películas`;

  // Sus personajes más conocidos, separados por un punto: "Woody · Arthur"
  const conocidoPor = voz.conocido_por.length > 0
    ? `<span class="tarjeta-voz__personajes">${voz.conocido_por.map(escapar).join(' · ')}</span>`
    : '';

  return `
    <li>
      <a class="tarjeta-voz" href="actor-doblaje.html?id=${voz.id}">
        <span class="tarjeta-voz__iniciales" aria-hidden="true">${escapar(iniciales(voz.nombre))}</span>
        <span class="tarjeta-voz__texto">
          <span class="tarjeta-voz__nombre">${escapar(voz.nombre)}</span>
          ${conocidoPor}
          <span class="tarjeta-voz__dato">${peliculas}</span>
        </span>
      </a>
    </li>`;
}
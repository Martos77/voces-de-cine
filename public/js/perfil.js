// =====================================================================
// PERFIL DEL USUARIO (perfil.html)
// =====================================================================
// Solo para usuarios con sesión: si no hay sesión, lleva a entrar.html.
// Muestra, de arriba abajo:
//   1. Cabecera: inicial, nombre, correo y fecha de alta.
//   2. Recomendado para ti: películas recomendadas y por qué.
//   3. Listas: favoritas, pendientes, vistas (con su valoración) y voces
//      favoritas. Todas salen de una sola petición a la API.
//   4. "Tus datos": formulario para cambiar nombre, correo o contraseña.
//   5. "Eliminar la cuenta", con todos sus datos (RGPD).
// =====================================================================

import {
  pedirApi, enviarApi, escapar, tarjetaPelicula, mostrarError, iniciales,
  htmlCarrusel, activarCarruseles, tarjetaRecomendada,
} from './comun.js';
import { obtenerUsuario, enlaceEntrar } from './sesion.js';

const perfil = document.getElementById('perfil');

/**
 * Estrellas en texto para mostrar una valoración: 4 → "★★★★☆".
 */
function textoEstrellas(valoracion) {
  return '★'.repeat(valoracion) + '☆'.repeat(5 - valoracion);
}

/**
 * Cabecera del perfil.
 */
function htmlCabecera(usuario) {
  // toLocaleDateString con mes y año: "noviembre de 2026"
  const alta = new Date(usuario.creado_en).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return `
    <header class="perfil-usuario">
      <span class="perfil-usuario__inicial" aria-hidden="true">${escapar(iniciales(usuario.nombre)[0])}</span>
      <div>
        <h1>${escapar(usuario.nombre)}</h1>
        <p class="ficha__secundario">${escapar(usuario.email)} · En Voces de Cine desde ${escapar(alta)}</p>
      </div>
    </header>`;
}

/**
 * Una sección con una lista de películas. Si está vacía, un texto que
 * explica cómo llenarla.
 * @param {string} titulo
 * @param {Array} peliculas
 * @param {string} vacio - texto si no hay ninguna
 * @param {Function} [extra] - texto opcional bajo cada tarjeta
 */
function htmlListaPeliculas(titulo, peliculas, vacio, extra = () => '') {
  const contenido = peliculas.length > 0
    ? `<ul class="rejilla rejilla--pequena">${peliculas.map((p) => tarjetaPelicula(p, extra(p))).join('')}</ul>`
    : `<p class="ficha__secundario">${vacio}</p>`;
  return `
    <section class="bloque">
      <h2>${titulo} <span class="contador">${peliculas.length}</span></h2>
      ${contenido}
    </section>`;
}

/**
 * Sección de voces favoritas.
 */
function htmlVoces(voces) {
  const contenido = voces.length > 0
    ? `<ul class="filas-personas">${voces.map((v) => `
        <li>
          <a class="fila-persona" href="actor-doblaje.html?id=${v.id}">
            <span class="fila-persona__foto fila-persona__foto--voz" aria-hidden="true">${escapar(iniciales(v.nombre))}</span>
            <span class="fila-persona__texto">
              <span class="fila-persona__nombre">${escapar(v.nombre)}</span>
              <span class="fila-persona__dato">${v.num_peliculas === 1 ? '1 película' : `${v.num_peliculas} películas`}</span>
            </span>
          </a>
        </li>`).join('')}</ul>`
    : '<p class="ficha__secundario">Todavía no tienes voces favoritas. Puedes añadirlas desde la ficha de cada profesional del doblaje.</p>';
  return `
    <section class="bloque">
      <h2>Voces favoritas <span class="contador">${voces.length}</span></h2>
      ${contenido}
    </section>`;
}

/**
 * Hueco de la sección "Recomendado para ti". Se rellena después con
 * cargarRecomendaciones(), para no retrasar el resto del perfil.
 * @param {number} numPeliculas - películas favoritas o vistas
 * @param {number} numVoces - voces favoritas
 */
function htmlRecomendaciones(numPeliculas, numVoces) {
  // Explicación de en qué se basan, con sus propios números
  const base = [];
  if (numPeliculas > 0) base.push(numPeliculas === 1 ? '1 película favorita o vista' : `${numPeliculas} películas favoritas o vistas`);
  if (numVoces > 0) base.push(numVoces === 1 ? '1 voz favorita' : `${numVoces} voces favoritas`);
  const explicacion = base.length > 0
    ? `Calculadas a partir de ${base.join(' y ')}: sus voces, sus actores y sus géneros.`
    : 'Cuando marques películas como favoritas, las valores o guardes voces favoritas, aquí verás recomendaciones hechas para ti.';

  return `
    <section class="bloque" aria-labelledby="titulo-recomendadas">
      <h2 id="titulo-recomendadas">Recomendado para ti</h2>
      <p class="ficha__secundario">${explicacion}</p>
      <div id="recomendadas"><p class="resumen">Cargando…</p></div>
    </section>`;
}

/**
 * Pide las recomendaciones y las pone en un carrusel.
 */
async function cargarRecomendaciones() {
  const contenedor = document.getElementById('recomendadas');
  try {
    const { peliculas } = await pedirApi('/api/usuario/recomendaciones');
    if (peliculas.length === 0) {
      contenedor.innerHTML = '<p class="resumen">Ya tienes todo el catálogo en tus listas.</p>';
      return;
    }
    contenedor.innerHTML = htmlCarrusel(peliculas.map(tarjetaRecomendada).join(''), 'Recomendado para ti');
    activarCarruseles(contenedor);
  } catch (error) {
    mostrarError(contenedor, error.message);
  }
}

/**
 * Formulario "Tus datos" y zona para eliminar la cuenta.
 */
function htmlAjustes(usuario) {
  return `
    <section class="bloque">
      <h2>Tus datos</h2>
      <form id="form-datos" class="ajustes" novalidate>
        <div class="campo">
          <label for="datos-nombre">Nombre</label>
          <input id="datos-nombre" name="nombre" type="text" maxlength="50" autocomplete="given-name"
                 value="${escapar(usuario.nombre)}" required>
        </div>
        <div class="campo">
          <label for="datos-email">Correo electrónico</label>
          <input id="datos-email" name="email" type="email" autocomplete="email"
                 value="${escapar(usuario.email)}" required>
        </div>
        <div class="campo">
          <label for="datos-nueva">Contraseña nueva <span class="campo__opcional">(opcional)</span></label>
          <input id="datos-nueva" name="contrasenaNueva" type="password" minlength="8" autocomplete="new-password"
                 aria-describedby="ayuda-nueva">
          <p class="campo__ayuda" id="ayuda-nueva">Déjala vacía para mantener la actual.</p>
        </div>
        <div class="campo">
          <label for="datos-actual">Contraseña actual</label>
          <input id="datos-actual" name="contrasenaActual" type="password" autocomplete="current-password"
                 aria-describedby="ayuda-actual" required>
          <p class="campo__ayuda" id="ayuda-actual">Para confirmar que eres tú.</p>
        </div>
        <p class="acceso__error" role="alert"></p>
        <p class="ajustes__aviso" role="status"></p>
        <button type="submit" class="boton">Guardar cambios</button>
      </form>
    </section>

    <section class="bloque">
      <h2>Eliminar la cuenta</h2>
      <!-- <details>: el formulario queda plegado para no pulsarlo sin querer -->
      <details class="eliminar">
        <summary>Quiero eliminar mi cuenta</summary>
        <form id="form-eliminar" class="ajustes" novalidate>
          <p class="ficha__secundario">
            Se borrarán tu cuenta y todos tus datos: películas vistas, favoritas, pendientes,
            valoraciones y voces favoritas. No se puede deshacer.
          </p>
          <div class="campo">
            <label for="eliminar-contrasena">Contraseña</label>
            <input id="eliminar-contrasena" name="contrasena" type="password" autocomplete="current-password" required>
          </div>
          <p class="acceso__error" role="alert"></p>
          <button type="submit" class="boton boton--peligro">Eliminar mi cuenta</button>
        </form>
      </details>
    </section>`;
}

/**
 * Formulario "Tus datos": envía los cambios y muestra el resultado.
 */
function activarFormularioDatos() {
  const formulario = document.getElementById('form-datos');
  const error = formulario.querySelector('.acceso__error');
  const aviso = formulario.querySelector('.ajustes__aviso');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    error.textContent = '';
    aviso.textContent = '';
    try {
      const usuario = await enviarApi('/api/usuario/datos', 'PUT', Object.fromEntries(new FormData(formulario)));
      // Vaciamos las contraseñas y actualizamos el nombre de la página
      formulario.contrasenaActual.value = '';
      formulario.contrasenaNueva.value = '';
      perfil.querySelector('h1').textContent = usuario.nombre;
      perfil.querySelector('.perfil-usuario__inicial').textContent = iniciales(usuario.nombre)[0];
      // También el nombre y la inicial de la cabecera de la página
      document.querySelector('.sesion__nombre').textContent = usuario.nombre;
      document.querySelector('.sesion__inicial').textContent = iniciales(usuario.nombre)[0];
      aviso.textContent = 'Cambios guardados.';
    } catch (e) {
      error.textContent = e.message;
    }
  });
}

/**
 * Formulario de eliminar la cuenta: pide confirmación y, si se elimina,
 * vuelve a la página de inicio sin sesión.
 */
function activarFormularioEliminar() {
  const formulario = document.getElementById('form-eliminar');
  const error = formulario.querySelector('.acceso__error');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    error.textContent = '';
    // confirm(): última pregunta antes de una acción que no se puede deshacer
    if (!window.confirm('¿Seguro que quieres eliminar tu cuenta? Se borrarán todos tus datos.')) return;
    try {
      await enviarApi('/api/usuario/cuenta', 'DELETE', { contrasena: formulario.contrasena.value });
      window.location.href = 'index.html';
    } catch (e) {
      error.textContent = e.message;
    }
  });
}

async function iniciar() {
  // Sin sesión, a la página de acceso (y volver aquí después)
  if (!await obtenerUsuario()) {
    window.location.href = enlaceEntrar();
    return;
  }

  try {
    const { usuario, peliculas, voces } = await pedirApi('/api/usuario/perfil');

    // Repartimos las películas en sus listas con filter()
    const favoritas = peliculas.filter((p) => p.favorita);
    const pendientes = peliculas.filter((p) => p.pendiente);
    const vistas = peliculas.filter((p) => p.vista);

        perfil.innerHTML =
      htmlCabecera(usuario) +
      htmlRecomendaciones(peliculas.filter((p) => p.favorita || p.vista).length, voces.length) +
      htmlListaPeliculas('Favoritas', favoritas,
        'Todavía no tienes películas favoritas. Pulsa «Favorita» en la ficha de una película.') +
      htmlListaPeliculas('Pendientes', pendientes,
        'No tienes películas pendientes. Pulsa «Pendiente» en las que quieras ver más adelante.') +
      htmlListaPeliculas('Vistas', vistas,
        'Todavía no has marcado ninguna película como vista.',
        // Debajo de cada vista, su valoración si la tiene
        (p) => (p.valoracion
          ? `<span class="valoracion-texto" aria-label="${p.valoracion} de 5 estrellas">${textoEstrellas(p.valoracion)}</span>`
          : '')) +
      htmlVoces(voces) +
      htmlAjustes(usuario);

    activarFormularioDatos();
    activarFormularioEliminar();    
    // Las recomendaciones se cargan aparte (no hace falta esperarlas)
    cargarRecomendaciones();
  } catch (error) {
    mostrarError(perfil, error.message);
  }
}

iniciar();
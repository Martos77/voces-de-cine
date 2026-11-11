// =====================================================================
// PÁGINA DE ACCESO (entrar.html)
// =====================================================================
// 1. Muestra el formulario de "Entrar" o el de "Crear cuenta"
//    (entrar.html#registro abre directamente el de crear cuenta).
// 2. Al enviar un formulario, manda los datos a la API.
// 3. Si todo va bien, vuelve a la página de la que venía el usuario
//    (?volver=...) o, si no, a la página de inicio.
// =====================================================================

import { enviarApi, parametroUrl } from './comun.js';

const formularios = {
  entrar: document.getElementById('form-entrar'),
  registro: document.getElementById('form-registro'),
};

/**
 * Muestra uno de los dos formularios y oculta el otro.
 * @param {string} cual - 'entrar' o 'registro'
 */
function mostrar(cual) {
  formularios.entrar.hidden = cual !== 'entrar';
  formularios.registro.hidden = cual !== 'registro';
  // Ponemos el cursor en el primer campo del formulario visible
  formularios[cual].querySelector('input').focus();
}

/**
 * Página a la que volver después de entrar. Solo se aceptan direcciones
 * de nuestra propia web (que empiezan por "/" pero no por "//"): así
 * nadie puede usar este enlace para mandar al usuario a otra web.
 */
function paginaDeVuelta() {
  const volver = parametroUrl('volver');
  return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : 'index.html';
}

/**
 * Envía un formulario a la API y, si va bien, vuelve a la página anterior.
 * Si la API responde con un error, lo muestra en el formulario.
 */
async function enviar(formulario, ruta) {
  const error = formulario.querySelector('.acceso__error');
  const boton = formulario.querySelector('button[type="submit"]');
  error.textContent = '';
  boton.disabled = true;   // evita enviar dos veces si se pulsa rápido

  try {
    // Object.fromEntries(new FormData(...)) → { email: '...', contrasena: '...' }
    const datos = Object.fromEntries(new FormData(formulario));
    await enviarApi(ruta, 'POST', datos);
    window.location.href = paginaDeVuelta();
  } catch (e) {
    error.textContent = e.message;   // textContent: seguro frente a XSS
    boton.disabled = false;
  }
}

// --- Eventos ------------------------------------------------------------

formularios.entrar.addEventListener('submit', (evento) => {
  evento.preventDefault();
  enviar(formularios.entrar, '/api/auth/login');
});

formularios.registro.addEventListener('submit', (evento) => {
  evento.preventDefault();
  enviar(formularios.registro, '/api/auth/registro');
});

// Enlaces "Crea una" / "Entra" para cambiar de formulario
document.querySelector('.acceso').addEventListener('click', (evento) => {
  const enlace = evento.target.closest('[data-mostrar]');
  if (!enlace) return;
  evento.preventDefault();
  mostrar(enlace.dataset.mostrar);
});

// --- Inicio -------------------------------------------------------------
mostrar(window.location.hash === '#registro' ? 'registro' : 'entrar');
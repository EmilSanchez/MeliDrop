// ============================================================
// login.js
// Lógica de la pantalla de acceso (login.html).
// TEMPORAL: por ahora acepta cualquier usuario/contraseña no
// vacíos (todavía no hay cuentas reales ni validación por
// usuario — eso se conecta más adelante). Por debajo, abre una
// sesión de backend con una cuenta de prueba fija para que los
// módulos que ya hablan con el servidor (como Precios) sigan
// funcionando mientras se termina el login real.
// ============================================================

const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const user = loginUser.value.trim();
  const pass = loginPass.value.trim();

  // TODO: reemplazar esta validación por la conexión real
  // (login por cuenta) cuando se trabaje el módulo de acceso.
  if (user.length === 0 || pass.length === 0) {
    loginError.textContent = "Usuario o contraseña incorrectos.";
    loginError.hidden = false;
    return;
  }

  loginError.hidden = true;

  // Deja la sesión de backend lista en segundo plano (no bloquea el
  // ingreso si el backend no está corriendo: solo se pierde que los
  // módulos conectados funcionen hasta que lo prendas).
  try {
    await Api.ensureDevSession();
  } catch (err) {
    console.warn("No se pudo conectar con el backend (¿está corriendo?):", err.message);
  }

  // Guarda el usuario para mostrarlo en el sidebar de app.html
  sessionStorage.setItem("gestorTienda_user", user);

  // Va a la app
  window.location.href = "app.html";
});
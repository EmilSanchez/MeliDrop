// ============================================================
// login.js
// Lógica de la pantalla de acceso (login.html).
// Por ahora acepta cualquier usuario/contraseña no vacíos
// (aquí se conectará más adelante una validación real).
// Al validar, guarda el usuario y redirige a app.html.
// ============================================================

const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const user = loginUser.value.trim();
  const pass = loginPass.value.trim();

  // TODO: reemplazar esta validación por la conexión real
  // (API / base de datos) cuando se trabaje el módulo de acceso.
  if (user.length === 0 || pass.length === 0) {
    loginError.textContent = "Usuario o contraseña incorrectos.";
    loginError.hidden = false;
    return;
  }

  loginError.hidden = true;

  // Guarda el usuario para mostrarlo en el sidebar de app.html
  sessionStorage.setItem("gestorTienda_user", user);

  // Va a la app
  window.location.href = "app.html";
});

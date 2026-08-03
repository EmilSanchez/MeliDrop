// ============================================================
// app.js
// Controlador principal de app.html: construye el menú lateral
// y el contenido de cada módulo (usando MODULES/ICONS de
// config.js y ModuleContent de cada archivo en js/modules/),
// y maneja el cambio entre módulos.
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

  // Si no hay sesión iniciada, regresa al login.
  const user = sessionStorage.getItem("gestorTienda_user");
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("userName").textContent = user;
  document.getElementById("userAvatar").textContent = user.charAt(0).toUpperCase();

  document.getElementById("logoutBtn").addEventListener("click", function () {
    sessionStorage.removeItem("gestorTienda_user");
    window.location.href = "login.html";
  });

  const navList = document.getElementById("navList");
  const content = document.getElementById("content");
  const topbarTitleText = document.getElementById("topbarTitleText");
  const topbarSubtitle = document.getElementById("topbarSubtitle");

  MODULES.forEach((m, i) => {
    const moduleData = window.ModuleContent && window.ModuleContent[m.id];

    // ---- Item del menú ----
    const li = document.createElement("li");
    li.innerHTML = `
      <button class="nav-link${i === 0 ? " active" : ""}" data-module="${m.id}">
        <span class="icon">${ICONS[m.id] || ""}</span>
        <span>${m.name}</span>
      </button>`;
    navList.appendChild(li);

    // ---- Sección del módulo ----
    const section = document.createElement("section");
    section.className = "module" + (i === 0 ? " active" : "");
    section.id = "module-" + m.id;
    section.innerHTML = moduleData
      ? moduleData.render()
      : `<div class="module-header"><h1>${m.name}</h1><p>${m.desc}</p></div>
         <div class="placeholder-card"><p>No se encontró contenido para este módulo.</p></div>`;
    content.appendChild(section);

    // ---- init() del primer módulo ----
    if (i === 0 && moduleData && typeof moduleData.init === "function") {
      moduleData.init();
    }
  });

  navList.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-link");
    if (!btn) return;
    const id = btn.dataset.module;

    document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".module").forEach(s => s.classList.remove("active"));
    document.getElementById("module-" + id).classList.add("active");

    const mod = MODULES.find(m => m.id === id);
    topbarTitleText.textContent = mod.name;
    topbarSubtitle.textContent = mod.desc;

    const moduleData = window.ModuleContent && window.ModuleContent[id];
    if (moduleData && typeof moduleData.init === "function") {
      moduleData.init();
    }
  });

});

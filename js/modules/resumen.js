// ============================================================
// modules/resumen.js
// Módulo: Resumen
// Vista general de todas las tiendas conectadas: tarjetas de
// estadísticas, filtro de estado y tarjetas por tienda.
// ============================================================

window.ModuleContent = window.ModuleContent || {};

window.ModuleContent.resumen = {

  // ---- Datos de prueba (aquí luego llegarán datos reales) ----
  _tiendas: [
    {
      nombre: "EizthStore",
      estado: "activa",
      avatarColor: "#c9743a",
      ventas60d: 353,
      reclamos: "bien",
      cancelaciones: "bien",
      demoras: "bien",
      membresia: "Sin límite"
    }
  ],

  render: function () {
    return `
      <div class="module-header">
        <h1>Resumen</h1>
        <p>Resumen general de todas tus tiendas en el mes en curso.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon stat-icon-navy">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">VENTAS</span>
            <span class="stat-value" id="resumenVentas">19</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon-teal">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5" fill="#fff"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">GANANCIA</span>
            <span class="stat-value" id="resumenGanancia">$ 539.073</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon-gold">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">TIENDAS ACTIVAS</span>
            <span class="stat-value" id="resumenActivas">1</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon-red">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="3"><path d="M5 5l14 14M19 5 5 19"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">TIENDAS INACTIVAS</span>
            <span class="stat-value" id="resumenInactivas">5</span>
          </div>
        </div>
      </div>

      <div class="filter-card">
        <h3>Selecciona el estado de las tiendas a visualizar:</h3>
        <select id="storeStatusFilter">
          <option value="activas">Ver las tiendas activas</option>
          <option value="inactivas">Ver las tiendas inactivas</option>
          <option value="todas">Ver todas las tiendas</option>
        </select>
      </div>

      <div class="stores-grid" id="storesGrid">
        <!-- tarjetas de tienda generadas por init() -->
      </div>
    `;
  },

  _repDotClass: function (valor) {
    if (valor === "bien") return "rep-dot-good";
    if (valor === "alerta") return "rep-dot-warn";
    return "rep-dot-bad";
  },

  _renderTienda: function (t) {
    const inicial = t.nombre.charAt(0).toUpperCase();
    return `
      <div class="store-card">
        <div class="store-card-header">
          <div class="store-avatar" style="background:${t.avatarColor}">${inicial}</div>
          <div class="store-card-titles">
            <div class="store-card-name">${t.nombre}</div>
            <div class="store-card-status ${t.estado === "activa" ? "status-activa" : "status-inactiva"}">
              ${t.estado === "activa" ? "Activa" : "Inactiva"}
            </div>
          </div>
        </div>

        <div class="store-card-body">
          <div class="store-reputation">
            <span class="rep-title">Reputación</span>

            <div class="rep-row">
              <span>Reclamos</span>
              <span class="rep-dot ${this._repDotClass(t.reclamos)}"></span>
            </div>
            <div class="rep-row">
              <span>Cancelaciones</span>
              <span class="rep-dot ${this._repDotClass(t.cancelaciones)}"></span>
            </div>
            <div class="rep-row">
              <span>Demoras</span>
              <span class="rep-dot ${this._repDotClass(t.demoras)}"></span>
            </div>
          </div>

          <div class="store-sales">
            <span class="sales-title">Ventas</span>
            <div class="sales-value">${t.ventas60d} <small>60 días</small></div>
            <button class="btn-infracciones" type="button">Infracciones</button>
          </div>
        </div>

        <div class="store-membership">${t.membresia}</div>
      </div>
    `;
  },

  init: function () {
    const grid = document.getElementById("storesGrid");
    const filtro = document.getElementById("storeStatusFilter");
    const self = this;

    function pintar() {
      const criterio = filtro.value;
      const filtradas = self._tiendas.filter(t => {
        if (criterio === "activas") return t.estado === "activa";
        if (criterio === "inactivas") return t.estado === "inactiva";
        return true;
      });

      grid.innerHTML = filtradas.length
        ? filtradas.map(t => self._renderTienda(t)).join("")
        : `<div class="placeholder-card"><p>No hay tiendas para este filtro.</p></div>`;
    }

    filtro.addEventListener("change", pintar);
    pintar();
  }

};
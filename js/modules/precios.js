// ============================================================
// modules/precios.js
// Módulo: Precios
// 3 pestañas: Calcular Precio (por SKU/ASIN, pendiente de la
// integración con Amazon), Configuración Precios (tramos de
// ganancia, logísticas Aguachica/Servientrega, impuestos y cobros extras, por Pack) y
// Calcular Precio Manual (costo + peso -> precio sugerido).
// Todo lee y guarda contra el backend (Api, ver js/api.js).
// ============================================================

window.ModuleContent = window.ModuleContent || {};

window.ModuleContent.precios = {

  _bound: false,
  _packs: [],
  _currentPackId: null,
  _currentPack: null,
  _activeTab: "config", // 'sku' | 'config' | 'manual'
  _activeConfig: "ganancia", // 'ganancia' | 'aguachica' | 'servientrega' | 'impuestos' | 'extras'

  render: function () {
    return `
      <div class="module-header">
        <h1>Precios</h1>
        <p>Gestión de precios de publicaciones</p>
      </div>

      <div class="price-tabs" id="priceTabs">
        <button class="price-tab" data-tab="sku">Calcular Precio</button>
        <button class="price-tab active" data-tab="config">Configuración Precios</button>
        <button class="price-tab" data-tab="manual">Calcular Precio Manual</button>
      </div>

      <div id="priceTabContent">
        <div class="placeholder-card"><p>Cargando configuración de precios…</p></div>
      </div>
    `;
  },

  init: function () {
    if (!this._bound) {
      this._bindTabs();
      this._bound = true;
    }
    this._loadPacks();
  },

  // ---------------------------------------------------------
  // Carga inicial: trae los packs del usuario y pinta la
  // pestaña activa (Configuración Precios por defecto).
  // ---------------------------------------------------------
  _loadPacks: async function () {
    const content = document.getElementById("priceTabContent");
    try {
      this._packs = await Api.listPacks();
      if (!this._currentPackId && this._packs.length) {
        const def = this._packs.find((p) => p.is_default) || this._packs[0];
        this._currentPackId = def.id;
      }
      if (this._currentPackId) {
        this._currentPack = await Api.getPack(this._currentPackId);
      }
      this._renderActiveTab();
    } catch (err) {
      content.innerHTML = `<div class="placeholder-card"><p>${this._esc(err.message)}</p></div>`;
    }
  },

  _bindTabs: function () {
    const self = this;
    document.getElementById("priceTabs").addEventListener("click", function (e) {
      const btn = e.target.closest(".price-tab");
      if (!btn) return;
      document.querySelectorAll(".price-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      self._activeTab = btn.dataset.tab;
      self._renderActiveTab();
    });
  },

  _renderActiveTab: function () {
    if (this._activeTab === "config") this._renderConfigTab();
    else if (this._activeTab === "manual") this._renderManualTab();
    else this._renderSkuTab();
  },

  // ---------------------------------------------------------
  // Selector de pack, compartido por las 3 pestañas
  // ---------------------------------------------------------
  _renderPackSelector: function () {
    const options = this._packs
      .map((p) => `<option value="${p.id}" ${p.id === this._currentPackId ? "selected" : ""}>${this._esc(p.nombre)}</option>`)
      .join("");
    return `
      <div class="pack-selector">
        <label>
          <span>Seleccione el Pack de Precios</span>
          <select id="packSelect">${options}</select>
        </label>
        <button type="button" class="btn-secondary" id="newPackBtn">+ Nuevo Pack</button>
      </div>
    `;
  },

  _bindPackSelector: function () {
    const self = this;
    const select = document.getElementById("packSelect");
    if (select) {
      select.addEventListener("change", async function () {
        self._currentPackId = Number(select.value);
        self._currentPack = await Api.getPack(self._currentPackId);
        self._renderActiveTab();
      });
    }
    const newBtn = document.getElementById("newPackBtn");
    if (newBtn) {
      newBtn.addEventListener("click", async function () {
        const nuevo = await UI.prompt({
          title: "Nuevo pack de precios",
          description: "Arranca con los valores iniciales del sistema; después ajustas los tramos y cobros a tu gusto.",
          label: "Nombre del pack",
          placeholder: 'Ej: "Precios Electrónica"',
          confirmText: "Crear pack",
          busyText: "Creando…",
          emptyMessage: "Escribe un nombre para el pack.",
          validate: function (nombre) {
            const existe = self._packs.some(function (p) {
              return p.nombre.trim().toLowerCase() === nombre.toLowerCase();
            });
            return existe ? "Ya tienes un pack con ese nombre." : null;
          },
          submit: async function (nombre) {
            const creado = await Api.createPack(nombre);
            self._packs = await Api.listPacks();
            self._currentPackId = creado.id;
            self._currentPack = creado;
            return creado;
          }
        });
        if (nuevo) self._renderActiveTab();
      });
    }
  },

  // ===========================================================
  // PESTAÑA: Configuración Precios
  // ===========================================================
  _renderConfigTab: function () {
    const content = document.getElementById("priceTabContent");
    if (!this._currentPack) {
      content.innerHTML = `<div class="placeholder-card"><p>Crea un pack de precios para empezar.</p></div>` + this._renderPackSelector();
      this._bindPackSelector();
      return;
    }

    const pack = this._currentPack;
    const configOptions = this._configOptions();
    const active = configOptions.find((o) => o.id === this._activeConfig);

    content.innerHTML = `
      <div class="config-layout">
        <div class="config-side">
          <div class="side-card">
            ${this._renderPackSelector()}
          </div>

          <div class="side-card">
            <span class="side-title">Configuraciones de ${this._esc(pack.nombre)}</span>
            <div class="config-nav" id="configNav">
              ${configOptions.map((o) => `<button type="button" class="config-nav-btn ${o.id === this._activeConfig ? "active" : ""}" data-config="${o.id}">${o.label}</button>`).join("")}
            </div>
          </div>
        </div>

        <div class="config-card config-main">
          <div class="config-main-head">
            <h3 class="config-section-title">${active.label}</h3>
            <button type="button" class="btn-primary tier-save-btn" id="tierSaveBtn">Guardar</button>
          </div>
          <div id="configTableArea"></div>
        </div>
      </div>
    `;

    this._bindPackSelector();
    document.getElementById("configNav").addEventListener("click", (e) => {
      const btn = e.target.closest(".config-nav-btn");
      if (!btn) return;
      this._activeConfig = btn.dataset.config;
      this._renderConfigTab();
    });

    this._renderConfigTable();
    this._bindTierSave(this._activeConfig);
  },

  _configOptions: function () {
    return [
      { id: "ganancia", label: "Porcentaje de ganancia por precio" },
      { id: "aguachica", label: "Envío: Aguachica (CENTRIS)" },
      { id: "servientrega", label: "Envío: Servientrega (GBX)" },
      { id: "impuestos", label: "Impuestos nacionales por precio" },
      { id: "extras", label: "Cobros Extras" },
    ];
  },

  _renderConfigTable: function () {
    const area = document.getElementById("configTableArea");
    const pack = this._currentPack;
    const kind = this._activeConfig;

    if (kind === "ganancia" || kind === "impuestos") {
      area.innerHTML = this._tierTableHtml(kind === "ganancia" ? pack.profit_tiers : pack.tax_tiers, {
        heads: ["Precio Inicial USD", "Precio Límite USD", "Porcentaje Actual", "Nuevo Porcentaje"],
      });
    } else if (kind === "extras") {
      area.innerHTML = this._extraChargesHtml(pack.extra_charges);
    } else {
      area.innerHTML = this._logisticsHtml(kind, pack.logistics[kind]);
    }
  },

  // Tabla de tramos: 3 columnas de solo lectura (actuales) + 1 editable (nuevo valor)
  _tierTableHtml: function (tiers, cfg) {
    const rows = tiers
      .map(
        (t, i) => `
        <div class="tier-row tier-4" data-index="${i}">
          <input type="number" class="tier-cell tier-readonly" value="${t.precio_inicial}" data-field="precio_inicial" disabled>
          <input type="number" class="tier-cell tier-readonly" value="${t.precio_limite}" data-field="precio_limite" disabled>
          <input type="number" class="tier-cell tier-readonly" value="${t.porcentaje}" disabled>
          <input type="number" step="any" class="tier-cell tier-new" value="${t.porcentaje}" data-field="nuevo">
        </div>`
      )
      .join("");

    return `
      <div class="tier-table">
        <div class="tier-row tier-4 tier-head">${cfg.heads.map((h) => `<span>${h}</span>`).join("")}</div>
        ${rows}
      </div>
    `;
  },

  _extraChargesHtml: function (charges) {
    const rows = charges
      .map(
        (c, i) => `
        <div class="tier-row tier-3 tier-row-extra" data-index="${i}">
          <input type="text" class="tier-cell tier-readonly" value="${this._esc(c.nombre)}" data-field="nombre" disabled>
          <input type="number" class="tier-cell tier-readonly" value="${c.valor}" disabled>
          <input type="number" step="any" class="tier-cell tier-new" value="${c.valor}" data-field="nuevo">
        </div>`
      )
      .join("");

    return `
      <div class="tier-table tier-table-extra">
        <div class="tier-row tier-3 tier-head tier-row-extra"><span>Nombre</span><span>Valor Actual</span><span>Nuevo Valor</span></div>
        ${rows}
      </div>
    `;
  },

  // Logística: seguro + tarifa total por libra (1..110)
  _logisticsHtml: function (lg, cfg) {
    const sinConfigurar = cfg.rates.every((r) => !(r.total_usd > 0));
    const rows = cfg.rates
      .map(
        (r) => `
        <div class="tier-row tier-4" data-libras="${r.libras}">
          <input type="text" class="tier-cell tier-readonly" value="${r.libras} lb" disabled>
          <input type="text" class="tier-cell tier-readonly" value="${r.total_usd > 0 ? (r.total_usd / r.libras).toFixed(2) : "—"}" disabled>
          <input type="number" class="tier-cell tier-readonly" value="${r.total_usd}" disabled>
          <input type="number" step="any" min="0" class="tier-cell tier-new" value="${r.total_usd}" data-field="nuevo">
        </div>`
      )
      .join("");

    return `
      ${sinConfigurar ? `<div class="config-note">Esta logística aún no tiene valores. Escribe el costo total por libra y guarda; mientras tanto no se calcula el precio por este medio.</div>` : ""}
      <div class="logi-settings">
        <label class="field-inline"><span>Seguro (% del valor declarado)</span>
          <input type="number" step="any" min="0" id="seguroPct" value="${cfg.seguro_porcentaje}"></label>
        <label class="field-inline"><span>Seguro mínimo (USD)</span>
          <input type="number" step="any" min="0" id="seguroMin" value="${cfg.seguro_minimo_usd}"></label>
      </div>
      <div class="tier-table">
        <div class="tier-row tier-4 tier-head"><span>Libras</span><span>USD por libra</span><span>Total Actual USD</span><span>Nuevo Total USD</span></div>
        ${rows}
      </div>
    `;
  },

  _bindTierSave: function (kind) {
    const self = this;
    const btn = document.getElementById("tierSaveBtn");
    if (!btn) return;

    btn.addEventListener("click", async function () {
      btn.disabled = true;
      btn.textContent = "Guardando…";
      try {
        if (kind === "extras") {
          const rows = Array.from(document.querySelectorAll(".tier-row-extra:not(.tier-head)"));
          const charges = rows.map((row) => ({
            nombre: row.querySelector('[data-field="nombre"]').value,
            valor: Number(row.querySelector('[data-field="nuevo"]').value),
          }));
          self._currentPack.extra_charges = await Api.saveExtraCharges(self._currentPackId, charges);
        } else if (kind === "aguachica" || kind === "servientrega") {
          const rates = Array.from(document.querySelectorAll(".tier-row[data-libras]")).map((row) => ({
            libras: Number(row.dataset.libras),
            total_usd: Number(row.querySelector('[data-field="nuevo"]').value) || 0,
          }));
          const data = {
            seguro_porcentaje: Number(document.getElementById("seguroPct").value) || 0,
            seguro_minimo_usd: Number(document.getElementById("seguroMin").value) || 0,
            rates,
          };
          self._currentPack.logistics[kind] = await Api.saveLogistics(self._currentPackId, kind, data);
        } else {
          const rows = Array.from(document.querySelectorAll(".tier-table .tier-row:not(.tier-head)"));
          const tiers = rows.map((row) => ({
            precio_inicial: Number(row.querySelector('[data-field="precio_inicial"]').value),
            precio_limite: Number(row.querySelector('[data-field="precio_limite"]').value),
            porcentaje: Number(row.querySelector('[data-field="nuevo"]').value),
          }));
          if (kind === "ganancia") self._currentPack.profit_tiers = await Api.saveProfitTiers(self._currentPackId, tiers);
          else self._currentPack.tax_tiers = await Api.saveTaxTiers(self._currentPackId, tiers);
        }
        self._renderConfigTable(); // refresca las columnas "Actual" con lo guardado
        btn.textContent = "Guardado ✓";
        setTimeout(() => {
          btn.textContent = "Guardar";
          btn.disabled = false;
        }, 1200);
      } catch (err) {
        UI.alert({ title: "No se pudo guardar", message: err.message, tone: "danger" });
        btn.textContent = "Guardar";
        btn.disabled = false;
      }
    });
  },

  // ===========================================================
  // PESTAÑA: Calcular Precio Manual
  // ===========================================================
  _renderManualTab: function () {
    const content = document.getElementById("priceTabContent");
    content.innerHTML = `
      ${this._renderPackSelector()}

      <div class="config-card">
        <h3 class="config-section-title">Calcular precio de venta manualmente</h3>
        <p class="config-section-sub">Ingresa el costo en Amazon (USD) y el peso. Se calcula por Aguachica y por Servientrega. Peso máximo: 110 lb.</p>

        <div class="manual-form">
          <label class="field-inline">
            <span>Costo del producto (USD)</span>
            <input type="number" step="any" id="manualCosto" placeholder="Ej: 20">
          </label>
          <label class="field-inline">
            <span>Peso (lbs)</span>
            <input type="number" step="any" id="manualPeso" placeholder="Ej: 1">
          </label>
          <button type="button" class="btn-primary" id="manualCalcBtn">Calcular</button>
        </div>

        <div id="manualResult"></div>
      </div>
    `;

    this._bindPackSelector();

    document.getElementById("manualCalcBtn").addEventListener("click", async () => {
      const costoUsd = Number(document.getElementById("manualCosto").value);
      const pesoLbs = Number(document.getElementById("manualPeso").value);
      const resultEl = document.getElementById("manualResult");
      resultEl.innerHTML = "";

      if (!this._currentPackId) {
        resultEl.innerHTML = `<div class="placeholder-card"><p>Selecciona un pack de precios primero.</p></div>`;
        return;
      }
      if (!costoUsd || !pesoLbs) {
        resultEl.innerHTML = `<div class="placeholder-card"><p>Ingresa costo y peso válidos.</p></div>`;
        return;
      }

      try {
        const r = await Api.calcularPrecio(this._currentPackId, costoUsd, pesoLbs);
        resultEl.innerHTML = this._priceResultHtml(r, null);
      } catch (err) {
        this._showCalcError(err, pesoLbs, resultEl);
      }
    });
  },

  _showCalcError: function (err, pesoLbs, resultEl) {
    if (err.code === "PESO_EXCEDIDO") {
      UI.alert({
        title: "Producto demasiado pesado",
        message: `${err.message} No se puede calcular ni publicar.`,
        tone: "warning",
      });
    } else {
      resultEl.innerHTML = `<div class="placeholder-card"><p>${this._esc(err.message)}</p></div>`;
    }
  },

  // ---------- Formato ----------
  _cop: function (n) {
    return "$ " + Math.round(n).toLocaleString("es-CO") + " COP";
  },
  _usd: function (n) {
    return "$ " + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USD";
  },

  // ---------- Resultado completo (lo usan "Calcular Precio" y "Calcular Precio Manual") ----------
  _priceResultHtml: function (r, asin, producto) {
    const self = this;
    const ok = r.resultados;
    const best = r.masEconomica;

    const chips = [
      `<span class="chip">Costo Amazon <b>${self._usd(r.costoUsd)}</b></span>`,
      `<span class="chip">Peso <b>${r.pesoLbs} lb</b> (se cobra ${r.pesoFacturadoLbs})</span>`,
      `<span class="chip">Dólar <b>$ ${Math.round(r.trm.aplicado).toLocaleString("es-CO")}</b> (${Math.round(r.trm.valor).toLocaleString("es-CO")} + ${Math.round(r.trm.margen).toLocaleString("es-CO")}) · ${self._esc(r.trm.fuente)}</span>`,
      `<span class="chip">Disponibilidad <b>${r.diasStock} días</b> en stock</span>`,
    ].join("");

    const head = `
      <div class="res-head">
        <div class="res-head-main">
          ${producto && producto.imagen ? `<img class="res-img" src="${self._esc(producto.imagen)}" alt="" onerror="this.remove()">` : ""}
          <div class="res-text">
          ${asin ? `<div class="res-asin">${self._esc(asin)}</div>` : ""}
          ${producto && producto.titulo ? `<div class="res-title">${self._esc(producto.titulo)}</div>` : ""}
          <div class="res-chips">${chips}</div>
          </div>
        </div>
        ${asin ? `<a class="btn-primary res-amazon" href="https://www.amazon.com/dp/${encodeURIComponent(asin)}" target="_blank" rel="noopener">Ver producto en Amazon ↗</a>` : ""}
      </div>`;

    const hero = ok
      .map((x) => {
        const isBest = best === x.logistica;
        if (x.estado !== "OK") {
          return `<div class="hero-card hero-empty"><div class="hero-name">${self._esc(x.nombre)}</div><p class="result-empty">${self._esc(x.mensaje || "Sin tarifa")}</p></div>`;
        }
        return `
          <div class="hero-card ${isBest ? "best" : ""}">
            <div class="hero-name"><span>${self._esc(x.nombre)}</span>${isBest ? '<span class="result-badge">Más económico</span>' : ""}</div>
            <div class="hero-price">${self._cop(x.precioFinalCop)}</div>
            <div class="hero-sub">Envío ${self._usd(x.envioUsd)}</div>
          </div>`;
      })
      .join("");

    // Filas de la tabla: [etiqueta, valor común | [valor por logística]]
    const common = (label, value, cls) => `<div class="bd-row ${cls || ""}"><span>${label}</span><span class="bd-common">${value}</span></div>`;
    const per = (label, fn, cls) =>
      `<div class="bd-row ${cls || ""}"><span>${label}</span>${ok.map((x) => `<span class="bd-val">${x.estado === "OK" ? fn(x) : "—"}</span>`).join("")}</div>`;
    const section = (t) => `<div class="bd-section">${t}</div>`;

    const table = `
      <div class="breakdown">
        <div class="bd-row bd-head"><span>Concepto</span>${ok.map((x) => `<span class="bd-val">${self._esc(x.nombre.split(" (")[0])}</span>`).join("")}</div>
        ${section("Compra en Amazon")}
        ${common("Costo en Amazon", self._usd(r.costoUsd))}
        ${common(`Impuesto Amazon ${r.compra.impuestoAmazonPct}%`, self._usd(r.compra.impuestoAmazonUsd))}
        ${common("Total compra en Amazon", self._usd(r.compra.totalCompraUsd), "bd-strong")}
        ${section("Ganancia e importación")}
        ${common(`Ganancia ${r.ganancia.porcentaje}%`, self._usd(r.ganancia.usd))}
        ${common(`Impuesto de importación ${r.importacion.porcentaje}%`, self._usd(r.importacion.usd))}
        ${section("Envío")}
        ${per(`Envío (${r.pesoFacturadoLbs} lb, incluye seguro)`, (x) => self._usd(x.envioUsd))}
        ${per("Subtotal", (x) => self._usd(x.subtotalUsd), "bd-strong")}
        ${section("Conversión a pesos")}
        ${common("Dólar del día (TRM)", "$ " + r.trm.valor.toLocaleString("es-CO", { maximumFractionDigits: 2 }) + " COP")}
        ${common("Margen sobre el dólar", "+ $ " + r.trm.margen.toLocaleString("es-CO", { maximumFractionDigits: 2 }) + " COP")}
        ${common("Dólar aplicado", "$ " + r.trm.aplicado.toLocaleString("es-CO", { maximumFractionDigits: 2 }) + " COP", "bd-strong")}
        ${per("Total en pesos", (x) => self._cop(x.totalCop), "bd-strong")}
        ${section("Mercado Libre")}
        ${per("Costo reputación", (x) => self._cop(x.reputacionCop))}
        ${per(`Comisión ${r.comisionPubPct}%`, (x) => self._cop(x.comisionCop))}
        ${per(`Impuesto de venta ${r.impuestoVentaPct}%`, (x) => self._cop(x.impuestoVentaCop))}
        ${per("Precio sin redondear", (x) => self._cop(x.precioSinRedondearCop))}
        ${per("Precio final", (x) => self._cop(x.precioFinalCop), "bd-final")}
      </div>`;

    return `${head}<div class="hero-grid">${hero}</div>${table}`;
  },

  // ===========================================================
  // PESTAÑA: Calcular Precio (por SKU/ASIN) — pendiente
  // ===========================================================
  _renderSkuTab: function () {
    const content = document.getElementById("priceTabContent");
    content.innerHTML = `
      ${this._renderPackSelector()}

      <div class="config-card">
        <div class="sku-form">
          <label class="field-inline sku-field">
            <span>SKU / ASIN de Amazon</span>
            <input type="text" id="skuInput" placeholder="Ej: B0GVTPKJVT" maxlength="20" autocomplete="off">
          </label>
          <button type="button" class="btn-primary" id="skuCalcBtn">Calcular</button>
        </div>

        <div id="skuResult"></div>
      </div>
    `;

    this._bindPackSelector();

    const run = async () => {
      const asin = document.getElementById("skuInput").value.trim().toUpperCase();
      const out = document.getElementById("skuResult");
      const btn = document.getElementById("skuCalcBtn");
      out.innerHTML = "";

      if (!this._currentPackId) {
        out.innerHTML = `<div class="placeholder-card"><p>Selecciona un pack de precios primero.</p></div>`;
        return;
      }
      if (!/^[A-Z0-9]{6,20}$/.test(asin)) {
        out.innerHTML = `<div class="placeholder-card"><p>Escribe un SKU/ASIN válido (letras y números, ej: B0GVTPKJVT).</p></div>`;
        return;
      }
      btn.disabled = true;
      btn.textContent = "Buscando en Amazon…";
      try {
        const r = await Api.calcularPorSku(this._currentPackId, asin);
        out.innerHTML = this._priceResultHtml(r, asin, r.producto);
      } catch (err) {
        if (err.code === "SIN_PESO" || err.code === "SIN_PRECIO") {
          UI.alert({
            title: err.code === "SIN_PESO" ? "Producto sin peso en Amazon" : "Producto sin precio en Amazon",
            message: err.message + (err.producto && err.producto.titulo ? "\n\n" + err.producto.titulo : ""),
            tone: "warning",
          });
        } else {
          this._showCalcError(err, err.pesoLbs, out);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = "Calcular";
      }
    };

    document.getElementById("skuCalcBtn").addEventListener("click", run);
    document.getElementById("skuInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") run();
    });
  },

  _esc: function (str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  },

};
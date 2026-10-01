// ============================================================
// modules/precios.js
// Módulo: Precios
// 3 pestañas: Calcular Precio (por SKU/ASIN, pendiente de la
// integración con Amazon), Configuración Precios (tramos de
// ganancia, envíos, impuestos y cobros extras, por Pack) y
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
  _activeConfig: "ganancia", // 'ganancia' | 'envios_me' | 'envios_custom' | 'impuestos' | 'extras'

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
        const nombre = window.prompt("Nombre del nuevo pack de precios (ej: \"Precios Electrónica\"):");
        if (!nombre || !nombre.trim()) return;
        try {
          const nuevo = await Api.createPack(nombre.trim());
          self._packs = await Api.listPacks();
          self._currentPackId = nuevo.id;
          self._currentPack = nuevo;
          self._renderActiveTab();
        } catch (err) {
          alert(err.message);
        }
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
    const configOptions = [
      { id: "ganancia", label: "Porcentaje de ganancia por precio" },
      { id: "envios_me", label: "Precios de Envíos por libra (Mercado Envíos)" },
      { id: "envios_custom", label: "Precios de Envíos por libra (Custom)" },
      { id: "impuestos", label: "Porcentajes de Impuestos nacionales por precio" },
      { id: "extras", label: "Cobros Extras" },
    ];

    content.innerHTML = `
      ${this._renderPackSelector()}

      <div class="config-card">
        <div class="sku-calc-row">
          <label class="field-inline">
            <span>Calcular precio de venta por SKU</span>
            <input type="text" id="skuQuickInput" placeholder="Ej: B0ABCD1234">
          </label>
          <button type="button" class="btn-primary" id="skuQuickBtn">Calcular</button>
          <button type="button" class="btn-secondary" id="skuShippingBtn">Calculador de Envíos</button>
        </div>

        <label class="field-inline config-select-row">
          <span>Configuraciones de Precios ${this._esc(pack.nombre)}</span>
          <select id="configSelect">
            ${configOptions.map((o) => `<option value="${o.id}" ${o.id === this._activeConfig ? "selected" : ""}>${o.label}</option>`).join("")}
          </select>
        </label>

        <h3 class="config-section-title">${configOptions.find((o) => o.id === this._activeConfig).label}</h3>

        <div id="configTableArea"></div>
      </div>
    `;

    this._bindPackSelector();
    this._bindSkuQuickCalc();

    document.getElementById("configSelect").addEventListener("change", (e) => {
      this._activeConfig = e.target.value;
      this._renderConfigTab();
    });

    this._renderConfigTable();
  },

  _bindSkuQuickCalc: function () {
    // El cálculo automático por SKU/ASIN depende de la integración con Amazon
    // (scraping o API), que todavía no está conectada. Por ahora el botón
    // avisa esto en vez de fallar en silencio.
    const btn = document.getElementById("skuQuickBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        alert('Esto se activa cuando conectemos la búsqueda por ASIN/SKU de Amazon. Mientras tanto, usa la pestaña "Calcular Precio Manual".');
      });
    }
    const shipBtn = document.getElementById("skuShippingBtn");
    if (shipBtn) {
      shipBtn.addEventListener("click", () => {
        this._activeTab = "manual";
        document.querySelectorAll(".price-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === "manual"));
        this._renderActiveTab();
      });
    }
  },

  _renderConfigTable: function () {
    const area = document.getElementById("configTableArea");
    const pack = this._currentPack;

    if (this._activeConfig === "ganancia") {
      area.innerHTML = this._tierTableHtml(pack.profit_tiers, {
        col1: "Precio Inicial USD",
        col2: "Precio Límite USD",
        key1: "precio_inicial",
        key2: "precio_limite",
        valueKey: "porcentaje",
        valueLabel: "Nuevo Porcentaje",
      });
      this._bindTierSave("ganancia");
    } else if (this._activeConfig === "envios_me" || this._activeConfig === "envios_custom") {
      const tiers = this._activeConfig === "envios_me" ? pack.shipping_tiers_mercado_envios : pack.shipping_tiers_custom;
      area.innerHTML = this._tierTableHtml(tiers, {
        col1: "Peso Inicial lbs",
        col2: "Peso Límite lbs",
        key1: "peso_inicial",
        key2: "peso_limite",
        valueKey: "precio_usd",
        valueLabel: "Nuevo Precio",
      });
      this._bindTierSave(this._activeConfig);
    } else if (this._activeConfig === "impuestos") {
      area.innerHTML = this._tierTableHtml(pack.tax_tiers, {
        col1: "Precio Inicial USD",
        col2: "Precio Límite USD",
        key1: "precio_inicial",
        key2: "precio_limite",
        valueKey: "porcentaje",
        valueLabel: "Nuevo Porcentaje",
      });
      this._bindTierSave("impuestos");
    } else if (this._activeConfig === "extras") {
      area.innerHTML = this._extraChargesHtml(pack.extra_charges);
      this._bindTierSave("extras");
    }
  },

  // Tabla genérica de tramos [inicial, limite, valor-actual, valor-nuevo-editable]
  _tierTableHtml: function (tiers, cfg) {
    const rows = tiers
      .map(
        (t, i) => `
        <div class="tier-row" data-index="${i}">
          <input type="number" step="any" class="tier-cell tier-readonly" value="${t[cfg.key1]}" data-field="${cfg.key1}">
          <input type="number" step="any" class="tier-cell tier-readonly" value="${t[cfg.key2]}" data-field="${cfg.key2}">
          <input type="number" step="any" class="tier-cell tier-readonly" value="${t[cfg.valueKey]}" disabled>
          <input type="number" step="any" class="tier-cell tier-new" value="${t[cfg.valueKey]}" data-field="${cfg.valueKey}">
        </div>`
      )
      .join("");

    return `
      <div class="tier-table">
        <div class="tier-row tier-head">
          <span>${cfg.col1}</span>
          <span>${cfg.col2}</span>
          <span>${cfg.valueLabel.replace("Nuevo ", "")} Actual</span>
          <span>${cfg.valueLabel}</span>
        </div>
        ${rows}
      </div>
      <button type="button" class="btn-primary tier-save-btn" id="tierSaveBtn">Guardar</button>
    `;
  },

  _extraChargesHtml: function (charges) {
    const rows = charges
      .map(
        (c, i) => `
        <div class="tier-row tier-row-extra" data-index="${i}">
          <input type="text" class="tier-cell tier-readonly" value="${this._esc(c.nombre)}" data-field="nombre" disabled>
          <input type="number" step="any" class="tier-cell tier-readonly" value="${c.valor}" disabled>
          <input type="number" step="any" class="tier-cell tier-new" value="${c.valor}" data-field="valor">
        </div>`
      )
      .join("");

    return `
      <div class="tier-table tier-table-extra">
        <div class="tier-row tier-head tier-row-extra">
          <span>Nombre</span>
          <span>Valor Actual</span>
          <span>Nuevo Valor</span>
        </div>
        ${rows}
      </div>
      <button type="button" class="btn-primary tier-save-btn" id="tierSaveBtn">Guardar</button>
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
            valor: Number(row.querySelector('[data-field="valor"]').value),
          }));
          self._currentPack.extra_charges = await Api.saveExtraCharges(self._currentPackId, charges);
        } else {
          const rows = Array.from(document.querySelectorAll(".tier-table .tier-row:not(.tier-head):not(.tier-row-extra)"));
          const isRange1 = kind === "ganancia" || kind === "impuestos";
          const key1 = isRange1 ? "precio_inicial" : "peso_inicial";
          const key2 = isRange1 ? "precio_limite" : "peso_limite";
          const valueKey = kind === "ganancia" || kind === "impuestos" ? "porcentaje" : "precio_usd";

          const tiers = rows.map((row) => ({
            [key1]: Number(row.querySelector(`[data-field="${key1}"]`).value),
            [key2]: Number(row.querySelector(`[data-field="${key2}"]`).value),
            [valueKey]: Number(row.querySelector(`[data-field="${valueKey}"]`).value),
          }));

          if (kind === "ganancia") {
            self._currentPack.profit_tiers = await Api.saveProfitTiers(self._currentPackId, tiers);
          } else if (kind === "impuestos") {
            self._currentPack.tax_tiers = await Api.saveTaxTiers(self._currentPackId, tiers);
          } else if (kind === "envios_me") {
            self._currentPack.shipping_tiers_mercado_envios = await Api.saveShippingTiers(self._currentPackId, "mercado_envios", tiers);
          } else if (kind === "envios_custom") {
            self._currentPack.shipping_tiers_custom = await Api.saveShippingTiers(self._currentPackId, "custom", tiers);
          }
        }
        btn.textContent = "Guardado ✓";
        setTimeout(() => {
          btn.textContent = "Guardar";
          btn.disabled = false;
        }, 1200);
      } catch (err) {
        alert(err.message);
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
        <p class="config-section-sub">Ingresa el costo en Amazon (USD) y el peso del producto para ver el precio sugerido con el pack seleccionado.</p>

        <div class="manual-form">
          <label class="field-inline">
            <span>Costo del producto (USD)</span>
            <input type="number" step="any" id="manualCosto" placeholder="Ej: 20">
          </label>
          <label class="field-inline">
            <span>Peso (lbs)</span>
            <input type="number" step="any" id="manualPeso" placeholder="Ej: 1">
          </label>
          <label class="field-inline">
            <span>Tipo de envío</span>
            <select id="manualEnvio">
              <option value="mercado_envios">Mercado Envíos</option>
              <option value="custom">Custom</option>
            </select>
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
      const envioVariante = document.getElementById("manualEnvio").value;
      const resultEl = document.getElementById("manualResult");

      if (!this._currentPackId) {
        resultEl.innerHTML = `<div class="placeholder-card"><p>Selecciona un pack de precios primero.</p></div>`;
        return;
      }
      if (!costoUsd || !pesoLbs) {
        resultEl.innerHTML = `<div class="placeholder-card"><p>Ingresa costo y peso válidos.</p></div>`;
        return;
      }

      try {
        const r = await Api.calcularPrecio(this._currentPackId, costoUsd, pesoLbs, envioVariante);
        resultEl.innerHTML = `
          <div class="result-card">
            <div class="result-main">
              <span>Precio de venta sugerido</span>
              <strong>$ ${r.precioFinalUsd.toFixed(2)} USD</strong>
            </div>
            <div class="result-breakdown">
              <div><span>Ganancia aplicada</span><span>${r.tramoGananciaPct}%</span></div>
              <div><span>Envío</span><span>$ ${r.envioUsd.toFixed(2)}</span></div>
              <div><span>Impuesto Amazon</span><span>${r.impuestoAmazonPct}%</span></div>
              <div><span>Impuesto nacional</span><span>${r.impuestoNacionalPct}%</span></div>
              <div><span>Comisión publicación</span><span>${r.comisionPubPct}%</span></div>
              <div><span>Impuesto de venta</span><span>${r.impuestoVentaPct}%</span></div>
            </div>
          </div>
        `;
      } catch (err) {
        resultEl.innerHTML = `<div class="placeholder-card"><p>${this._esc(err.message)}</p></div>`;
      }
    });
  },

  // ===========================================================
  // PESTAÑA: Calcular Precio (por SKU/ASIN) — pendiente
  // ===========================================================
  _renderSkuTab: function () {
    const content = document.getElementById("priceTabContent");
    content.innerHTML = `
      <div class="placeholder-card">
        <div class="badge">Pendiente por construir</div>
        <h3>Calcular Precio por SKU/ASIN</h3>
        <p>Esta pestaña se activa cuando conectemos la búsqueda automática de productos en Amazon. Mientras tanto, usa "Calcular Precio Manual".</p>
      </div>
    `;
  },

  _esc: function (str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  },

};
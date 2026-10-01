// ============================================================
// js/api.js
// Cliente HTTP hacia el backend (Node + Express + SQLite).
// Centraliza la URL base, el token de sesión (JWT) y el manejo
// de errores para que los módulos no repitan fetch() a mano.
// ============================================================

const Api = {
  baseUrl: (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || "http://localhost:3001/api",

  getToken() {
    return sessionStorage.getItem("gestorTienda_token");
  },

  getUser() {
    const raw = sessionStorage.getItem("gestorTienda_user");
    return raw ? JSON.parse(raw) : null;
  },

  setSession(token, user) {
    sessionStorage.setItem("gestorTienda_token", token);
    sessionStorage.setItem("gestorTienda_user", JSON.stringify(user));
  },

  clearSession() {
    sessionStorage.removeItem("gestorTienda_token");
    sessionStorage.removeItem("gestorTienda_user");
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  async request(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    let res;
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error("No se pudo conectar con el servidor. ¿Está corriendo el backend?");
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* respuesta sin cuerpo JSON */
    }

    if (res.status === 401) {
      // Sesión vencida o token inválido: se cierra sesión y se manda al login.
      this.clearSession();
      if (!location.pathname.endsWith("login.html")) {
        location.href = "login.html";
      }
    }

    if (!res.ok) {
      const msg = (data && data.error) || `Error ${res.status}`;
      throw new Error(msg);
    }

    return data;
  },

  // ---------------- Auth ----------------
  login(email, password) {
    return this.request("/auth/login", { method: "POST", body: { email, password } });
  },
  register(email, password, nombre) {
    return this.request("/auth/register", { method: "POST", body: { email, password, nombre } });
  },

  // ---------------- Modo temporal: login todavía no es real ----------------
  // El formulario de login hoy es solo diseño: cualquier usuario/contraseña
  // no vacíos te deja pasar (eso lo valida login.js). Para que módulos ya
  // conectados al backend (como Precios) sigan funcionando mientras tanto,
  // esto abre sesión con una cuenta de prueba fija, creándola la primera vez.
  // Cuando se conecte el login real por cuenta, este método se elimina.
  async ensureDevSession() {
    if (this.isLoggedIn()) return;
    const DEV_EMAIL = "dev@local.test";
    const DEV_PASS = "dev12345";
    try {
      const data = await this.login(DEV_EMAIL, DEV_PASS);
      this.setSession(data.token, data.user);
    } catch (err) {
      const data = await this.register(DEV_EMAIL, DEV_PASS, "Usuario de prueba");
      this.setSession(data.token, data.user);
    }
  },

  // ---------------- Packs de precios ----------------
  listPacks() {
    return this.request("/price-packs");
  },
  createPack(nombre) {
    return this.request("/price-packs", { method: "POST", body: { nombre } });
  },
  getPack(id) {
    return this.request(`/price-packs/${id}`);
  },
  saveProfitTiers(packId, tiers) {
    return this.request(`/price-packs/${packId}/profit-tiers`, { method: "PUT", body: { tiers } });
  },
  saveShippingTiers(packId, variante, tiers) {
    return this.request(`/price-packs/${packId}/shipping-tiers`, {
      method: "PUT",
      body: { variante, tiers },
    });
  },
  saveTaxTiers(packId, tiers) {
    return this.request(`/price-packs/${packId}/tax-tiers`, { method: "PUT", body: { tiers } });
  },
  saveExtraCharges(packId, charges) {
    return this.request(`/price-packs/${packId}/extra-charges`, {
      method: "PUT",
      body: { charges },
    });
  },

  // ---------------- Cálculo ----------------
  calcularPrecio(packId, costoUsd, pesoLbs, envioVariante) {
    return this.request("/calcular-precio", {
      method: "POST",
      body: { packId, costoUsd, pesoLbs, envioVariante },
    });
  },
};
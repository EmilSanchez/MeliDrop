// ============================================================
// config.js
// Lista central de módulos e iconos. Aquí se agrega/quita un
// módulo del menú lateral sin tocar ningún otro archivo.
// ============================================================

// Config de conexión al backend. Cambia esta URL cuando el
// backend quede desplegado (por ahora corre en local).
window.APP_CONFIG = {
  apiBaseUrl: "http://localhost:3001/api"
};

const MODULES = [
  { id: "resumen",    name: "Resumen",    desc: "Vista general de la tienda" },
  { id: "precios",    name: "Precios",    desc: "Gestión de precios de publicaciones" },
  { id: "publicar",   name: "Publicar",   desc: "Creación y edición de publicaciones" },
  { id: "preventa",   name: "Pre Venta",  desc: "Preguntas antes de la compra" },
  { id: "postventa",  name: "Post Venta", desc: "Preguntas y soporte después de la compra" },
  { id: "ventas",     name: "Ventas",     desc: "Gestor de ventas y órdenes" },
  { id: "tracking",   name: "Tracking",   desc: "Seguimiento de envíos" },
  { id: "envios",     name: "Envíos",     desc: "Gestión de transportadoras y despachos" },
  { id: "ganancias",  name: "Ganancias",  desc: "Ingresos, costos y ganancia neta" },
  { id: "problemas",  name: "Problemas",  desc: "Reclamos, cancelaciones y demoras" },
  { id: "productos",  name: "Productos",  desc: "Catálogo e inventario de productos" },
  { id: "extras",     name: "Extras",     desc: "Herramientas y configuraciones adicionales" }
];

const ICONS = {
  resumen: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  precios: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  publicar: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  preventa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.8.35-1.4 1-1.4 1.9"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>',
  postventa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 1 1 8.5-8.5Z"/><path d="M7 9h.01M12 9h.01M17 9h.01"/></svg>',
  ventas: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.3" fill="currentColor" stroke="none"/><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6"/></svg>',
  tracking: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/></svg>',
  envios: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="7" width="14" height="10" rx="1"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>',
  ganancias: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l5-6 4 3 6-8"/><path d="M14 6h4v4"/></svg>',
  problemas: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 1 21h22Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>',
  productos: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  extras: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 2.4l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1Z"/></svg>'
};
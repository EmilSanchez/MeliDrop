// ============================================================
// js/ui.js
// Componentes de interfaz compartidos: modales con el diseño del
// sistema, para no usar los alert()/prompt() del navegador.
//
//   UI.prompt({ title, description, label, placeholder, value,
//               confirmText, cancelText, busyText, emptyMessage,
//               validate(valor) -> mensaje de error | null,
//               submit(valor)   -> Promise (opcional) })
//     Abre un modal con un campo de texto. Devuelve una Promise que
//     se resuelve con el resultado de submit() (o con el texto si no
//     hay submit), o con null si el usuario cancela. Si submit()
//     lanza un error, el modal queda abierto y lo muestra adentro.
//
//   UI.alert({ title, message, confirmText, tone: "info" | "warning" | "danger" })
//     Modal de aviso con un solo botón. Devuelve una Promise que se
//     resuelve al cerrarlo.
//
// Los estilos están en css/app.css (sección MODAL).
// ============================================================

const UI = (function () {

  let idCounter = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Overlay + tarjeta. Maneja Esc, clic fuera, foco atrapado y devolución del foco.
  function createModal(opts) {
    const titleId = "ui-modal-title-" + (++idCounter);
    const overlay = el("div", "ui-overlay");
    const card = el("div", "ui-modal" + (opts.tone === "danger" ? " ui-modal-danger" : opts.tone === "warning" ? " ui-modal-warning" : ""));
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", titleId);

    const heading = el("h3", "ui-modal-title", opts.title);
    heading.id = titleId;
    card.appendChild(heading);
    if (opts.description) card.appendChild(el("p", "ui-modal-text", opts.description));

    const body = el("div", "ui-modal-body");
    const actions = el("div", "ui-modal-actions");
    card.appendChild(body);
    card.appendChild(actions);
    overlay.appendChild(card);

    const previousFocus = document.activeElement;
    let onDismiss = null;

    function focusables() {
      return Array.from(card.querySelectorAll("button:not([disabled]), input:not([disabled])"));
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (onDismiss) onDismiss();
      } else if (e.key === "Tab") {
        const items = focusables();
        if (!items.length) { e.preventDefault(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (!card.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    // mousedown (no click): si el usuario empieza a seleccionar texto dentro
    // del campo y suelta fuera, no se debe cerrar el modal.
    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay && onDismiss) onDismiss();
    });
    document.addEventListener("keydown", onKeyDown, true);
    document.body.appendChild(overlay);

    return {
      body: body,
      actions: actions,
      setDismiss: function (fn) { onDismiss = fn; },
      close: function () {
        document.removeEventListener("keydown", onKeyDown, true);
        overlay.classList.add("ui-closing");
        setTimeout(function () { overlay.remove(); }, 120);
        if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      }
    };
  }

  function prompt(options) {
    const o = Object.assign({
      title: "",
      description: "",
      label: "",
      placeholder: "",
      value: "",
      confirmText: "Aceptar",
      cancelText: "Cancelar",
      busyText: "Guardando…",
      emptyMessage: "Este campo es obligatorio.",
      validate: null,
      submit: null
    }, options);

    return new Promise(function (resolve) {
      const modal = createModal({ title: o.title, description: o.description });

      const field = el("label", "ui-modal-field");
      field.appendChild(el("span", null, o.label));
      const input = el("input");
      input.type = "text";
      input.placeholder = o.placeholder;
      input.value = o.value;
      input.maxLength = 80;
      input.autocomplete = "off";
      field.appendChild(input);

      const error = el("p", "ui-modal-error");
      error.hidden = true;

      modal.body.appendChild(field);
      modal.body.appendChild(error);

      const cancelBtn = el("button", "btn-secondary", o.cancelText);
      cancelBtn.type = "button";
      const okBtn = el("button", "btn-primary", o.confirmText);
      okBtn.type = "button";
      modal.actions.appendChild(cancelBtn);
      modal.actions.appendChild(okBtn);

      let busy = false;

      function showError(msg) {
        error.textContent = msg;
        error.hidden = false;
        input.classList.add("ui-invalid");
      }

      function clearError() {
        error.hidden = true;
        input.classList.remove("ui-invalid");
      }

      function cancel() {
        if (busy) return;
        modal.close();
        resolve(null);
      }

      async function confirm() {
        if (busy) return;
        const value = input.value.trim();

        if (!value) { showError(o.emptyMessage); input.focus(); return; }
        const invalid = o.validate ? o.validate(value) : null;
        if (invalid) { showError(invalid); input.focus(); return; }
        clearError();

        if (!o.submit) {
          modal.close();
          resolve(value);
          return;
        }

        busy = true;
        okBtn.disabled = true;
        cancelBtn.disabled = true;
        input.disabled = true;
        const originalText = okBtn.textContent;
        okBtn.textContent = o.busyText;

        try {
          const result = await o.submit(value);
          modal.close();
          resolve(result === undefined ? value : result);
        } catch (err) {
          busy = false;
          okBtn.disabled = false;
          cancelBtn.disabled = false;
          input.disabled = false;
          okBtn.textContent = originalText;
          showError((err && err.message) || "No se pudo completar la acción.");
          input.focus();
        }
      }

      modal.setDismiss(cancel);
      cancelBtn.addEventListener("click", cancel);
      okBtn.addEventListener("click", confirm);
      input.addEventListener("input", clearError);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); confirm(); }
      });

      setTimeout(function () { input.focus(); input.select(); }, 0);
    });
  }

  function alertModal(options) {
    const o = Object.assign({
      title: "Aviso",
      message: "",
      confirmText: "Entendido",
      tone: "info"
    }, options);

    return new Promise(function (resolve) {
      const modal = createModal({ title: o.title, tone: o.tone });
      modal.body.appendChild(el("p", "ui-modal-text", o.message));

      const okBtn = el("button", "btn-primary", o.confirmText);
      okBtn.type = "button";
      modal.actions.appendChild(okBtn);

      function done() {
        modal.close();
        resolve();
      }

      modal.setDismiss(done);
      okBtn.addEventListener("click", done);
      setTimeout(function () { okBtn.focus(); }, 0);
    });
  }

  return { prompt: prompt, alert: alertModal };

})();
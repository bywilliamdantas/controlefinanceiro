// ==== SECURITY ===============================================================
// Trava de acesso simples por PIN (protege contra alguém pegar o celular e
// abrir o app casualmente — não é criptografia forte, e não protege os
// dados no localStorage de quem tiver acesso ao dispositivo/devtools) e
// ofuscação de valores na tela (tipo Nubank/Instagram).
window.App = window.App || {};

(function (App) {
  "use strict";

  // Hash simples (não criptográfico) só para não guardar o PIN em texto puro.
  function hashPin(pin) {
    var h = 5381;
    for (var i = 0; i < pin.length; i++) h = ((h << 5) + h) + pin.charCodeAt(i);
    return "h" + (h >>> 0).toString(36);
  }

  function pinAtivo() { return !!App.state.pinHash; }
  function definirPin(pin) { App.state.pinHash = hashPin(pin); App.data.saveState(); }
  function removerPin() { App.state.pinHash = null; App.data.saveState(); }
  function verificarPin(pin) { return hashPin(pin) === App.state.pinHash; }

  function toggleOfuscar() {
    App.state.prefs.ofuscarValores = !App.state.prefs.ofuscarValores;
    App.data.saveState();
  }
  function ofuscarAtivo() { return !!App.state.prefs.ofuscarValores; }

  // ---- Tela de bloqueio ----
  var pinBuffer = "";
  var onUnlockCb = null;
  var travado = false;      // evita digitar durante a animação de erro/sucesso
  var tecladoBound = false;

  var ICON_BACKSPACE = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1z"/><line x1="12" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="12" y2="15"/></svg>';

  function renderLockScreen() {
    var root = document.getElementById("lockScreen");
    root.classList.remove("unlocking");
    root.innerHTML =
      '<div class="lock-top">' +
        '<div class="lock-logo"><img src="assets/icon.png" alt=""></div>' +
        "<h2>Controle Financeiro</h2>" +
        '<p class="lock-sub">Digite seu PIN para entrar</p>' +
        '<span class="lock-profile">' + App.utils.escapeHtml(App.data.perfilAtual()) + "</span>" +
      "</div>" +
      '<div class="lock-mid">' +
        '<div class="pin-dots" id="pinDots" aria-label="PIN"></div>' +
        '<div class="pin-error-msg" id="pinErrorMsg" role="alert"></div>' +
      "</div>" +
      '<div class="pin-pad" id="pinPad">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button data-num="' + n + '" aria-label="' + n + '">' + n + "</button>"; }).join("") +
        '<span class="pin-spacer"></span>' +
        '<button data-num="0" aria-label="0">0</button>' +
        '<button class="pin-back" data-action="back" aria-label="Apagar">' + ICON_BACKSPACE + "</button>" +
      "</div>";
    updatePinDots();
    root.querySelectorAll("[data-num]").forEach(function (btn) {
      btn.addEventListener("click", function () { onPinDigit(btn.getAttribute("data-num")); });
    });
    root.querySelector('[data-action="back"]').addEventListener("click", onPinBack);
    if (!tecladoBound) {
      tecladoBound = true;
      // Teclado físico (desktop): dígitos e Backspace.
      document.addEventListener("keydown", function (e) {
        if (document.getElementById("lockScreen").style.display === "none") return;
        if (/^[0-9]$/.test(e.key)) onPinDigit(e.key);
        else if (e.key === "Backspace") onPinBack();
      });
    }
  }

  function updatePinDots(errorState) {
    var el = document.getElementById("pinDots");
    if (!el) return;
    var html = "";
    for (var i = 0; i < 4; i++) {
      var filled = i < pinBuffer.length;
      html += '<div class="pin-dot' + (filled ? " filled" : "") + (filled && i === pinBuffer.length - 1 && !errorState ? " pop" : "") + (errorState ? " error" : "") + '"></div>';
    }
    el.innerHTML = html;
  }

  function onPinBack() {
    if (travado) return;
    pinBuffer = pinBuffer.slice(0, -1);
    updatePinDots();
  }

  function onPinDigit(n) {
    if (travado || pinBuffer.length >= 4) return;
    pinBuffer += n;
    updatePinDots();
    if (App.utils.vibrar) App.utils.vibrar(8);
    if (pinBuffer.length < 4) return;
    var root = document.getElementById("lockScreen");
    if (verificarPin(pinBuffer)) {
      travado = true;
      pinBuffer = "";
      root.classList.add("unlocking");
      setTimeout(function () {
        root.style.display = "none";
        root.classList.remove("unlocking");
        travado = false;
        if (onUnlockCb) onUnlockCb();
      }, 260);
    } else {
      travado = true;
      updatePinDots(true);
      if (App.utils.vibrar) App.utils.vibrar([30, 40, 30]);
      document.getElementById("pinErrorMsg").textContent = "PIN incorreto, tente de novo";
      setTimeout(function () {
        pinBuffer = "";
        travado = false;
        updatePinDots();
        var msg = document.getElementById("pinErrorMsg");
        if (msg) msg.textContent = "";
      }, 650);
    }
  }

  function mostrarLockScreen(onUnlock) {
    onUnlockCb = onUnlock;
    pinBuffer = "";
    travado = false;
    var root = document.getElementById("lockScreen");
    root.style.display = "flex";
    renderLockScreen();
  }

  App.security = {
    pinAtivo: pinAtivo, definirPin: definirPin, removerPin: removerPin, verificarPin: verificarPin,
    toggleOfuscar: toggleOfuscar, ofuscarAtivo: ofuscarAtivo, mostrarLockScreen: mostrarLockScreen
  };
})(window.App);

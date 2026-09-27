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

  function renderLockScreen() {
    var root = document.getElementById("lockScreen");
    root.innerHTML =
      '<div class="lock-icon">' + App.ICONS.lock.replace('viewBox="0 0 24 24"', 'viewBox="0 0 24 24" width="34" height="34"') + "</div>" +
      "<h2>Digite seu PIN</h2>" +
      '<div class="pin-dots" id="pinDots"></div>' +
      '<div class="pin-error-msg" id="pinErrorMsg"></div>' +
      '<div class="pin-pad" id="pinPad">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button data-num="' + n + '">' + n + "</button>"; }).join("") +
        '<button class="pin-clear" data-action="clear">limpar</button>' +
        '<button data-num="0">0</button>' +
        '<button class="pin-clear" data-action="back">⌫</button>' +
      "</div>";
    updatePinDots();
    root.querySelectorAll("[data-num]").forEach(function (btn) {
      btn.addEventListener("click", function () { onPinDigit(btn.getAttribute("data-num")); });
    });
    root.querySelector('[data-action="clear"]').addEventListener("click", function () { pinBuffer = ""; updatePinDots(); });
    root.querySelector('[data-action="back"]').addEventListener("click", function () { pinBuffer = pinBuffer.slice(0, -1); updatePinDots(); });
  }

  function updatePinDots(errorState) {
    var el = document.getElementById("pinDots");
    if (!el) return;
    var html = "";
    for (var i = 0; i < 4; i++) {
      var filled = i < pinBuffer.length;
      html += '<div class="pin-dot' + (filled ? " filled" : "") + (errorState ? " error" : "") + '"></div>';
    }
    el.innerHTML = html;
  }

  function onPinDigit(n) {
    if (pinBuffer.length >= 4) return;
    pinBuffer += n;
    updatePinDots();
    if (pinBuffer.length === 4) {
      if (verificarPin(pinBuffer)) {
        pinBuffer = "";
        document.getElementById("lockScreen").style.display = "none";
        if (onUnlockCb) onUnlockCb();
      } else {
        updatePinDots(true);
        document.getElementById("pinErrorMsg").textContent = "PIN incorreto, tente de novo";
        setTimeout(function () { pinBuffer = ""; updatePinDots(); document.getElementById("pinErrorMsg").textContent = ""; }, 500);
      }
    }
  }

  function mostrarLockScreen(onUnlock) {
    onUnlockCb = onUnlock;
    pinBuffer = "";
    var root = document.getElementById("lockScreen");
    root.style.display = "flex";
    renderLockScreen();
  }

  App.security = {
    pinAtivo: pinAtivo, definirPin: definirPin, removerPin: removerPin, verificarPin: verificarPin,
    toggleOfuscar: toggleOfuscar, ofuscarAtivo: ofuscarAtivo, mostrarLockScreen: mostrarLockScreen
  };
})(window.App);

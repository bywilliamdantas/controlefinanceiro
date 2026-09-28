// ==== INIT ===================================================================
(function () {
  "use strict";
  var App = window.App;

  function startApp() {
    document.getElementById("fab").addEventListener("click", function () {
      var tab = App.ui.getTab();
      if (tab === "cartoes") App.sheets.openCartaoSheet();
      else if (tab === "lancamentos") App.sheets.openLancamentoSheet();
    });
    App.ui.render();
    if (App.state.prefs.notificacoesPush) App.notifications.checarLembretes(false);
  }

  function hideSplash() {
    var splash = document.getElementById("splash");
    if (splash) splash.classList.add("hide");
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (App.security.pinAtivo()) {
      document.getElementById("lockScreen").style.display = "flex";
      App.security.mostrarLockScreen(function () {
        hideSplash();
        startApp();
      });
      // A splash some assim que a tela de PIN estiver pronta pra uso.
      setTimeout(hideSplash, 250);
    } else {
      setTimeout(function () { hideSplash(); startApp(); }, 250);
    }

    if (navigator.serviceWorker && typeof navigator.serviceWorker.register === "function") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js").catch(function (e) { console.warn("sw register failed", e); });
      });
    }
  });
})();

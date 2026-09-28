// ==== NOTIFICAÇÕES PUSH (LEMBRETES) =========================================
// Importante: como este é um app estático (sem servidor próprio), não temos
// como enviar notificações push de verdade com o app fechado — isso exige um
// servidor de push. O que dá pra fazer com o que temos, e o que este módulo
// faz, é: (1) pedir permissão de notificação, (2) disparar notificações do
// sistema via Service Worker quando o app estiver aberto (em primeiro ou
// segundo plano) e (3) tentar Periodic Background Sync quando o navegador
// suportar, pra checar mesmo com o app fechado — mas isso não é garantido em
// todo dispositivo/navegador.
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils;

  function suportado() { return "Notification" in window && "serviceWorker" in navigator; }
  function permissaoConcedida() { return suportado() && Notification.permission === "granted"; }

  async function pedirPermissao() {
    if (!suportado()) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      var resultado = await Notification.requestPermission();
      return resultado === "granted";
    } catch (e) { console.warn("pedir permissão falhou", e); return false; }
  }

  async function ativarNotificacoes() {
    var ok = await pedirPermissao();
    App.state.prefs.notificacoesPush = ok;
    App.data.saveState();
    if (ok) {
      await tentarPeriodicSync();
      checarLembretes(true);
    }
    return ok;
  }

  function desativarNotificacoes() {
    App.state.prefs.notificacoesPush = false;
    App.data.saveState();
  }

  async function tentarPeriodicSync() {
    try {
      var reg = await navigator.serviceWorker.ready;
      if ("periodicSync" in reg) {
        var status = await navigator.permissions.query({ name: "periodic-background-sync" });
        if (status.state === "granted") {
          await reg.periodicSync.register("checar-lembretes", { minInterval: 12 * 60 * 60 * 1000 });
        }
      }
    } catch (e) { /* não suportado neste navegador — segue sem isso */ }
  }

  // Dispara uma notificação por contas vencendo hoje ou já vencidas, no
  // máximo uma vez por dia (pra não repetir toda vez que o app abre), a
  // menos que `forcar` seja true.
  async function checarLembretes(forcar) {
    if (!App.state.prefs.notificacoesPush || !permissaoConcedida()) return;
    var hoje = u.todayISO();
    if (!forcar && App.state.prefs.ultimaChecagemNotif === hoje) return;
    App.state.prefs.ultimaChecagemNotif = hoje;
    App.data.saveState();

    var urgentes = App.data.lembretesPendentes().filter(function (l) { return u.diasAte(l.vencimento) <= 0; });
    if (!urgentes.length) return;
    try {
      var reg = await navigator.serviceWorker.ready;
      var titulo = urgentes.length === 1 ? "1 conta vencendo" : urgentes.length + " contas vencendo";
      var corpo = urgentes.slice(0, 3).map(function (l) {
        return l.titulo + " · " + u.fmtBRL.format(l.valor);
      }).join("\n");
      await reg.showNotification(titulo, {
        body: corpo,
        icon: "assets/icon.png",
        badge: "assets/icon.png",
        tag: "lembretes-financeiro"
      });
    } catch (e) { console.warn("showNotification falhou", e); }
  }

  App.notifications = {
    suportado: suportado,
    permissaoConcedida: permissaoConcedida,
    ativarNotificacoes: ativarNotificacoes,
    desativarNotificacoes: desativarNotificacoes,
    checarLembretes: checarLembretes
  };
})(window.App);

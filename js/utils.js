// ==== UTILS =================================================================
// Funções puras de formatação e data, sem dependência de estado.
window.App = window.App || {};

(function (App) {
  "use strict";

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  function fmtMonth(ym) {
    var d = new Date(ym + "-02T00:00:00");
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  function fmtMonthShort(ym) {
    var d = new Date(ym + "-02T00:00:00");
    return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  }
  function fmtDate(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function diasAte(iso) {
    var hoje = new Date(todayISO() + "T00:00:00");
    var alvo = new Date(iso + "T00:00:00");
    return Math.round((alvo - hoje) / 86400000);
  }

  function shiftMonth(ym, delta) {
    var parts = ym.split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1 + delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  // Adds `delta` months to an ISO date, clamping the day so e.g. 31/jan + 1 mês
  // lands on 28/29 de fev instead of overflowing into março.
  function addMonthsToDate(iso, delta) {
    var parts = iso.split("-").map(Number);
    var y = parts[0], m = parts[1] - 1 + delta, day = parts[2];
    var lastDayOfTarget = new Date(y, m + 1, 0).getDate();
    var d = new Date(y, m, Math.min(day, lastDayOfTarget));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  App.utils = {
    uid: uid, fmtBRL: fmtBRL, fmtMonth: fmtMonth, fmtMonthShort: fmtMonthShort,
    fmtDate: fmtDate, todayISO: todayISO, diasAte: diasAte, shiftMonth: shiftMonth,
    addMonthsToDate: addMonthsToDate, escapeHtml: escapeHtml, capitalize: capitalize,
    debounce: debounce
  };
})(window.App);

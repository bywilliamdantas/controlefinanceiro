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
  // Data de HOJE no fuso do aparelho. (toISOString usa UTC: no Brasil, depois das
  // 21h já viraria "amanhã" e lançamentos/saldos pulavam um dia.)
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

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

  // Rótulo relativo pra agrupar lançamentos por dia na lista: "Hoje",
  // "Ontem" ou a data completa por extenso (ex: "22 de setembro").
  function fmtDiaRelativo(iso) {
    var dias = diasAte(iso);
    if (dias === 0) return "Hoje";
    if (dias === -1) return "Ontem";
    if (dias === 1) return "Amanhã";
    var d = new Date(iso + "T00:00:00");
    var hoje = new Date(todayISO() + "T00:00:00");
    var opts = { day: "numeric", month: "long" };
    if (d.getFullYear() !== hoje.getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("pt-BR", opts);
  }

  // Redimensiona e comprime uma imagem (File/Blob) pra um data URL JPEG
  // leve, pra não inflar demais o localStorage quando anexado como
  // comprovante. maxDim limita a maior dimensão em pixels.
  function comprimirImagem(file, maxDim, qualidade) {
    maxDim = maxDim || 900; qualidade = qualidade || 0.7;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Falha ao ler arquivo")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("Falha ao carregar imagem")); };
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
            else { w = Math.round(w * (maxDim / h)); h = maxDim; }
          }
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          try { resolve(canvas.toDataURL("image/jpeg", qualidade)); }
          catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Toque tátil leve ao confirmar ações (marcar como pago, excluir etc.).
  // Só funciona em navegadores/dispositivos que suportam a Vibration API
  // (tipicamente Android; iOS Safari não suporta) — falha silenciosamente
  // nos demais.
  function vibrar(padrao) {
    try { if (navigator.vibrate) navigator.vibrate(padrao || 15); } catch (e) {}
  }

  App.utils = {
    uid: uid, fmtBRL: fmtBRL, fmtMonth: fmtMonth, fmtMonthShort: fmtMonthShort,
    fmtDate: fmtDate, todayISO: todayISO, diasAte: diasAte, shiftMonth: shiftMonth,
    addMonthsToDate: addMonthsToDate, escapeHtml: escapeHtml, capitalize: capitalize,
    debounce: debounce, fmtDiaRelativo: fmtDiaRelativo, comprimirImagem: comprimirImagem,
    vibrar: vibrar
  };
})(window.App);

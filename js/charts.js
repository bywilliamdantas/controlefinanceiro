// ==== CHARTS =================================================================
// Gráficos desenhados manualmente em SVG inline, sem nenhuma biblioteca externa.
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils;

  // ---- Gráfico de pizza (gastos por categoria) ----
  function pieChart(dados, size, mostrarValor) {
    size = size || 132;
    var r = size / 2;
    if (!dados.length) return '<div class="chart-empty">Sem gastos neste mês ainda.</div>';
    var total = dados.reduce(function (s, d) { return s + d.valor; }, 0);
    if (total <= 0) return '<div class="chart-empty">Sem gastos neste mês ainda.</div>';

    var cx = r, cy = r, raio = r - 4;
    var anguloAtual = -Math.PI / 2;
    var paths = dados.map(function (d) {
      var fatia = (d.valor / total) * Math.PI * 2;
      var x1 = cx + raio * Math.cos(anguloAtual);
      var y1 = cy + raio * Math.sin(anguloAtual);
      anguloAtual += fatia;
      var x2 = cx + raio * Math.cos(anguloAtual);
      var y2 = cy + raio * Math.sin(anguloAtual);
      var largeArc = fatia > Math.PI ? 1 : 0;
      var d1 = dados.length === 1
        ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + raio + '" fill="' + d.cor + '"/>'
        : '<path d="M' + cx + ',' + cy + ' L' + x1.toFixed(2) + ',' + y1.toFixed(2) +
          ' A' + raio + ',' + raio + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(2) + ',' + y2.toFixed(2) + ' Z" fill="' + d.cor + '"/>';
      return d1;
    }).join("");

    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' + paths +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (raio * 0.56).toFixed(1) + '" fill="var(--surface)"/></svg>';

    var legend = '<div class="chart-legend">' + dados.slice(0, 8).map(function (d) {
      var pct = ((d.valor / total) * 100).toFixed(0);
      return '<div class="chart-legend-row">' +
        '<span class="chart-legend-dot" style="background:' + d.cor + '"></span>' +
        '<span class="chart-legend-label">' + u.escapeHtml(d.rotulo || d.categoria) + '</span>' +
        (mostrarValor ? '<span class="num" style="font-size:11.5px;color:var(--ink-soft)"><span class="' + (App.security.ofuscarAtivo() ? "value-blur" : "") + '">' + u.fmtBRL.format(d.valor) + '</span></span>' : '') +
        '<span class="chart-legend-value num">' + pct + '%</span>' +
      '</div>';
    }).join("") + '</div>';

    return '<div class="chart-wrap">' + svg + legend + '</div>';
  }

  // ---- Gráfico de linha (evolução do saldo nos últimos N meses) ----
  function lineChart(pontos, width, height) {
    width = width || 300; height = height || 130;
    if (!pontos.length) return '<div class="chart-empty">Sem dados suficientes ainda.</div>';
    var padL = 8, padR = 8, padT = 14, padB = 22;
    var w = width - padL - padR, h = height - padT - padB;
    var valores = pontos.map(function (p) { return p.saldo; });
    var min = Math.min(0, Math.min.apply(null, valores));
    var max = Math.max(0, Math.max.apply(null, valores));
    if (max === min) { max += 1; min -= 1; }
    var stepX = pontos.length > 1 ? w / (pontos.length - 1) : 0;

    function xAt(i) { return padL + i * stepX; }
    function yAt(v) { return padT + h - ((v - min) / (max - min)) * h; }

    var zeroY = yAt(0);
    var linePts = pontos.map(function (p, i) { return xAt(i).toFixed(1) + "," + yAt(p.saldo).toFixed(1); }).join(" ");
    var areaPts = "0," + zeroY.toFixed(1) + " " + linePts + " " + (padL + w).toFixed(1) + "," + zeroY.toFixed(1);

    var dots = pontos.map(function (p, i) {
      var cor = p.saldo >= 0 ? "var(--pos)" : "var(--red)";
      return '<circle cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(p.saldo).toFixed(1) + '" r="3.2" fill="' + cor + '"/>';
    }).join("");

    var labels = pontos.map(function (p, i) {
      return '<text class="evol-chart-label" x="' + xAt(i).toFixed(1) + '" y="' + (height - 4) + '" text-anchor="middle">' + u.capitalize(u.fmtMonthShort(p.mes)) + "</text>";
    }).join("");

    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '" preserveAspectRatio="xMidYMid meet">' +
        (min < 0 && max > 0 ? '<line x1="' + padL + '" y1="' + zeroY.toFixed(1) + '" x2="' + (padL + w) + '" y2="' + zeroY.toFixed(1) + '" stroke="var(--border)" stroke-width="1"/>' : "") +
        '<polygon points="' + areaPts + '" fill="var(--teal-soft)" opacity="0.55"/>' +
        '<polyline points="' + linePts + '" fill="none" stroke="var(--teal)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>' +
        dots + labels +
      "</svg>"
    );
  }

  // ---- Anel de progresso circular (meta do mês / meta por categoria) ----
  function ringChart(pct, cor, size) {
    size = size || 72;
    var r = size / 2 - 6;
    var c = size / 2;
    var circ = 2 * Math.PI * r;
    var pctClamped = Math.max(0, Math.min(100, pct));
    var offset = circ * (1 - pctClamped / 100);
    return (
      '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" class="ring-chart">' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--surface-2)" stroke-width="7"/>' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + cor + '" stroke-width="7" ' +
          'stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" ' +
          'transform="rotate(-90 ' + c + ' ' + c + ')"/>' +
        '<text x="' + c + '" y="' + (c + 4) + '" text-anchor="middle" class="ring-chart-label">' + pctClamped.toFixed(0) + "%</text>" +
      "</svg>"
    );
  }

  // ---- Gráfico de barras (gasto por categoria, mês a mês) ----
  function barChartCategoria(dados, width, height) {
    width = width || 300; height = height || 160;
    var meses = dados.meses, categorias = dados.categorias, porMes = dados.porMes;
    if (!categorias.length) return '<div class="chart-empty">Sem gastos nos últimos meses ainda.</div>';
    var padL = 6, padR = 6, padT = 10, padB = 22;
    var w = width - padL - padR, h = height - padT - padB;
    var totais = porMes.map(function (m) {
      return categorias.reduce(function (s, cat) { return s + (m.mapa[cat] || 0); }, 0);
    });
    var max = Math.max.apply(null, totais.concat([1]));
    var n = meses.length;
    var gap = w * 0.12 / n;
    var barW = (w - gap * (n + 1)) / n;

    var bars = "";
    porMes.forEach(function (m, i) {
      var x = padL + gap + i * (barW + gap);
      var yAcc = padT + h;
      categorias.forEach(function (cat) {
        var valor = m.mapa[cat] || 0;
        if (valor <= 0) return;
        var altura = (valor / max) * h;
        yAcc -= altura;
        bars += '<rect x="' + x.toFixed(1) + '" y="' + yAcc.toFixed(1) + '" width="' + barW.toFixed(1) +
          '" height="' + altura.toFixed(1) + '" fill="' + App.data.corCategoria(cat) + '" rx="2"/>';
      });
    });

    var labels = meses.map(function (m, i) {
      var x = padL + gap + i * (barW + gap) + barW / 2;
      return '<text class="evol-chart-label" x="' + x.toFixed(1) + '" y="' + (height - 4) + '" text-anchor="middle">' + u.capitalize(u.fmtMonthShort(m)) + "</text>";
    }).join("");

    var svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '" preserveAspectRatio="xMidYMid meet">' + bars + labels + "</svg>";
    var legend = '<div class="chart-legend chart-legend-row-wrap">' + categorias.slice(0, 8).map(function (cat) {
      return '<div class="chart-legend-row"><span class="chart-legend-dot" style="background:' + App.data.corCategoria(cat) + '"></span>' +
        '<span class="chart-legend-label">' + u.escapeHtml(cat) + "</span></div>";
    }).join("") + "</div>";
    return '<div class="chart-wrap chart-wrap-column">' + svg + legend + "</div>";
  }

  App.charts = { pieChart: pieChart, lineChart: lineChart, ringChart: ringChart, barChartCategoria: barChartCategoria };
})(window.App);

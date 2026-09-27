// ==== UI STATE & RENDER ======================================================
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils, ICONS = App.ICONS, data = App.data, sec = App.security, charts = App.charts;

  var TABS = [
    { id: "resumo", label: "Resumo", icon: ICONS.resumo },
    { id: "cartoes", label: "Cartões", icon: ICONS.cartoes },
    { id: "lancamentos", label: "Lançamentos", icon: ICONS.lancamentos },
    { id: "ajustes", label: "Ajustes", icon: ICONS.settings }
  ];

  var tab = "resumo";
  var mesSelecionado = new Date().toISOString().slice(0, 7);
  var filtros = { texto: "", categoria: "", cartaoId: "" };
  var selecionando = false;      // modo de seleção em massa (aba Lançamentos)
  var selecionados = [];         // ids dos lançamentos selecionados

  // ---- Toasts ----
  var toastTimer = null;
  function toastBase(html, ms) {
    var el = document.getElementById("toast");
    el.className = "toast";
    el.innerHTML = html;
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, ms || 2200);
  }
  function toast(msg) { toastBase('<span>' + u.escapeHtml(msg) + "</span>"); }
  function toastSuccess(msg) {
    var el = document.getElementById("toast");
    el.className = "toast toast-success";
    el.innerHTML = '<span class="toast-check">' + ICONS.check + "</span><span>" + u.escapeHtml(msg) + "</span>";
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }
  function toastUndo(msg, onUndo) {
    var el = document.getElementById("toast");
    el.className = "toast";
    el.innerHTML = '<span>' + u.escapeHtml(msg) + '</span><button class="toast-undo-btn" id="toastUndoBtn">Desfazer</button>';
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toastTimer);
    var done = false;
    document.getElementById("toastUndoBtn").addEventListener("click", function () {
      if (done) return;
      done = true;
      el.classList.remove("show");
      onUndo();
    });
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 5000);
  }

  function valSpan(text) { return '<span class="' + (sec.ofuscarAtivo() ? "value-blur" : "") + '">' + text + "</span>"; }

  // ---- Exclusão com desfazer ----
  function excluirComUndo(arrayRef, idx, item, msg, afterRestore) {
    arrayRef.splice(idx, 1);
    data.saveState();
    render();
    toastUndo(msg, function () {
      arrayRef.splice(idx, 0, item);
      data.saveState();
      if (afterRestore) afterRestore();
      render();
    });
  }

  // ---- Empty states ilustrados ----
  function emptyState(tipo) {
    var svgs = {
      cartoes: '<svg viewBox="0 0 120 120" fill="none"><rect x="14" y="38" width="92" height="60" rx="10" fill="var(--surface-2)"/><rect x="14" y="50" width="92" height="12" fill="var(--border)"/><rect x="26" y="76" width="34" height="8" rx="4" fill="var(--border)"/><circle cx="86" cy="30" r="16" fill="var(--teal-soft)"/><path d="M79 30l5 5 9-10" stroke="var(--teal)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
      lancamentos: '<svg viewBox="0 0 120 120" fill="none"><rect x="24" y="16" width="72" height="92" rx="8" fill="var(--surface-2)"/><line x1="36" y1="38" x2="84" y2="38" stroke="var(--border)" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="54" x2="84" y2="54" stroke="var(--border)" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="70" x2="66" y2="70" stroke="var(--border)" stroke-width="4" stroke-linecap="round"/><circle cx="86" cy="88" r="18" fill="var(--teal)"/><line x1="86" y1="80" x2="86" y2="96" stroke="var(--surface)" stroke-width="3.5" stroke-linecap="round"/><line x1="78" y1="88" x2="94" y2="88" stroke="var(--surface)" stroke-width="3.5" stroke-linecap="round"/></svg>',
      filtro: '<svg viewBox="0 0 120 120" fill="none"><circle cx="50" cy="50" r="30" fill="var(--surface-2)"/><line x1="72" y1="72" x2="98" y2="98" stroke="var(--border)" stroke-width="8" stroke-linecap="round"/></svg>'
    };
    var textos = {
      cartoes: ["Nenhum cartão cadastrado", "Adicione seus cartões pra acompanhar limite e uso."],
      lancamentos: ["Nenhum lançamento ainda", "Toque no + para registrar seu primeiro gasto."],
      filtro: ["Nada encontrado", "Tente ajustar a busca ou os filtros."]
    };
    return '<div class="empty-illustrated">' + svgs[tipo] +
      '<p class="empty-title">' + textos[tipo][0] + "</p>" +
      '<p class="empty-sub">' + textos[tipo][1] + "</p></div>";
  }

  // ---- Resumo ----
  function renderLembretesCard() {
    var lembretes = data.lembretesPendentes();
    if (lembretes.length === 0) return "";
    return (
      '<div class="card lembretes-card">' +
        '<p class="card-label">' + ICONS.bell.replace("<svg ", '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" ') + "Contas a vencer</p>" +
        lembretes.map(function (l) {
          var dias = u.diasAte(l.vencimento);
          var badge = dias < 0 ? '<span class="badge badge-vencida">Vencida</span>'
            : dias === 0 ? '<span class="badge badge-vencida">Vence hoje</span>'
            : '<span class="badge badge-em-breve">' + dias + (dias === 1 ? " dia" : " dias") + "</span>";
          return '<div class="lembrete-row"><span class="t">' + u.escapeHtml(l.titulo) + '</span><span class="num" style="font-size:13px">' + valSpan(u.fmtBRL.format(l.valor)) + "</span>" + badge + "</div>";
        }).join("") +
      "</div>"
    );
  }

  function renderComparativoCard() {
    var c = data.comparativoMesAnterior(mesSelecionado);
    if (!c.temAnterior && c.atual === 0) return "";
    var subiu = c.pct >= 0;
    return (
      '<div class="card">' +
        '<p class="card-label">Comparado ao mês anterior</p>' +
        '<div class="compare-row">' +
          '<span class="compare-badge ' + (subiu ? "up" : "down") + '">' + (subiu ? "▲" : "▼") + " " + Math.abs(c.pct).toFixed(0) + "%</span>" +
          '<span class="compare-note">' + (subiu ? "a mais" : "a menos") + " que em " + u.fmtMonth(u.shiftMonth(mesSelecionado, -1)) + "</span>" +
        "</div>" +
      "</div>"
    );
  }

  function renderGraficoCategoriaCard() {
    var dados = data.gastosPorCategoria(mesSelecionado);
    return (
      '<div class="card">' +
        '<p class="card-label">Gastos por categoria</p>' +
        charts.pieChart(dados) +
      "</div>"
    );
  }

  function renderGraficoEvolucaoCard() {
    var pontos = data.saldoUltimosMeses(mesSelecionado, 6);
    return (
      '<div class="card">' +
        '<p class="card-label">Evolução do saldo (6 meses)</p>' +
        charts.lineChart(pontos) +
      "</div>"
    );
  }

  function renderMetaCard() {
    var m = data.metaRestante(mesSelecionado);
    if (!m) {
      return (
        '<div class="card">' +
          '<p class="card-label">' + ICONS.target.replace("<svg ", '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" ') + "Meta de economia</p>" +
          '<button class="btn btn-ghost" id="btnDefinirMeta">Definir meta para ' + u.fmtMonth(mesSelecionado) + "</button>" +
        "</div>"
      );
    }
    var estourou = m.restante < 0;
    return (
      '<div class="card">' +
        '<div class="meta-row">' +
          '<p class="card-label" style="margin:0">' + ICONS.target.replace("<svg ", '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" ') + "Meta de economia</p>" +
          '<button class="meta-edit-link" id="btnDefinirMeta">editar</button>' +
        "</div>" +
        '<p class="big-number num ' + (estourou ? "saldo-neg" : "saldo-pos") + '" style="font-size:26px">' +
          valSpan(estourou ? "Estourou em " + u.fmtBRL.format(Math.abs(m.restante)) : u.fmtBRL.format(m.restante) + " restantes") +
        "</p>" +
        '<div class="bar-track" style="margin-top:8px"><div class="bar-fill' + (m.pct > 90 ? " high" : "") + '" style="width:' + m.pct.toFixed(1) + '%"></div></div>' +
        '<p class="meta-row meta-restante" style="margin-top:8px">' + valSpan(u.fmtBRL.format(m.gasto)) + " de " + valSpan(u.fmtBRL.format(m.alvo)) + "</p>" +
      "</div>"
    );
  }

  function renderReceitasExtrasCard() {
    var lista = App.state.receitasExtras.filter(function (r) { return r.mes === mesSelecionado; });
    return (
      '<div class="card">' +
        '<div class="meta-row"><p class="card-label" style="margin:0">Receita extra em ' + u.fmtMonth(mesSelecionado) + "</p>" +
          '<button class="meta-edit-link" id="btnAddReceitaExtra">+ adicionar</button></div>' +
        (lista.length === 0
          ? '<p style="font-size:13px;color:var(--ink-soft);margin:6px 0 0">Freelance, bônus ou qualquer renda além do fixo.</p>'
          : lista.map(function (r) {
              return '<div class="lembrete-row"><span class="t">' + u.escapeHtml(r.titulo) + '</span>' +
                '<span class="num" style="font-size:13px">' + valSpan(u.fmtBRL.format(r.valor)) + "</span>" +
                '<button class="icon-btn icon-btn-del" data-del-receita="' + r.id + '" aria-label="Excluir">' + ICONS.trash + "</button></div>";
            }).join("")
        ) +
      "</div>"
    );
  }

  function renderResumo() {
    var d = data.despesasDoMes(mesSelecionado);
    var s = data.saldoDoMes(mesSelecionado);
    return (
      renderLembretesCard() +
      '<div class="card">' +
        '<p class="card-label">Despesas em ' + u.fmtMonth(mesSelecionado) + '</p>' +
        '<p class="big-number num">' + valSpan(u.fmtBRL.format(d)) + "</p>" +
      "</div>" +
      '<div class="card">' +
        '<p class="card-label">Saldo</p>' +
        '<p class="big-number num ' + (s >= 0 ? "saldo-pos" : "saldo-neg") + '" id="saldoValue">' + valSpan(u.fmtBRL.format(s)) + "</p>" +
      "</div>" +
      renderComparativoCard() +
      renderMetaCard() +
      renderGraficoCategoriaCard() +
      renderGraficoEvolucaoCard()
    );
  }

  // ---- Ajustes ----
  function renderAjustes() {
    return (
      '<div class="card">' +
        '<p class="card-label">Renda fixa em ' + u.fmtMonth(mesSelecionado) + '</p>' +
        '<input id="salarioInput" type="number" inputmode="decimal" step="0.01" min="0" value="' + (data.salarioDoMes(mesSelecionado) || "") + '" placeholder="0,00">' +
        '<p style="font-size:12px;color:var(--ink-soft);margin:8px 0 0">Vale a partir de ' + u.fmtMonth(mesSelecionado) + '; meses anteriores não mudam.</p>' +
      "</div>" +
      renderReceitasExtrasCard() +
      '<div class="card">' +
        '<p class="card-label">Backup dos dados</p>' +
        '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Seus dados ficam salvos só neste navegador. Exporte um backup de vez em quando para não perdê-los.</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-ghost" id="exportBackupBtn">Exportar backup</button>' +
          '<button class="btn btn-ghost" id="importBackupBtn">Importar backup</button>' +
        "</div>" +
        '<input type="file" id="importBackupFile" accept="application/json" style="display:none">' +
      "</div>" +
      '<div class="card">' +
        '<p class="card-label">Segurança</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-ghost" id="btnPinConfig">' + (sec.pinAtivo() ? "Alterar/remover PIN" : "Ativar PIN de acesso") + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="card">' +
        '<p class="card-label">Aplicativo</p>' +
        '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Se o app parecer desatualizado (mesmo depois de instalado na tela inicial), use este botão para forçar a sincronização com a versão mais recente. Seus dados salvos não são apagados.</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-ghost" id="btnForceSync">Atualizar</button>' +
        "</div>" +
      "</div>"
    );
  }

  // ---- Cartões ----
  function renderCartoes() {
    if (App.state.cartoes.length === 0) return emptyState("cartoes");
    return App.state.cartoes.map(function (c) {
      var det = data.usadoCartaoDetalhado(c.id);
      var usado = det.total;
      var restante = c.limite - usado;
      var pct = c.limite > 0 ? Math.min(100, (usado / c.limite) * 100) : 0;
      var partes = [];
      if (det.recorrente > 0) partes.push(u.fmtBRL.format(det.recorrente) + " recorrentes deste mês");
      if (det.parcelado > 0) partes.push(u.fmtBRL.format(det.parcelado) + " em parcelas abertas");
      var detalhe = partes.length ? '<p class="cartao-detalhe">' + valSpan(partes.join(" · ")) + "</p>" : "";
      return (
        '<div class="card cartao-item" data-cartao="' + c.id + '">' +
          '<div class="head"><h3>' + u.escapeHtml(c.nome) + '</h3>' +
            '<button class="icon-btn icon-btn-del" data-del-cartao="' + c.id + '" aria-label="Excluir cartão">' + ICONS.trash + "</button>" +
          "</div>" +
          '<div class="cartao-stats">' +
            "<span>Limite" + "<b class=\"num\">" + valSpan(u.fmtBRL.format(c.limite)) + "</b></span>" +
            "<span>Usado" + "<b class=\"num\">" + valSpan(u.fmtBRL.format(usado)) + "</b></span>" +
            "<span>Restante" + "<b class=\"num\">" + valSpan(u.fmtBRL.format(restante)) + "</b></span>" +
          "</div>" +
          detalhe +
          '<div class="bar-track"><div class="bar-fill' + (pct > 80 ? " high" : "") + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        "</div>"
      );
    }).join("");
  }

  // ---- Lançamentos (com filtros) ----
  function lancamentosFiltrados() {
    var texto = filtros.texto.trim().toLowerCase();
    return App.state.lancamentos.filter(function (l) {
      if (filtros.categoria && l.categoria !== filtros.categoria) return false;
      if (filtros.cartaoId && l.cartaoId !== filtros.cartaoId) return false;
      if (texto && l.titulo.toLowerCase().indexOf(texto) === -1) return false;
      return true;
    });
  }

  function renderFilterBar() {
    var cats = data.categoriasTodas();
    var catOptions = '<option value="">Todas categorias</option>' + cats.map(function (c) {
      return '<option value="' + c + '"' + (filtros.categoria === c ? " selected" : "") + '>' + c + "</option>";
    }).join("");
    var cartaoOptions = '<option value="">Todos cartões</option>' + App.state.cartoes.map(function (c) {
      return '<option value="' + c.id + '"' + (filtros.cartaoId === c.id ? " selected" : "") + '>' + u.escapeHtml(c.nome) + "</option>";
    }).join("");
    return (
      '<div class="filter-bar">' +
        '<div class="filter-search">' + ICONS.search +
          '<input id="filtroTexto" type="text" placeholder="Buscar por título" value="' + u.escapeHtml(filtros.texto) + '">' +
        "</div>" +
        '<div class="filter-selects">' +
          '<select id="filtroCategoria">' + catOptions + "</select>" +
          '<select id="filtroCartao">' + cartaoOptions + "</select>" +
        "</div>" +
      "</div>"
    );
  }

  function renderBulkBar() {
    var visiveis = lancamentosFiltrados().map(function (l) { return l.id; });
    var todosSelecionados = visiveis.length > 0 && visiveis.every(function (id) { return selecionados.indexOf(id) !== -1; });
    var n = selecionados.length;
    return (
      '<div class="bulk-bar">' +
        '<button class="icon-btn" id="bulkClose" aria-label="Cancelar seleção">' + ICONS.close + "</button>" +
        '<span class="bulk-count">' + n + (n === 1 ? " selecionado" : " selecionados") + "</span>" +
        '<div class="bulk-actions">' +
          '<button class="btn-bulk" id="bulkSelectAll">' + (todosSelecionados ? "Limpar" : "Todos") + "</button>" +
          '<button class="btn-bulk" id="bulkEditar"' + (n === 0 ? " disabled" : "") + '>Editar</button>' +
          '<button class="btn-bulk" id="bulkPago"' + (n === 0 ? " disabled" : "") + '>Pago</button>' +
          '<button class="btn-bulk" id="bulkAberto"' + (n === 0 ? " disabled" : "") + '>Aberto</button>' +
          '<button class="btn-bulk danger" id="bulkExcluir"' + (n === 0 ? " disabled" : "") + '>Excluir</button>' +
        "</div>" +
      "</div>"
    );
  }

  function renderLancamentos() {
    var filtrando = !!(filtros.texto || filtros.categoria || filtros.cartaoId);
    if (App.state.lancamentos.length === 0) return emptyState("lancamentos");
    var lista = lancamentosFiltrados();
    var barra = renderFilterBar();
    if (lista.length === 0) return barra + emptyState("filtro");
    var ordenados = lista.slice().sort(function (a, b) { return b.vencimento.localeCompare(a.vencimento); });
    var nota = filtrando ? '<p class="filter-empty-note">' + ordenados.length + " resultado" + (ordenados.length === 1 ? "" : "s") +
      ' · <span class="filter-clear" id="limparFiltros">limpar filtros</span></p>' : "";
    var linhas = ordenados.map(function (l) {
      var cartaoNome = "";
      if (l.cartaoId) {
        var c = App.state.cartoes.filter(function (x) { return x.id === l.cartaoId; })[0];
        if (c) cartaoNome = " · " + c.nome;
      }
      var dias = u.diasAte(l.vencimento);
      var vencida = l.status === "aberto" && dias < 0;
      var emBreve = l.status === "aberto" && dias >= 0 && dias <= 3;
      var rowClass = vencida ? " vencida" : (emBreve ? " em-breve" : "");
      var dotClass = l.status === "aberto" ? (vencida ? " vencida" : " aberto") : "";
      var tag = "";
      if (l.totalParcelas > 1) tag = ' · <span class="parcela-tag">' + l.parcelaAtual + "/" + l.totalParcelas + "</span>";
      else if (l.recorrente) tag = " · " + ICONS.repeat.replace("<svg ", '<svg style="width:11px;height:11px;vertical-align:-1px" ');
      var checked = selecionados.indexOf(l.id) !== -1;
      var indicador = selecionando
        ? '<span class="lanc-check' + (checked ? " checked" : "") + '">' + (checked ? ICONS.check : "") + "</span>"
        : '<span class="lanc-dot' + dotClass + '" title="' + l.status + '"></span>';
      var acoes = selecionando
        ? ""
        : '<button class="icon-btn" data-edit-lanc="' + l.id + '" aria-label="Editar">' + ICONS.edit + "</button>" +
          '<button class="icon-btn icon-btn-del" data-del-lanc="' + l.id + '" aria-label="Excluir">' + ICONS.trash + "</button>";
      return (
        '<div class="lanc-item' + rowClass + (checked ? " selected" : "") + '" data-lanc="' + l.id + '">' +
          indicador +
          '<div class="lanc-info">' +
            '<div class="t">' + u.escapeHtml(l.titulo) + "</div>" +
            '<div class="m">' + u.fmtDate(l.vencimento) + " · " + l.categoria + cartaoNome + tag + "</div>" +
          "</div>" +
          '<div class="lanc-valor num">' + valSpan(u.fmtBRL.format(l.valor)) + "</div>" +
          acoes +
        "</div>"
      );
    }).join("");
    return barra + nota + linhas + (selecionando ? renderBulkBar() : "");
  }

  // ---- Orquestração ----
  function renderTabbar() {
    var el = document.getElementById("tabbar");
    el.innerHTML = TABS.map(function (t) {
      return '<button data-tab="' + t.id + '" class="' + (tab === t.id ? "active" : "") + '">' + t.icon + "<span>" + t.label + "</span></button>";
    }).join("");
    el.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        tab = btn.getAttribute("data-tab");
        if (tab !== "lancamentos") { selecionando = false; selecionados = []; }
        render();
      });
    });
  }

  function renderTopActions() {
    var el = document.getElementById("topActions");
    var eyeBtn = '<button class="eye-toggle" id="eyeToggle" aria-label="Ocultar valores">' + (sec.ofuscarAtivo() ? ICONS.eyeOff : ICONS.eye) + "</button>";
    var extra = "";
    if (tab === "lancamentos") {
      extra =
        '<button id="exportBtn" aria-label="Exportar CSV">' + ICONS.download + "</button>" +
        '<button id="selectModeBtn" aria-label="Selecionar lançamentos" class="' + (selecionando ? "active" : "") + '">' + ICONS.selectMode + "</button>";
    } else if (tab === "resumo") {
      extra =
        '<div class="month-nav">' +
          '<button id="prevMonth" aria-label="Mês anterior">' + ICONS.prev + "</button>" +
          '<button id="nextMonth" aria-label="Mês seguinte">' + ICONS.next + "</button>" +
        "</div>";
    }
    el.innerHTML = extra + eyeBtn;
    if (document.getElementById("exportBtn")) document.getElementById("exportBtn").addEventListener("click", App.backup.exportarCSV);
    if (document.getElementById("selectModeBtn")) document.getElementById("selectModeBtn").addEventListener("click", function () {
      selecionando = !selecionando;
      if (!selecionando) selecionados = [];
      render();
    });
    if (document.getElementById("prevMonth")) document.getElementById("prevMonth").addEventListener("click", function () { mesSelecionado = u.shiftMonth(mesSelecionado, -1); render(); });
    if (document.getElementById("nextMonth")) document.getElementById("nextMonth").addEventListener("click", function () { mesSelecionado = u.shiftMonth(mesSelecionado, 1); render(); });
    document.getElementById("eyeToggle").addEventListener("click", function () { sec.toggleOfuscar(); render(); });
  }

  function render() {
    document.getElementById("pageTitle").textContent = TABS.filter(function (t) { return t.id === tab; })[0].label;
    document.getElementById("monthLabel").textContent = tab === "resumo" ? u.capitalize(u.fmtMonth(mesSelecionado)) : "";
    document.getElementById("fab").style.display = (tab === "cartoes" || tab === "lancamentos") ? "flex" : "none";
    renderTabbar();
    renderTopActions();
    var main = document.getElementById("main");
    main.classList.remove("tab-enter");
    if (tab === "resumo") main.innerHTML = renderResumo();
    else if (tab === "cartoes") main.innerHTML = renderCartoes();
    else if (tab === "lancamentos") main.innerHTML = renderLancamentos();
    else main.innerHTML = renderAjustes();
    void main.offsetWidth;
    main.classList.add("tab-enter");
    bindMainEvents();
  }

  function bindMainEvents() {
    var salarioInput = document.getElementById("salarioInput");
    if (salarioInput) {
      salarioInput.addEventListener("input", function () {
        data.definirSalarioDoMes(mesSelecionado, parseFloat(salarioInput.value) || 0);
        data.saveState();
        var saldoEl = document.getElementById("saldoValue");
        if (saldoEl) {
          var s = data.saldoDoMes(mesSelecionado);
          saldoEl.innerHTML = valSpan(u.fmtBRL.format(s));
          saldoEl.className = "big-number num " + (s >= 0 ? "saldo-pos" : "saldo-neg");
        }
      });
    }

    var filtroTexto = document.getElementById("filtroTexto");
    if (filtroTexto) {
      var onTextoInput = u.debounce(function () { filtros.texto = filtroTexto.value; render(); }, 220);
      filtroTexto.addEventListener("input", onTextoInput);
    }
    var filtroCategoria = document.getElementById("filtroCategoria");
    if (filtroCategoria) filtroCategoria.addEventListener("change", function () { filtros.categoria = filtroCategoria.value; render(); });
    var filtroCartao = document.getElementById("filtroCartao");
    if (filtroCartao) filtroCartao.addEventListener("change", function () { filtros.cartaoId = filtroCartao.value; render(); });
    var limparFiltros = document.getElementById("limparFiltros");
    if (limparFiltros) limparFiltros.addEventListener("click", function () { filtros = { texto: "", categoria: "", cartaoId: "" }; render(); });

    var exportBackupBtn = document.getElementById("exportBackupBtn");
    if (exportBackupBtn) exportBackupBtn.addEventListener("click", App.backup.exportarBackup);
    var importBackupBtn = document.getElementById("importBackupBtn");
    var importBackupFile = document.getElementById("importBackupFile");
    if (importBackupBtn && importBackupFile) {
      importBackupBtn.addEventListener("click", function () { importBackupFile.click(); });
      importBackupFile.addEventListener("change", function () {
        App.backup.importarBackup(importBackupFile.files[0]);
        importBackupFile.value = "";
      });
    }

    var btnPinConfig = document.getElementById("btnPinConfig");
    if (btnPinConfig) btnPinConfig.addEventListener("click", function () { App.sheets.openPinConfigSheet(); });
    var btnForceSync = document.getElementById("btnForceSync");
    if (btnForceSync) btnForceSync.addEventListener("click", function () {
      if (!window.confirm("Isso vai buscar a versão mais nova do app e recarregar a página. Seus dados salvos continuam intactos. Continuar?")) return;
      App.backup.forcarSincronizacao();
    });
    var btnDefinirMeta = document.getElementById("btnDefinirMeta");
    if (btnDefinirMeta) btnDefinirMeta.addEventListener("click", function () { App.sheets.openMetaSheet(mesSelecionado); });
    var btnAddReceitaExtra = document.getElementById("btnAddReceitaExtra");
    if (btnAddReceitaExtra) btnAddReceitaExtra.addEventListener("click", function () { App.sheets.openReceitaExtraSheet(mesSelecionado); });

    document.querySelectorAll("[data-del-receita]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-del-receita");
        var idx = App.state.receitasExtras.findIndex(function (x) { return x.id === id; });
        if (idx === -1) return;
        var item = App.state.receitasExtras[idx];
        excluirComUndo(App.state.receitasExtras, idx, item, "Receita extra excluída");
      });
    });

    document.querySelectorAll("[data-del-cartao]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-del-cartao");
        var idx = App.state.cartoes.findIndex(function (x) { return x.id === id; });
        if (idx === -1) return;
        var c = App.state.cartoes[idx];
        if (!window.confirm('Excluir o cartão "' + c.nome + '"? Os lançamentos vinculados a ele não serão apagados.')) return;
        excluirComUndo(App.state.cartoes, idx, c, "Cartão excluído");
      });
    });

    document.querySelectorAll("[data-del-lanc]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-del-lanc");
        var idx = App.state.lancamentos.findIndex(function (x) { return x.id === id; });
        if (idx === -1) return;
        var l = App.state.lancamentos[idx];
        var msg = l.totalParcelas > 1
          ? 'Excluir só esta parcela (' + l.parcelaAtual + "/" + l.totalParcelas + ')? As outras parcelas continuam.'
          : 'Excluir "' + l.titulo + '"?';
        if (!window.confirm(msg)) return;
        excluirComUndo(App.state.lancamentos, idx, l, "Lançamento excluído");
      });
    });

    document.querySelectorAll("[data-lanc]").forEach(function (row) {
      row.addEventListener("click", function () {
        var id = row.getAttribute("data-lanc");
        if (selecionando) {
          var idx = selecionados.indexOf(id);
          if (idx === -1) selecionados.push(id); else selecionados.splice(idx, 1);
          render();
          return;
        }
        var l = App.state.lancamentos.filter(function (x) { return x.id === id; })[0];
        if (!l) return;
        var vaiPagar = l.status === "aberto";
        l.status = vaiPagar ? "pago" : "aberto";
        data.saveState();
        if (vaiPagar) {
          row.classList.add("just-paid");
          toastSuccess("Marcado como pago");
        } else {
          toast("Marcado como em aberto");
        }
        setTimeout(render, vaiPagar ? 260 : 0);
      });
    });

    document.querySelectorAll("[data-edit-lanc]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-edit-lanc");
        var l = App.state.lancamentos.filter(function (x) { return x.id === id; })[0];
        if (!l) return;
        App.sheets.openLancamentoSheet(l);
      });
    });

    var bulkClose = document.getElementById("bulkClose");
    if (bulkClose) bulkClose.addEventListener("click", function () { selecionando = false; selecionados = []; render(); });

    var bulkSelectAll = document.getElementById("bulkSelectAll");
    if (bulkSelectAll) bulkSelectAll.addEventListener("click", function () {
      var visiveis = lancamentosFiltrados().map(function (l) { return l.id; });
      var todosSelecionados = visiveis.length > 0 && visiveis.every(function (id) { return selecionados.indexOf(id) !== -1; });
      selecionados = todosSelecionados ? [] : visiveis.slice();
      render();
    });

    var bulkPago = document.getElementById("bulkPago");
    if (bulkPago) bulkPago.addEventListener("click", function () {
      if (selecionados.length === 0) return;
      App.state.lancamentos.forEach(function (l) { if (selecionados.indexOf(l.id) !== -1) l.status = "pago"; });
      data.saveState();
      selecionando = false; selecionados = [];
      render();
      toastSuccess("Marcados como pagos");
    });

    var bulkAberto = document.getElementById("bulkAberto");
    if (bulkAberto) bulkAberto.addEventListener("click", function () {
      if (selecionados.length === 0) return;
      App.state.lancamentos.forEach(function (l) { if (selecionados.indexOf(l.id) !== -1) l.status = "aberto"; });
      data.saveState();
      selecionando = false; selecionados = [];
      render();
      toast("Marcados como em aberto");
    });

    var bulkEditar = document.getElementById("bulkEditar");
    if (bulkEditar) bulkEditar.addEventListener("click", function () {
      if (selecionados.length === 0) return;
      App.sheets.openBulkEditSheet(selecionados.slice());
    });

    var bulkExcluir = document.getElementById("bulkExcluir");
    if (bulkExcluir) bulkExcluir.addEventListener("click", function () {
      if (selecionados.length === 0) return;
      if (!window.confirm("Excluir " + selecionados.length + " lançamentos selecionados?")) return;
      var ids = selecionados.slice();
      var removidos = App.state.lancamentos.filter(function (l) { return ids.indexOf(l.id) !== -1; });
      App.state.lancamentos = App.state.lancamentos.filter(function (l) { return ids.indexOf(l.id) === -1; });
      data.saveState();
      selecionando = false; selecionados = [];
      render();
      toastUndo(ids.length + " lançamentos excluídos", function () {
        App.state.lancamentos = App.state.lancamentos.concat(removidos);
        data.saveState();
        render();
      });
    });
  }

  App.ui = {
    TABS: TABS,
    getTab: function () { return tab; }, setTab: function (t) { tab = t; },
    getMes: function () { return mesSelecionado; }, setMes: function (m) { mesSelecionado = m; },
    render: render, bindMainEvents: bindMainEvents,
    toast: toast, toastSuccess: toastSuccess, toastUndo: toastUndo, valSpan: valSpan,
    exitSelecao: function () { selecionando = false; selecionados = []; }
  };
})(window.App);

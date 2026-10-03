// ==== UI STATE & RENDER ======================================================
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils, ICONS = App.ICONS, data = App.data, sec = App.security, charts = App.charts;

  var TABS = [
    { id: "resumo", label: "Resumo", icon: ICONS.resumo },
    { id: "cartoes", label: "Contas", icon: ICONS.cartoes },
    { id: "lancamentos", label: "Lançamentos", icon: ICONS.lancamentos },
    { id: "extrato", label: "Extrato", icon: ICONS.extrato },
    { id: "ajustes", label: "Ajustes", icon: ICONS.settings }
  ];

  var tab = "resumo";
  var mesSelecionado = u.todayISO().slice(0, 7);
  var filtros = { texto: "", categoria: "", cartaoId: "", status: "", meio: "", todos: false };
  var extFiltro = { status: "realizadas", conta: "" }; // filtros da aba Extrato
  var selecionando = false;      // modo de seleção em massa (aba Lançamentos)
  var selecionados = [];         // ids dos lançamentos selecionados
  var swipeSuppressClick = false; // evita disparar o toggle de pago ao fechar um swipe com toque

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
    u.vibrar(20);
    render();
    toastUndo(msg, function () {
      arrayRef.splice(idx, 0, item);
      data.saveState();
      if (afterRestore) afterRestore();
      render();
    });
  }

  // ---- Swipe pra revelar editar/excluir (aba Lançamentos, toque) ----
  // Arrastar o item pra esquerda revela um painel de ações atrás dele, como
  // em apps de finanças no celular. Um toque simples (sem arrastar) continua
  // funcionando normalmente pra marcar como pago; se o item já estiver
  // aberto (swiped) e o usuário tocar nele, o toque só fecha o painel.
  function bindSwipeLancamentos() {
    var ACTIONS_WIDTH = 148; // painel Editar/Excluir (arrastar pra esquerda)
    var PAY_WIDTH = 88;      // painel Pagar/Reabrir (arrastar pra direita)
    var openWrap = null;
    function fechar(wrap) {
      if (!wrap) return;
      var item = wrap.querySelector(".lanc-item");
      item.style.transform = "translateX(0)";
      wrap.classList.remove("swiped", "swiped-pay");
      // painéis de ação só ficam visíveis durante/depois do arraste (evita cor vazando nos cantos)
      setTimeout(function () { if (!wrap.classList.contains("swiped") && !wrap.classList.contains("swiped-pay")) wrap.classList.remove("reveal"); }, 260);
      if (openWrap === wrap) openWrap = null;
    }
    document.querySelectorAll(".lanc-swipe").forEach(function (wrap) {
      var item = wrap.querySelector(".lanc-item");
      var startX = 0, startY = 0, baseX = 0, dragging = false, moved = false;
      // Transação de Alimentação já foi descontada: não há "pagar/reabrir" pra revelar.
      var payW = wrap.classList.contains("no-pay") ? 0 : PAY_WIDTH;
      function limitar(x) { return Math.min(payW, Math.max(-ACTIONS_WIDTH, x)); }
      item.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragging = true; moved = false;
        startX = e.clientX; startY = e.clientY;
        baseX = wrap.classList.contains("swiped") ? -ACTIONS_WIDTH : (wrap.classList.contains("swiped-pay") ? payW : 0);
        item.style.transition = "none";
      });
      item.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var dx = e.clientX - startX, dy = e.clientY - startY;
        if (!moved && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (!moved && Math.abs(dy) > Math.abs(dx)) { dragging = false; return; } // é scroll vertical
        moved = true;
        wrap.classList.add("reveal");
        item.style.transform = "translateX(" + limitar(baseX + dx) + "px)";
      });
      function terminar(e) {
        if (!dragging) return;
        dragging = false;
        item.style.transition = "";
        if (!moved) {
          if (wrap.classList.contains("swiped") || wrap.classList.contains("swiped-pay")) {
            fechar(wrap);
            swipeSuppressClick = true;
            setTimeout(function () { swipeSuppressClick = false; }, 400);
          }
          return;
        }
        var finalX = limitar(baseX + (e.clientX - startX));
        if (openWrap && openWrap !== wrap) fechar(openWrap);
        wrap.classList.remove("swiped", "swiped-pay");
        if (finalX < -ACTIONS_WIDTH / 2) {
          item.style.transform = "translateX(-" + ACTIONS_WIDTH + "px)";
          wrap.classList.add("swiped");
          openWrap = wrap;
          u.vibrar(10);
        } else if (payW > 0 && finalX > payW / 2) {
          item.style.transform = "translateX(" + payW + "px)";
          wrap.classList.add("swiped-pay");
          openWrap = wrap;
          u.vibrar(10);
        } else {
          fechar(wrap);
        }
        swipeSuppressClick = true;
        // Salvaguarda: em alguns navegadores o "click" sintético não chega a
        // disparar depois de um arraste, então o flag nunca seria resetado
        // pelo listener de clique — sem isso, a próxima linha tocada
        // ignoraria seu primeiro toque indevidamente.
        setTimeout(function () { swipeSuppressClick = false; }, 400);
      }
      item.addEventListener("pointerup", terminar);
      item.addEventListener("pointercancel", terminar);
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
      cartoes: ["Nenhuma conta cadastrada", "Adicione suas contas e cartões pra acompanhar limite, saldo e uso."],
      lancamentos: ["Nenhum lançamento ainda", "Toque no + para registrar seu primeiro gasto."],
      filtro: ["Nada encontrado", "Tente ajustar a busca ou os filtros."]
    };
    return '<div class="empty-illustrated">' + svgs[tipo] +
      '<p class="empty-title">' + textos[tipo][0] + "</p>" +
      '<p class="empty-sub">' + textos[tipo][1] + "</p></div>";
  }

  // ---- Resumo ----
  // "Contas a vencer" compacto: cabeçalho com contagem + total, resumo por
  // urgência, só as 3 mais urgentes à vista e o resto sob "Ver todas".
  var lembretesExpandido = false;
  var LEMBRETES_VISIVEIS = 3;
  function renderLembretesCard() {
    var lembretes = data.lembretesPendentes();
    if (lembretes.length === 0) return "";
    var vencidas = 0, hoje = 0, breve = 0, total = 0;
    lembretes.forEach(function (l) {
      var d = u.diasAte(l.vencimento);
      total += l.valor;
      if (d < 0) vencidas++; else if (d === 0) hoje++; else breve++;
    });
    var chips = [];
    if (vencidas) chips.push('<span class="lem-chip red">' + vencidas + (vencidas === 1 ? " vencida" : " vencidas") + "</span>");
    if (hoje) chips.push('<span class="lem-chip red">' + hoje + (hoje === 1 ? " vence hoje" : " vencem hoje") + "</span>");
    if (breve) chips.push('<span class="lem-chip">' + breve + " em até 7 dias</span>");
    var visiveis = lembretesExpandido ? lembretes : lembretes.slice(0, LEMBRETES_VISIVEIS);
    var resto = lembretes.length - LEMBRETES_VISIVEIS;
    var linhas = visiveis.map(function (l) {
      var dias = u.diasAte(l.vencimento);
      var situ = dias < 0 ? '<span class="lem-when late">Vencida há ' + Math.abs(dias) + (Math.abs(dias) === 1 ? " dia" : " dias") + "</span>"
        : dias === 0 ? '<span class="lem-when late">Vence hoje</span>'
        : '<span class="lem-when">' + (dias === 1 ? "Amanhã" : "Em " + dias + " dias") + "</span>";
      return '<div class="lembrete-row compact">' +
        '<div class="lem-main"><span class="t">' + u.escapeHtml(l.titulo) + "</span>" +
          '<span class="lem-sub">' + u.fmtDate(l.vencimento) + " · " + situ + "</span></div>" +
        '<span class="num lem-valor">' + valSpan(u.fmtBRL.format(l.valor)) + "</span></div>";
    }).join("");
    var chevron = '<svg class="lem-chevron' + (lembretesExpandido ? " open" : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    return (
      '<div class="card lembretes-card">' +
        '<div class="lem-head">' +
          '<p class="card-label" style="margin:0">' + ICONS.bell.replace("<svg ", '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" ') + "Contas a vencer</p>" +
          '<span class="num lem-total">' + valSpan(u.fmtBRL.format(total)) + "</span>" +
        "</div>" +
        '<div class="lem-chips">' + chips.join("") + "</div>" +
        '<div class="lem-list' + (lembretesExpandido ? " expandida" : "") + '">' + linhas + "</div>" +
        (resto > 0
          ? '<button class="lem-toggle" id="lembretesToggle" aria-expanded="' + lembretesExpandido + '">' +
              (lembretesExpandido ? "Mostrar menos" : "Ver todas (" + lembretes.length + ")") + chevron + "</button>"
          : "") +
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

  function renderGraficoContaCard() {
    var dados = data.gastosPorConta(mesSelecionado);
    return (
      '<div class="card">' +
        '<p class="card-label">Gastos por cartão e conta</p>' +
        charts.pieChart(dados, 132, true) +
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
        '<div class="meta-ring-row">' +
          charts.ringChart(m.pct, estourou ? "var(--red)" : "var(--teal)", 68) +
          '<div class="meta-ring-info">' +
            '<p class="big-number num ' + (estourou ? "saldo-neg" : "saldo-pos") + '" style="font-size:22px;margin:0">' +
              valSpan(estourou ? "Estourou em " + u.fmtBRL.format(Math.abs(m.restante)) : u.fmtBRL.format(m.restante) + " restantes") +
            "</p>" +
            '<p class="meta-restante" style="margin-top:4px">' + valSpan(u.fmtBRL.format(m.gasto)) + " de " + valSpan(u.fmtBRL.format(m.alvo)) + "</p>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderMetasCategoriaCard() {
    var status = data.metasCategoriaStatus(mesSelecionado);
    return (
      '<div class="card">' +
        '<div class="meta-row">' +
          '<p class="card-label" style="margin:0">Metas por categoria</p>' +
          '<button class="meta-edit-link" id="btnMetasCategoria">' + (status.length ? "gerenciar" : "definir") + "</button>" +
        "</div>" +
        (status.length === 0
          ? '<p style="font-size:13px;color:var(--ink-soft);margin:0">Ex: no máximo ' + u.fmtBRL.format(400) + " em Lazer neste mês."
          : status.map(function (m) {
              var estourou = m.restante < 0;
              return '<div class="cat-meta-bar-row">' +
                '<div class="cat-meta-bar-head"><span class="chart-legend-dot" style="background:' + m.cor + '"></span>' +
                  '<span class="cat-meta-nome">' + m.categoria + "</span>" +
                  '<span class="num cat-meta-pct' + (estourou ? " saldo-neg" : "") + '">' + valSpan(u.fmtBRL.format(m.gasto)) + " / " + valSpan(u.fmtBRL.format(m.alvo)) + "</span>" +
                "</div>" +
                '<div class="bar-track"><div class="bar-fill' + (estourou ? " high" : "") + '" style="width:' + Math.min(100, m.pct).toFixed(1) + '%;background:' + (estourou ? "var(--red)" : m.cor) + '"></div></div>' +
              "</div>";
            }).join("")
        ) +
      "</div>"
    );
  }

  function renderGraficoBarrasCard() {
    var dados = data.gastosPorCategoriaUltimosMeses(mesSelecionado, 6);
    return (
      '<div class="card">' +
        '<p class="card-label">Gastos por categoria — 6 meses</p>' +
        charts.barChartCategoria(dados) +
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

  // Detalhe do card "Saldo": por conta, o saldo disponível (Pix/Débito/Alimentação)
  // SEPARADO do crédito disponível; e a poupança (total + quanto cada conta guardou).
  // É a posição de hoje — não muda com o mês selecionado.
  function renderSaldoDetalhe() {
    function item(rot, v) {
      return '<span class="sc-item"><small>' + rot + '</small><b class="num' + (v < 0 ? " saldo-neg" : "") + '">' + valSpan(u.fmtBRL.format(v)) + "</b></span>";
    }
    var contas = App.state.cartoes;
    var html = '<div class="saldo-detalhe"><p class="saldo-sec">Contas · posição de hoje</p>';
    if (!contas.length) {
      html += '<p class="saldo-vazio">Cadastre suas contas na aba Contas para ver saldo e crédito disponíveis aqui.</p>';
    } else {
      html += contas.map(function (c) {
        var itens = [];
        if (data.tipoConta(c) === "alimentacao") itens.push(item("Saldo disponível", data.saldoConta(c)));
        else {
          if (data.contaTemSaldo(c)) itens.push(item("Saldo disponível", data.saldoConta(c)));
          if (data.contaTemCredito(c)) itens.push(item("Crédito disponível", data.limiteDisponivel(c)));
        }
        return '<div class="sc-row" style="box-shadow:inset 5px 0 0 ' + data.corCartao(c.id) + '">' +
          '<div class="sc-nome">' + u.escapeHtml(c.nome) + "</div>" +
          '<div class="sc-vals">' + itens.join("") + "</div></div>";
      }).join("");
    }
    if (App.state.poupancas.length) {
      var pc = data.poupadoPorConta(), linhas = "";
      pc.porConta.forEach(function (x) {
        linhas += '<div class="sc-linha"><span>' + u.escapeHtml(x.conta.nome) + '</span><b class="num">' + valSpan(u.fmtBRL.format(x.valor)) + "</b></div>";
      });
      if (Math.abs(pc.semConta) > 0.004) linhas += '<div class="sc-linha"><span>Rendimentos / sem conta</span><b class="num">' + valSpan(u.fmtBRL.format(pc.semConta)) + "</b></div>";
      html += '<div class="saldo-sec-row"><p class="saldo-sec" style="margin:0">Poupança</p>' +
        '<span class="sc-total">Total disponível <b class="num">' + valSpan(u.fmtBRL.format(data.saldoPoupancaTotal())) + "</b></span></div>" +
        (linhas ? '<p class="saldo-sub">Valor poupado em cada conta</p>' + linhas : '<p class="saldo-vazio">Nada guardado ainda.</p>');
    }
    return html + "</div>";
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
      '<div class="card card-hero">' +
        '<div class="hero-top">' +
          '<p class="card-label">Saldo</p>' +
          '<p class="big-number num ' + (s >= 0 ? "saldo-pos" : "saldo-neg") + '" id="saldoValue">' + valSpan(u.fmtBRL.format(s)) + "</p>" +
          '<p class="saldo-sub">Renda − despesas de ' + u.fmtMonth(mesSelecionado) + "</p>" +
        "</div>" +
        renderSaldoDetalhe() +
      "</div>" +
      renderComparativoCard() +
      renderMetaCard() +
      renderMetasCategoriaCard() +
      renderGraficoCategoriaCard() +
      renderGraficoContaCard() +
      renderGraficoEvolucaoCard() +
      renderGraficoBarrasCard()
    );
  }

  // ---- Ajustes ----
  function renderAjustes() {
    var notif = App.notifications;
    var notifAtivo = App.state.prefs.notificacoesPush && notif.permissaoConcedida();
    return (
      '<div class="card">' +
        '<div class="meta-row"><p class="card-label" style="margin:0">Perfil</p>' +
          '<button class="meta-edit-link" id="btnPerfis">gerenciar</button></div>' +
        '<p style="font-size:14px;font-weight:600">' + ICONS.user.replace("<svg ", '<svg style="width:15px;height:15px;vertical-align:-3px;margin-right:6px" ') + u.escapeHtml(data.perfilAtual()) + "</p>" +
      "</div>" +
      '<div class="card">' +
        '<p class="card-label">Renda fixa em ' + u.fmtMonth(mesSelecionado) + '</p>' +
        '<input id="salarioInput" type="number" inputmode="decimal" step="0.01" min="0" value="' + (data.salarioDoMes(mesSelecionado) || "") + '" placeholder="0,00">' +
        '<p style="font-size:12px;color:var(--ink-soft);margin:8px 0 0">Vale a partir de ' + u.fmtMonth(mesSelecionado) + '; meses anteriores não mudam.</p>' +
      "</div>" +
      renderReceitasExtrasCard() +
      '<div class="card">' +
        '<p class="card-label">Relatório mensal</p>' +
        '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Gera um resumo de ' + u.fmtMonth(mesSelecionado) + ' pronto para imprimir ou salvar como PDF.</p>' +
        '<div class="btn-row"><button class="btn btn-ghost" id="btnRelatorioPDF">' + ICONS.printer.replace("<svg ", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px" ') + "Gerar relatório de " + u.fmtMonth(mesSelecionado) + "</button></div>" +
      "</div>" +
      '<div class="card">' +
        '<p class="card-label">Notificações</p>' +
        '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Avisa quando uma conta estiver vencendo ou já vencida, enquanto o app estiver instalado. Funciona melhor com o app aberto ou em segundo plano recente — nem todo aparelho entrega notificação com o app totalmente fechado.</p>' +
        '<div class="btn-row"><button class="btn btn-ghost" id="btnToggleNotif">' +
          (notifAtivo ? ICONS.bellRing.replace("<svg ", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px" ') + "Desativar notificações" : ICONS.bell.replace("<svg ", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px" ') + "Ativar notificações") +
        "</button></div>" +
      "</div>" +
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

  // ---- Contas (renderização abaixo, em renderContasLista) ----

  // ---- Poupança (seção dentro da aba Contas) ----
  var ROT_MOV = { deposito: "Depósito", retirada: "Retirada", rendimento: "Rendimento" };
  // "Guardado por conta" dentro do card de cada poupança.
  function porContaPoupanca(p) {
    var partes = [];
    App.state.cartoes.forEach(function (c) {
      var v = data.poupadoNaConta(p.id, c.id);
      if (Math.abs(v) > 0.004) partes.push(u.escapeHtml(c.nome) + " " + u.fmtBRL.format(v));
    });
    var sem = data.poupadoSemConta(p.id);
    if (Math.abs(sem) > 0.004) partes.push("sem conta " + u.fmtBRL.format(sem));
    return partes.length ? '<p class="cartao-detalhe">' + valSpan("Guardado por conta: " + partes.join(" · ")) + "</p>" : "";
  }
  function renderPoupanca() {
    var ps = App.state.poupancas;
    var cab = '<div class="meta-row section-title" style="margin-top:22px"><span>Poupança' + (ps.length > 1 ? " · total " + valSpan(u.fmtBRL.format(data.saldoPoupancaTotal())) : "") +
      '</span><button class="meta-edit-link" id="btnNovaPoup">+ nova poupança</button></div>';
    if (!ps.length) return cab + '<div class="card"><p style="font-size:13px;color:var(--ink-soft);margin:0">Guarde dinheiro por objetivo (reserva, viagem…) e acompanhe depósitos, retiradas e rendimentos.</p></div>';
    return cab + ps.map(function (p) {
      var saldo = data.saldoPoupanca(p.id), pct = p.meta > 0 ? Math.min(100, saldo / p.meta * 100) : 0;
      var movs = App.state.movPoupanca.filter(function (m) { return m.poupancaId === p.id; })
        .sort(function (a, b) { return b.data.localeCompare(a.data); }).slice(0, 4);
      return '<div class="card cartao-item" style="box-shadow:inset 5px 0 0 ' + (p.cor || "#0C9A76") + '">' +
        '<div class="head"><h3>' + u.escapeHtml(p.nome) + "</h3><div>" +
          '<button class="icon-btn" data-edit-poup="' + p.id + '" aria-label="Editar">' + ICONS.edit + "</button>" +
          '<button class="icon-btn icon-btn-del" data-del-poup="' + p.id + '" aria-label="Excluir">' + ICONS.trash + "</button></div></div>" +
        '<p class="big-number num" style="font-size:24px;margin:0 0 6px">' + valSpan(u.fmtBRL.format(saldo)) + "</p>" +
 porContaPoupanca(p) +
        (p.meta > 0 ? '<p class="cartao-detalhe">' + valSpan("Meta " + u.fmtBRL.format(p.meta) + " · " + pct.toFixed(0) + "%") + '</p><div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + "%;background:" + (p.cor || "var(--teal)") + '"></div></div>' : "") +
        '<div class="btn-row" style="margin:12px 0 4px"><button class="btn btn-ghost" data-mov-poup="' + p.id + '" data-tipo="deposito">Depositar</button>' +
          '<button class="btn btn-ghost" data-mov-poup="' + p.id + '" data-tipo="retirada">Retirar</button>' +
          '<button class="btn btn-ghost" data-mov-poup="' + p.id + '" data-tipo="rendimento">Rendimento</button></div>' +
        movs.map(function (m) {
          var cm = data.contaPorId(m.contaId);
          var rotConta = cm ? (m.tipo === "deposito" ? " · de " : m.tipo === "retirada" ? " · para " : " · ") + u.escapeHtml(cm.nome) : "";
          return '<div class="lembrete-row"><span class="t">' + ROT_MOV[m.tipo] + " · " + u.fmtDate(m.data) + rotConta + (m.descricao ? " · " + u.escapeHtml(m.descricao) : "") + "</span>" +
            '<span class="num" style="font-size:13px">' + valSpan((m.tipo === "retirada" ? "−" : "+") + u.fmtBRL.format(m.valor)) + "</span>" +
            '<button class="icon-btn icon-btn-del" data-del-mov="' + m.id + '" aria-label="Excluir movimentação">' + ICONS.trash + "</button></div>";
        }).join("") + "</div>";
    }).join("");
  }

  function renderCartoes() {
    var lista = App.state.cartoes.length ? renderContasLista() : emptyState("cartoes");
    return lista + renderPoupanca();
  }

  function contaHead(c, tagsHtml) {
    return '<div class="head"><h3>' + u.escapeHtml(c.nome) + tagsHtml + "</h3><div>" +
      '<button class="icon-btn" data-edit-cartao="' + c.id + '" aria-label="Editar conta">' + ICONS.edit + "</button>" +
      '<button class="icon-btn icon-btn-del" data-del-cartao="' + c.id + '" aria-label="Excluir conta">' + ICONS.trash + "</button></div></div>";
  }

  // Conta Alimentação: saldo disponível (em vez de limite) e data de renovação.
  function renderContaAlimentacao(c, cor, mesHoje) {
    var saldo = data.saldoAlimentacao(c);
    var pct = c.valorRenovacao > 0 ? Math.max(0, Math.min(100, (saldo / c.valorRenovacao) * 100)) : 0;
    var baixo = saldo < 0 || pct < 20;
    var prox = data.proximaRenovacao(c);
    var regra = c.modoRenovacao === "somar" ? "acumula com a sobra" : "repõe o saldo";
    return (
      '<div class="card cartao-item" data-cartao="' + c.id + '" style="box-shadow:inset 5px 0 0 ' + cor + '">' +
        contaHead(c, ' <span class="cartao-venc-tag">Alimentação' + (c.diaRenovacao ? " · renova dia " + c.diaRenovacao : "") + "</span>") +
        '<p class="cartao-saldo-label">Saldo disponível</p>' +
        '<p class="big-number num ' + (saldo < 0 ? "saldo-neg" : "") + '" style="font-size:26px;margin:0 0 10px">' + valSpan(u.fmtBRL.format(saldo)) + "</p>" +
        '<div class="bar-track"><div class="bar-fill' + (baixo ? " high" : "") + '" style="width:' + pct.toFixed(1) + "%;background:" + (baixo ? "var(--red)" : cor) + '"></div></div>' +
        '<div class="cartao-stats" style="margin:10px 0 0">' +
          "<span>Gasto em " + u.fmtMonth(mesHoje) + '<b class="num">' + valSpan(u.fmtBRL.format(data.gastoMesConta(c.id, mesHoje))) + "</b></span>" +
          (prox ? "<span>Próxima renovação<b class=\"num\">" + u.fmtDate(prox) + "</b></span>" : "") +
        "</div>" +
        '<p class="cartao-dica">Renova ' + valSpan(u.fmtBRL.format(c.valorRenovacao || 0)) + " — " + regra + ".</p>" +
      "</div>"
    );
  }

  // Conta comum: mostra o bloco de cada recurso ativo (crédito com limite/uso;
  // Pix e débito como tags + gasto do mês).
  function renderContaComum(c, cor, mesHoje) {
    var temCredito = data.temRecurso(c, "credito");
    var tags = ' <span class="cartao-venc-tag">' + data.rotuloRecursos(c) + "</span>";
    var corpo = "";
    // Saldo disponível (dinheiro na conta, p/ Pix e Débito) — separado do limite do crédito.
    if (data.contaTemSaldo(c)) {
      var sd = data.saldoConta(c);
      corpo +=
        '<p class="cartao-saldo-label">Saldo disponível</p>' +
        '<p class="big-number num ' + (sd < 0 ? "saldo-neg" : "") + '" style="font-size:26px;margin:0 0 8px">' + valSpan(u.fmtBRL.format(sd)) + "</p>" +
        '<div class="btn-row" style="margin:0 0 ' + (temCredito ? "14px" : "4px") + '"><button class="btn btn-ghost" data-add-saldo="' + c.id + '">+ Adicionar saldo</button></div>';
    }
    if (temCredito) {
      if (data.contaTemSaldo(c)) corpo += '<p class="cartao-saldo-label" style="padding-top:12px;border-top:1px dashed var(--border)">Crédito</p>';
      if (c.diaFechamento) tags += ' <span class="cartao-venc-tag">fecha dia ' + c.diaFechamento + "</span>";
      if (c.diaVencimento) tags += ' <span class="cartao-venc-tag">vence dia ' + c.diaVencimento + "</span>";
      var det = data.usadoCartaoDetalhado(c.id);
      var usado = det.total, restante = c.limite - usado;
      var pct = c.limite > 0 ? Math.min(100, (usado / c.limite) * 100) : 0;
      var partes = [];
      if (det.recorrente > 0) partes.push(u.fmtBRL.format(det.recorrente) + " recorrentes em aberto");
      if (det.parcelado > 0) partes.push(u.fmtBRL.format(det.parcelado) + " em parcelas abertas");
      var melhorDia = data.melhorDiaCompra(c);
      corpo +=
        '<div class="cartao-stats">' +
          "<span>Limite<b class=\"num\">" + valSpan(u.fmtBRL.format(c.limite)) + "</b></span>" +
          "<span>Usado<b class=\"num\">" + valSpan(u.fmtBRL.format(usado)) + "</b></span>" +
          "<span>Limite disponível<b class=\"num\">" + valSpan(u.fmtBRL.format(restante)) + "</b></span>" +
        "</div>" +
        (partes.length ? '<p class="cartao-detalhe">' + valSpan(partes.join(" · ")) + "</p>" : "") +
        '<div class="bar-track"><div class="bar-fill' + (pct > 80 ? " high" : "") + '" style="width:' + pct.toFixed(1) + "%;background:" + (pct > 80 ? "var(--red)" : cor) + '"></div></div>' +
        (melhorDia
          ? '<p class="cartao-dica">Compre até ' + u.fmtDate(melhorDia.fechamento) + " pra cair na fatura de " + u.fmtMonth(melhorDia.vencAtual.slice(0, 7)) +
            "; depois disso, só na de " + u.fmtMonth(melhorDia.vencProximo.slice(0, 7)) + ".</p>"
          : "");
    }
    // Sem crédito, ou com mais de um recurso: mostra o total gasto no mês na conta.
    if (!temCredito || (c.recursos || []).length > 1) {
      corpo += '<div class="cartao-stats" style="' + (temCredito ? "margin:12px 0 0" : "") + '"><span>Gasto em ' + u.fmtMonth(mesHoje) + '<b class="num">' + valSpan(u.fmtBRL.format(data.gastoMesConta(c.id, mesHoje))) + "</b></span></div>";
    }
    return '<div class="card cartao-item" data-cartao="' + c.id + '" style="box-shadow:inset 5px 0 0 ' + cor + '">' + contaHead(c, tags) + corpo + "</div>";
  }

  function renderContasLista() {
    var mesHoje = u.todayISO().slice(0, 7);
    return App.state.cartoes.map(function (c) {
      var cor = data.corCartao(c.id);
      return data.tipoConta(c) === "alimentacao" ? renderContaAlimentacao(c, cor, mesHoje) : renderContaComum(c, cor, mesHoje);
    }).join("");
  }

  // ---- Lançamentos (com filtros) ----
  function lancamentosFiltrados() {
    var texto = filtros.texto.trim().toLowerCase();
    return App.state.lancamentos.filter(function (l) {
      if (!filtros.todos && l.vencimento.slice(0, 7) !== mesSelecionado) return false;
      if (filtros.status === "pago" && l.status !== "pago") return false;
      if (filtros.status === "aberto" && l.status !== "aberto") return false;
      if (filtros.status === "vencido" && !(l.status === "aberto" && u.diasAte(l.vencimento) < 0)) return false;
      if (filtros.meio && l.meioPagamento !== filtros.meio) return false;
      if (filtros.categoria && l.categoria !== filtros.categoria) return false;
      if (filtros.cartaoId && l.cartaoId !== filtros.cartaoId) return false;
      if (texto && l.titulo.toLowerCase().indexOf(texto) === -1) return false;
      return true;
    });
  }

  // Entradas (saldo adicionado) respeitam mês, texto e conta. Não têm categoria,
  // meio de pagamento nem "em aberto": somem se esses filtros estiverem ativos.
  function entradasFiltradas() {
    if (filtros.categoria || filtros.meio || filtros.status === "aberto" || filtros.status === "vencido") return [];
    var texto = filtros.texto.trim().toLowerCase();
    return App.state.entradas.filter(function (e) {
      if (!filtros.todos && e.data.slice(0, 7) !== mesSelecionado) return false;
      if (filtros.cartaoId && e.contaId !== filtros.cartaoId) return false;
      if (texto && (e.descricao || "saldo adicionado").toLowerCase().indexOf(texto) === -1) return false;
      return true;
    });
  }
  function renderAddSaldoBar() {
    return '<button class="btn btn-ghost btn-addsaldo" id="btnAddSaldo">+ Adicionar saldo a uma conta</button>';
  }

  function renderFilterBar() {
    var cats = data.categoriasTodas();
    var catOptions = '<option value="">Todas categorias</option>' + cats.map(function (c) {
      return '<option value="' + c + '"' + (filtros.categoria === c ? " selected" : "") + '>' + c + "</option>";
    }).join("");
    var cartaoOptions = '<option value="">Todas contas</option>' + App.state.cartoes.map(function (c) {
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
        '<div class="filter-selects" style="margin-top:8px">' +
          '<select id="filtroStatus">' + [["", "Qualquer status"], ["aberto", "Em aberto"], ["vencido", "Vencidos"], ["pago", "Pagos"]].map(function (o) {
            return '<option value="' + o[0] + '"' + (filtros.status === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
          }).join("") + "</select>" +
          '<select id="filtroMeio"><option value="">Qualquer pagamento</option>' + data.MEIOS.map(function (m) {
            return '<option value="' + m + '"' + (filtros.meio === m ? " selected" : "") + ">" + m + "</option>";
          }).join("") + "</select>" +
        "</div>" +
        '<div class="chip-row">' +
          '<button class="btn-bulk' + (!filtros.todos ? " active-chip" : "") + '" data-lanc-periodo="mes">Só ' + u.fmtMonth(mesSelecionado) + "</button>" +
          '<button class="btn-bulk' + (filtros.todos ? " active-chip" : "") + '" data-lanc-periodo="todos">Todos os meses</button>' +
        "</div>" +
      "</div>"
    );
  }

  // Resumo do que está listado: total, já pago, em aberto e vencido.
  function renderLancResumo(lista, ents) {
    var tot = 0, pago = 0, aberto = 0, venc = 0, benef = 0;
    var entTot = (ents || []).reduce(function (s, e) { return s + e.valor; }, 0);
    lista.forEach(function (l) {
      if (data.ehBeneficio(l.cartaoId)) { benef += l.valor; return; }
      tot += l.valor;
      if (l.status === "pago") pago += l.valor;
      else { aberto += l.valor; if (u.diasAte(l.vencimento) < 0) venc += l.valor; }
    });
    var pct = tot > 0 ? (pago / tot) * 100 : 0;
    return '<div class="card ext-sum" style="flex-wrap:wrap">' +
      '<span>Total<b class="num">' + valSpan(u.fmtBRL.format(tot)) + "</b></span>" +
      '<span>Pago<b class="num saldo-pos">' + valSpan(u.fmtBRL.format(pago)) + "</b></span>" +
      '<span>Em aberto<b class="num">' + valSpan(u.fmtBRL.format(aberto)) + "</b></span>" +
      (entTot > 0 ? '<span>Entradas<b class="num saldo-pos">' + valSpan(u.fmtBRL.format(entTot)) + "</b></span>" : "") +
      '<div style="flex-basis:100%"><div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
      '<p class="cartao-detalhe" style="margin:6px 0 0">' + lista.length + (lista.length === 1 ? " lançamento" : " lançamentos") +
        (venc > 0 ? ' · <span class="saldo-neg">' + valSpan(u.fmtBRL.format(venc)) + " vencido</span>" : "") +
        (benef > 0 ? " · " + valSpan(u.fmtBRL.format(benef)) + " em benefício (fora do total)" : "") + "</p></div></div>";
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
    var filtrando = !!(filtros.texto || filtros.categoria || filtros.cartaoId || filtros.status || filtros.meio);
    var addBar = renderAddSaldoBar();
    if (App.state.lancamentos.length === 0 && App.state.entradas.length === 0) return addBar + emptyState("lancamentos");
    var lista = lancamentosFiltrados(), ents = entradasFiltradas();
    var barra = addBar + renderFilterBar();
    if (lista.length === 0 && ents.length === 0) return barra + emptyState("filtro") + (filtrando ? '<p class="filter-empty-note" style="text-align:center"><span class="filter-clear" id="limparFiltros">limpar filtros</span></p>' : "") + (!filtros.todos && !filtrando ? '<p class="filter-empty-note" style="text-align:center">Nenhum lançamento em ' + u.fmtMonth(mesSelecionado) + '. Use as setas para trocar de mês ou toque no + para adicionar.</p>' : "");
    // Saídas e entradas na mesma linha do tempo, por data.
    var itens = lista.map(function (l) { return { k: "l", data: l.vencimento, l: l }; })
      .concat(ents.map(function (e) { return { k: "e", data: e.data, e: e }; }))
      .sort(function (a, b) { return b.data.localeCompare(a.data); });
    var nota = filtrando ? '<p class="filter-empty-note">' + itens.length + " resultado" + (itens.length === 1 ? "" : "s") +
      ' · <span class="filter-clear" id="limparFiltros">limpar filtros</span></p>' : "";
    var lastDia = null;
    var partes = [];
    itens.forEach(function (it) {
      if (it.data !== lastDia) {
        lastDia = it.data;
        partes.push('<div class="dia-header">' + u.capitalize(u.fmtDiaRelativo(it.data)) + "</div>");
      }
      if (it.k === "e") {
        var e = it.e, ce = data.contaPorId(e.contaId);
        partes.push(
          '<div class="lanc-item entrada-item" data-entrada="' + e.id + '">' +
            '<span class="lanc-dot entrada" title="entrada"></span>' +
            '<div class="lanc-info"><div class="t">' + u.escapeHtml(e.descricao || "Saldo adicionado") + "</div>" +
              '<div class="m">' + u.fmtDate(e.data) + " · Entrada · " + (ce ? u.escapeHtml(ce.nome) : "conta excluída") + (e.data > u.todayISO() ? " · a receber" : "") + "</div></div>" +
            '<div class="lanc-valor num saldo-pos">+' + valSpan(u.fmtBRL.format(e.valor)) + "</div>" +
            (selecionando ? "" : '<span class="entrada-actions">' +
              '<button class="icon-btn" data-edit-entrada="' + e.id + '" aria-label="Editar entrada">' + ICONS.edit + "</button>" +
              '<button class="icon-btn icon-btn-del" data-del-entrada="' + e.id + '" aria-label="Excluir entrada">' + ICONS.trash + "</button></span>") +
          "</div>");
        return;
      }
      var l = it.l;
      var cartaoNome = "";
      if (l.cartaoId) {
        var c = App.state.cartoes.filter(function (x) { return x.id === l.cartaoId; })[0];
        if (c) cartaoNome = " · " + c.nome;
      }
      // Alimentação: desconta na hora, com "data da transação" — sem vencimento nem status em aberto.
      var imediata = data.ehTransacaoImediata(l);
      var dias = u.diasAte(l.vencimento);
      var vencida = !imediata && l.status === "aberto" && dias < 0;
      var emBreve = !imediata && l.status === "aberto" && dias >= 0 && dias <= 3;
      var rowClass = vencida ? " vencida" : (emBreve ? " em-breve" : "");
      var dotClass = l.status === "aberto" ? (vencida ? " vencida" : " aberto") : "";
      var tag = "";
      if (l.totalParcelas > 1) tag = ' · <span class="parcela-tag">' + l.parcelaAtual + "/" + l.totalParcelas + "</span>";
      else if (l.recorrente) tag = " · " + ICONS.repeat.replace("<svg ", '<svg style="width:11px;height:11px;vertical-align:-1px" ');
      var comprovanteTag = l.comprovante
        ? '<button class="icon-btn comprovante-tag" data-ver-comprovante="' + l.id + '" aria-label="Ver comprovante">' + ICONS.paperclip + "</button>"
        : "";
      var checked = selecionados.indexOf(l.id) !== -1;
      var indicador = selecionando
        ? '<span class="lanc-check' + (checked ? " checked" : "") + '">' + (checked ? ICONS.check : "") + "</span>"
        : '<span class="lanc-dot' + dotClass + '" title="' + (imediata ? "descontado" : l.status) + '"></span>';
      var acoesFixas = selecionando
        ? ""
        : '<span class="lanc-actions-fixed">' + comprovanteTag +
          '<button class="icon-btn" data-edit-lanc="' + l.id + '" aria-label="Editar">' + ICONS.edit + "</button>" +
          '<button class="icon-btn icon-btn-del" data-del-lanc="' + l.id + '" aria-label="Excluir">' + ICONS.trash + "</button></span>";
      var itemHtml =
        '<div class="lanc-item' + rowClass + (checked ? " selected" : "") + '" data-lanc="' + l.id + '">' +
          indicador +
          '<div class="lanc-info">' +
            '<div class="t">' + u.escapeHtml(l.titulo) + "</div>" +
            '<div class="m">' + (imediata ? "Transação " : "") + u.fmtDate(l.vencimento) + " · " + l.categoria + cartaoNome + tag + "</div>" +
          "</div>" +
          '<div class="lanc-valor num">' + valSpan(u.fmtBRL.format(l.valor)) + "</div>" +
          acoesFixas +
        "</div>";
      if (selecionando) {
        partes.push(itemHtml);
      } else {
        // Swipe: painel de ações fica atrás, revelado ao arrastar o item pra
        // esquerda (gesto comum em apps de finanças no celular).
        partes.push(
          '<div class="lanc-swipe' + (imediata ? " no-pay" : "") + '" data-lanc-swipe="' + l.id + '">' +
            '<div class="lanc-swipe-pay">' +
              (imediata ? "" : l.status === "aberto"
                ? '<button class="swipe-action pay" data-pay-lanc="' + l.id + '" aria-label="Pagar">' + ICONS.check + "<span>Pagar</span></button>"
                : '<button class="swipe-action reopen" data-pay-lanc="' + l.id + '" aria-label="Reabrir">' + ICONS.repeat + "<span>Reabrir</span></button>") +
            "</div>" +
            '<div class="lanc-swipe-actions">' +
              '<button class="swipe-action edit" data-edit-lanc="' + l.id + '" aria-label="Editar">' + ICONS.edit + "<span>Editar</span></button>" +
              '<button class="swipe-action delete" data-del-lanc="' + l.id + '" aria-label="Excluir">' + ICONS.trash + "<span>Excluir</span></button>" +
            "</div>" +
            itemHtml +
          "</div>"
        );
      }
    });
    var linhas = partes.join("");
    return barra + renderLancResumo(lista, ents) + nota + linhas + (selecionando ? renderBulkBar() : "");
  }

  // ---- Extrato ----
  function renderExtrato() {
    var itens = data.extratoDoMes(mesSelecionado, extFiltro.status === "realizadas", extFiltro.conta);
    var ent = 0, sai = 0, guard = 0;
    itens.forEach(function (i) {
      if (i.kind === "renda" || i.kind === "entrada") ent += i.valor;
      else if (i.kind === "lanc") { if (!i.beneficio) sai += -i.valor; }
      else guard += -i.valor;
    });
    var contaOpts = '<option value="">Todas as contas</option>' + App.state.cartoes.map(function (c) {
      return '<option value="' + c.id + '"' + (extFiltro.conta === c.id ? " selected" : "") + ">" + u.escapeHtml(c.nome) + "</option>";
    }).join("");
    var chip = function (id, txt) { return '<button class="btn-bulk' + (extFiltro.status === id ? " active-chip" : "") + '" data-ext-status="' + id + '">' + txt + "</button>"; };
    var html =
      '<div class="filter-bar"><div class="filter-selects"><select id="extConta">' + contaOpts + "</select></div>" +
        '<div class="chip-row">' + chip("realizadas", "Realizadas") + chip("todas", "Todas (inclui em aberto)") + "</div></div>" +
      '<div class="card ext-sum"><span>Entradas<b class="num saldo-pos">' + valSpan(u.fmtBRL.format(ent)) + "</b></span>" +
        '<span>Saídas<b class="num saldo-neg">' + valSpan(u.fmtBRL.format(sai)) + "</b></span>" +
        '<span>Poupança<b class="num">' + valSpan(u.fmtBRL.format(guard)) + "</b></span></div>";
    if (!itens.length) return html + emptyState("filtro");
    var ultimo = null;
    itens.forEach(function (i, idx) {
      if (i.data !== ultimo) { ultimo = i.data; html += '<div class="dia-header">' + u.capitalize(u.fmtDiaRelativo(i.data)) + "</div>"; }
      var sub = i.l ? i.l.categoria + (i.l.status === "aberto" ? " · em aberto" : "") + (i.beneficio ? " · benefício" : "") : (i.kind === "renda" ? "Receita" : i.kind === "entrada" ? "Saldo adicionado" + (i.contaNome ? " · " + i.contaNome : "") : "Poupança");
      var cls = i.kind === "poup" ? "" : (i.valor >= 0 ? " saldo-pos" : "");
      html += '<div class="lanc-item" data-ext-item="' + idx + '"><div class="lanc-info"><div class="t">' + u.escapeHtml(i.titulo) + '</div><div class="m">' + sub + "</div></div>" +
        '<div class="lanc-valor num' + cls + '">' + valSpan((i.valor < 0 ? "−" : "+") + u.fmtBRL.format(Math.abs(i.valor))) + "</div></div>";
    });
    renderExtrato.itens = itens;
    return html;
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
    var monthNav =
      '<div class="month-nav">' +
        '<button id="prevMonth" aria-label="Mês anterior">' + ICONS.prev + "</button>" +
        '<button id="nextMonth" aria-label="Mês seguinte">' + ICONS.next + "</button>" +
      "</div>";
    if (tab === "lancamentos") {
      extra = (filtros.todos ? "" : monthNav) +
        '<button id="exportBtn" aria-label="Exportar CSV">' + ICONS.download + "</button>" +
        '<button id="selectModeBtn" aria-label="Selecionar lançamentos" class="' + (selecionando ? "active" : "") + '">' + ICONS.selectMode + "</button>";
    } else if (tab === "resumo" || tab === "extrato") {
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
    if (document.getElementById("prevMonth")) document.getElementById("prevMonth").addEventListener("click", function () { mesSelecionado = u.shiftMonth(mesSelecionado, -1); selecionados = []; render(); });
    if (document.getElementById("nextMonth")) document.getElementById("nextMonth").addEventListener("click", function () { mesSelecionado = u.shiftMonth(mesSelecionado, 1); selecionados = []; render(); });
    document.getElementById("eyeToggle").addEventListener("click", function () { sec.toggleOfuscar(); render(); });
  }

  function render() {
    data.aplicarRenovacoes(); // renovações de contas Alimentação cuja data já chegou
    document.getElementById("pageTitle").textContent = TABS.filter(function (t) { return t.id === tab; })[0].label;
    document.querySelector("header.topbar").setAttribute("data-tab", tab);
    document.getElementById("monthLabel").textContent = ((tab === "lancamentos" && !filtros.todos) || tab === "resumo" || tab === "extrato") ? u.capitalize(u.fmtMonth(mesSelecionado)) : "";
    document.getElementById("fab").style.display = (tab === "cartoes" || tab === "lancamentos") ? "flex" : "none";
    renderTabbar();
    renderTopActions();
    var main = document.getElementById("main");
    main.classList.remove("tab-enter");
    if (tab === "resumo") main.innerHTML = renderResumo();
    else if (tab === "cartoes") main.innerHTML = renderCartoes();
    else if (tab === "lancamentos") main.innerHTML = renderLancamentos();
    else if (tab === "extrato") main.innerHTML = renderExtrato();
    else main.innerHTML = renderAjustes();
    void main.offsetWidth;
    main.classList.add("tab-enter");
    bindMainEvents();
  }

  function bindMainEvents() {
    var q = function (sel, fn) { document.querySelectorAll(sel).forEach(fn); };
    var extConta = document.getElementById("extConta");
    if (extConta) extConta.addEventListener("change", function () { extFiltro.conta = extConta.value; render(); });
    q("[data-ext-status]", function (b) { b.addEventListener("click", function () { extFiltro.status = b.getAttribute("data-ext-status"); render(); }); });
    q("[data-ext-item]", function (row) {
      row.addEventListener("click", function () { App.sheets.openExtratoDetalheSheet(renderExtrato.itens[+row.getAttribute("data-ext-item")]); });
    });
    var btnAddSaldo = document.getElementById("btnAddSaldo");
    if (btnAddSaldo) btnAddSaldo.addEventListener("click", function () { App.sheets.openEntradaSheet(); });
    q("[data-add-saldo]", function (b) { b.addEventListener("click", function () { App.sheets.openEntradaSheet(null, b.getAttribute("data-add-saldo")); }); });
    q("[data-edit-entrada]", function (b) { b.addEventListener("click", function (e) {
      e.stopPropagation();
      var ent = App.state.entradas.filter(function (x) { return x.id === b.getAttribute("data-edit-entrada"); })[0];
      if (ent) App.sheets.openEntradaSheet(ent);
    }); });
    q("[data-del-entrada]", function (b) { b.addEventListener("click", function (e) {
      e.stopPropagation();
      var idx = App.state.entradas.findIndex(function (x) { return x.id === b.getAttribute("data-del-entrada"); });
      if (idx === -1) return;
      var ent = App.state.entradas[idx], conta = data.contaPorId(ent.contaId);
      if (conta && ent.data <= u.todayISO()) {
        var atual = data.saldoConta(conta), depois = data.arred(atual - ent.valor);
        if (depois < -0.004 && depois < atual && !window.confirm("Excluir esta entrada deixa o saldo de " + conta.nome + " negativo (" + u.fmtBRL.format(depois) + "). Excluir mesmo assim?")) return;
      }
      excluirComUndo(App.state.entradas, idx, ent, "Entrada excluída");
    }); });
    var btnNovaPoup = document.getElementById("btnNovaPoup");
    if (btnNovaPoup) btnNovaPoup.addEventListener("click", function () { App.sheets.openPoupancaSheet(); });
    q("[data-edit-poup]", function (b) { b.addEventListener("click", function () {
      App.sheets.openPoupancaSheet(App.state.poupancas.filter(function (p) { return p.id === b.getAttribute("data-edit-poup"); })[0]);
    }); });
    q("[data-mov-poup]", function (b) { b.addEventListener("click", function () {
      App.sheets.openMovPoupancaSheet(b.getAttribute("data-mov-poup"), b.getAttribute("data-tipo"));
    }); });
    q("[data-del-poup]", function (b) { b.addEventListener("click", function () {
      var idx = App.state.poupancas.findIndex(function (p) { return p.id === b.getAttribute("data-del-poup"); });
      if (idx === -1 || !window.confirm('Excluir a poupança "' + App.state.poupancas[idx].nome + '" e todo o seu histórico? O que cada conta guardou volta para o saldo dela.')) return;
      var p = App.state.poupancas[idx], movs = App.state.movPoupanca.filter(function (m) { return m.poupancaId === p.id; });
      App.state.movPoupanca = App.state.movPoupanca.filter(function (m) { return m.poupancaId !== p.id; });
      excluirComUndo(App.state.poupancas, idx, p, "Poupança excluída", function () { App.state.movPoupanca = App.state.movPoupanca.concat(movs); });
    }); });
    q("[data-del-mov]", function (b) { b.addEventListener("click", function () {
      var idx = App.state.movPoupanca.findIndex(function (m) { return m.id === b.getAttribute("data-del-mov"); });
      if (idx === -1) return;
      var erroMov = data.validarRemocaoMov(App.state.movPoupanca[idx]);
      if (erroMov) { toast(erroMov); return; }
      excluirComUndo(App.state.movPoupanca, idx, App.state.movPoupanca[idx], "Movimentação excluída");
    }); });
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
    var filtroStatus = document.getElementById("filtroStatus");
    if (filtroStatus) filtroStatus.addEventListener("change", function () { filtros.status = filtroStatus.value; render(); });
    var filtroMeio = document.getElementById("filtroMeio");
    if (filtroMeio) filtroMeio.addEventListener("change", function () { filtros.meio = filtroMeio.value; render(); });
    q("[data-lanc-periodo]", function (b) { b.addEventListener("click", function () { filtros.todos = b.getAttribute("data-lanc-periodo") === "todos"; selecionados = []; render(); }); });
    var limparFiltros = document.getElementById("limparFiltros");
    if (limparFiltros) limparFiltros.addEventListener("click", function () { filtros = { texto: "", categoria: "", cartaoId: "", status: "", meio: "", todos: filtros.todos }; render(); });

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
    var btnMetasCategoria = document.getElementById("btnMetasCategoria");
    if (btnMetasCategoria) btnMetasCategoria.addEventListener("click", function () { App.sheets.openMetaCategoriaSheet(mesSelecionado); });
    var btnPerfis = document.getElementById("btnPerfis");
    if (btnPerfis) btnPerfis.addEventListener("click", function () { App.sheets.openPerfilSheet(); });
    var btnRelatorioPDF = document.getElementById("btnRelatorioPDF");
    if (btnRelatorioPDF) btnRelatorioPDF.addEventListener("click", function () { App.backup.gerarRelatorioMensal(mesSelecionado); });
    var btnToggleNotif = document.getElementById("btnToggleNotif");
    if (btnToggleNotif) btnToggleNotif.addEventListener("click", async function () {
      var jaAtivo = App.state.prefs.notificacoesPush && App.notifications.permissaoConcedida();
      if (jaAtivo) {
        App.notifications.desativarNotificacoes();
        toast("Notificações desativadas");
        render();
        return;
      }
      var ok = await App.notifications.ativarNotificacoes();
      if (ok) toastSuccess("Notificações ativadas");
      else toast("Permissão de notificação não concedida");
      render();
    });
    var btnComprovanteVer = document.querySelectorAll("[data-ver-comprovante]");
    btnComprovanteVer.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-ver-comprovante");
        var l = App.state.lancamentos.filter(function (x) { return x.id === id; })[0];
        if (l && l.comprovante) App.sheets.openComprovanteViewSheet(l.comprovante, l.titulo);
      });
    });

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

    document.querySelectorAll("[data-edit-cartao]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-edit-cartao");
        var c = App.state.cartoes.filter(function (x) { return x.id === id; })[0];
        if (!c) return;
        App.sheets.openCartaoSheet(c);
      });
    });

    document.querySelectorAll("[data-del-cartao]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-del-cartao");
        var idx = App.state.cartoes.findIndex(function (x) { return x.id === id; });
        if (idx === -1) return;
        var c = App.state.cartoes[idx];
        if (!window.confirm('Excluir a conta "' + c.nome + '"? Os lançamentos vinculados a ela não serão apagados.')) return;
        excluirComUndo(App.state.cartoes, idx, c, "Conta excluída");
      });
    });

    document.querySelectorAll("[data-del-lanc]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-del-lanc");
        var idx = App.state.lancamentos.findIndex(function (x) { return x.id === id; });
        if (idx === -1) return;
        var l = App.state.lancamentos[idx];
        var proximos = l.grupoId ? App.state.lancamentos.filter(function (x) { return x.grupoId === l.grupoId && x.vencimento > l.vencimento; }) : [];
        if (proximos.length) {
          App.sheets.openExcluirGrupoSheet(l, proximos.length, function (todos) {
            var rem = todos ? [l].concat(proximos) : [l];
            App.state.lancamentos = App.state.lancamentos.filter(function (x) { return rem.indexOf(x) === -1; });
            data.saveState(); render();
            toastUndo(rem.length + (rem.length === 1 ? " lançamento excluído" : " lançamentos excluídos"), function () {
              App.state.lancamentos = App.state.lancamentos.concat(rem); data.saveState(); render();
            });
          });
          return;
        }
        var msg = l.totalParcelas > 1
          ? 'Excluir só esta parcela (' + l.parcelaAtual + "/" + l.totalParcelas + ')? As outras parcelas continuam.'
          : 'Excluir "' + l.titulo + '"?';
        if (!window.confirm(msg)) return;
        excluirComUndo(App.state.lancamentos, idx, l, "Lançamento excluído");
      });
    });

    document.querySelectorAll("[data-lanc]").forEach(function (row) {
      row.addEventListener("click", function () {
        if (swipeSuppressClick) { swipeSuppressClick = false; return; }
        var id = row.getAttribute("data-lanc");
        if (selecionando) {
          var idx = selecionados.indexOf(id);
          if (idx === -1) selecionados.push(id); else selecionados.splice(idx, 1);
          render();
          return;
        }
        var l = App.state.lancamentos.filter(function (x) { return x.id === id; })[0];
        if (!l) return;
        if (data.ehTransacaoImediata(l)) { toast("Transação de Alimentação: já descontada do saldo"); return; }
        var vaiPagar = l.status === "aberto";
        l.status = vaiPagar ? "pago" : "aberto";
        data.saveState();
        u.vibrar(vaiPagar ? [12, 40, 12] : 12);
        if (vaiPagar) {
          row.classList.add("just-paid");
          toastSuccess("Marcado como pago");
        } else {
          toast("Marcado como em aberto");
        }
        setTimeout(render, vaiPagar ? 260 : 0);
      });
    });
    bindSwipeLancamentos();

    var lemToggle = document.getElementById("lembretesToggle");
    if (lemToggle) lemToggle.addEventListener("click", function () { lembretesExpandido = !lembretesExpandido; render(); });

    // Pagar (arrastar o lançamento pra direita): marca como pago e atualiza
    // limite do cartão, totais pagos/em aberto e "Contas a vencer".
    document.querySelectorAll("[data-pay-lanc]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var l = App.state.lancamentos.filter(function (x) { return x.id === btn.getAttribute("data-pay-lanc"); })[0];
        if (!l || data.ehTransacaoImediata(l)) return;
        var vaiPagar = l.status === "aberto";
        l.status = vaiPagar ? "pago" : "aberto";
        data.saveState();
        u.vibrar(vaiPagar ? [12, 40, 12] : 12);
        if (vaiPagar) {
          var msg = "Marcado como pago";
          var conta = l.cartaoId ? App.state.cartoes.filter(function (x) { return x.id === l.cartaoId; })[0] : null;
          if (conta && l.meioPagamento === "Cartão de crédito" && data.temRecurso(conta, "credito")) {
            msg += " · Restante em " + conta.nome + ": " + u.fmtBRL.format(conta.limite - data.usadoCartao(conta.id));
          }
          var rowEl = btn.closest(".lanc-swipe");
          if (rowEl) { var it = rowEl.querySelector(".lanc-item"); if (it) it.classList.add("just-paid"); }
          toastSuccess(msg);
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
      App.state.lancamentos.forEach(function (l) { if (selecionados.indexOf(l.id) !== -1 && !data.ehTransacaoImediata(l)) l.status = "aberto"; });
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

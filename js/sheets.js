// ==== SHEETS (modais em bottom-sheet) =======================================
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils, ICONS = App.ICONS, data = App.data;

  function closeSheet() { document.getElementById("modalRoot").innerHTML = ""; }

  function setFieldError(inputId, msgId, message) {
    var input = document.getElementById(inputId), msg = document.getElementById(msgId);
    if (input) input.classList.add("field-error");
    if (msg) { msg.textContent = message; msg.classList.add("show"); }
  }
  function clearFieldError(inputId, msgId) {
    var input = document.getElementById(inputId), msg = document.getElementById(msgId);
    if (input) input.classList.remove("field-error");
    if (msg) { msg.textContent = ""; msg.classList.remove("show"); }
  }
  function clearAllErrors(ids) { ids.forEach(function (pair) { clearFieldError(pair[0], pair[1]); }); }

  function bindBackdropClose(root) {
    document.getElementById("closeSheet").addEventListener("click", closeSheet);
    document.getElementById("backdrop").addEventListener("click", function (e) { if (e.target.id === "backdrop") closeSheet(); });
  }

  // ---- Conta ----
  // Sem `existing`: cria conta nova. Com `existing`: edita a conta já cadastrada.
  // Dois tipos: "conta" (Pix / Crédito / Débito combináveis) e "alimentacao"
  // (saldo disponível com renovação em data fixa, em vez de limite/vencimento).
  function openCartaoSheet(existing) {
    var editMode = !!existing;
    var root = document.getElementById("modalRoot");
    var tipoInicial = editMode ? data.tipoConta(existing) : "conta";
    var recAtuais = (editMode && tipoInicial === "conta") ? existing.recursos : ["credito"];
    var corAtual = (editMode && existing.cor) ? existing.cor : data.corCartao(editMode ? existing.id : "__novo__");
    var al = (editMode && tipoInicial === "alimentacao") ? existing : {};
    var saldoAtual = editMode && tipoInicial === "alimentacao" ? data.saldoAlimentacao(existing).toFixed(2) : "";

    var recursoChips = Object.keys(data.RECURSOS).map(function (k) {
      return '<label class="recurso-chip"><input type="checkbox" data-recurso="' + k + '"' + (recAtuais.indexOf(k) !== -1 ? " checked" : "") + '><span>' + data.RECURSOS[k] + "</span></label>";
    }).join("");

    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>' + (editMode ? "Editar conta" : "Nova conta") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Tipo<select id="fTipoConta"' + (editMode ? " disabled" : "") + ">" +
            Object.keys(data.TIPOS_CONTA).map(function (k) { return '<option value="' + k + '"' + (tipoInicial === k ? " selected" : "") + ">" + data.TIPOS_CONTA[k] + "</option>"; }).join("") + "</select></label>" +
          '<label class="field">Nome<input id="fNome" type="text" placeholder="Ex: Nubank" value="' + (editMode ? u.escapeHtml(existing.nome) : "") + '">' +
            '<span class="field-error-msg" id="errNome"></span></label>' +

          // --- Conta comum: recursos ---
          '<div id="boxConta">' +
            '<div class="field" style="margin-bottom:14px">O que esta conta faz?' +
              '<div class="recurso-row" id="fRecursos">' + recursoChips + "</div>" +
              '<span class="field-error-msg" id="errRecursos"></span></div>' +
            '<div id="boxCredito" class="tipo-fields">' +
              '<div class="row2">' +
                '<label class="field">Limite do crédito<input id="fLimite" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="' + (editMode && existing.limite ? existing.limite : "") + '">' +
                  '<span class="field-error-msg" id="errLimite"></span></label>' +
                '<label class="field">Dia de fechamento (opcional)<input id="fDiaFech" type="number" inputmode="numeric" min="1" max="31" placeholder="Ex: 3" value="' + (editMode && existing.diaFechamento ? existing.diaFechamento : "") + '">' +
                  '<span class="field-error-msg" id="errDiaFech"></span></label>' +
              "</div>" +
              '<label class="field">Dia de vencimento (opcional)<input id="fDiaVenc" type="number" inputmode="numeric" min="1" max="31" placeholder="Ex: 10" value="' + (editMode && existing.diaVencimento ? existing.diaVencimento : "") + '">' +
                '<span class="field-error-msg" id="errDiaVenc"></span></label>' +
              '<label class="field" style="flex-direction:row;align-items:center;gap:8px;margin-bottom:6px"><input id="fBeneficio" type="checkbox"' + (editMode && existing.beneficio ? " checked" : "") + ' style="width:auto"> Cartão de benefício (não desconta da renda)</label>' +
              '<p style="font-size:12.5px;color:var(--ink-soft);margin:0">Com fechamento e vencimento definidos, o app calcula sozinho em qual fatura cada compra cai — como no cartão de verdade.</p>' +
            "</div>" +
          "</div>" +

          // --- Alimentação ---
          '<div id="boxAlim" class="tipo-fields" style="display:none">' +
            '<label class="field">Saldo disponível<input id="fSaldo" type="number" inputmode="decimal" step="0.01" placeholder="0,00" value="' + saldoAtual + '">' +
              '<span class="field-error-msg" id="errSaldo"></span></label>' +
            '<div class="row2">' +
              '<label class="field">Valor da renovação<input id="fValorRen" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="' + (al.valorRenovacao || "") + '">' +
                '<span class="field-error-msg" id="errValorRen"></span></label>' +
              '<label class="field">Dia da renovação<input id="fDiaRen" type="number" inputmode="numeric" min="1" max="31" placeholder="Ex: 5" value="' + (al.diaRenovacao || "") + '">' +
                '<span class="field-error-msg" id="errDiaRen"></span></label>' +
            "</div>" +
            '<label class="field" style="margin-bottom:6px">Na renovação<select id="fModoRen">' +
              '<option value="repor"' + (al.modoRenovacao !== "somar" ? " selected" : "") + '>Repor saldo (a sobra não acumula)</option>' +
              '<option value="somar"' + (al.modoRenovacao === "somar" ? " selected" : "") + '>Acumular (soma à sobra)</option>' +
            "</select></label>" +
            '<p style="font-size:12.5px;color:var(--ink-soft);margin:0">Repor: o saldo volta ao valor da renovação. Acumular: o valor é somado ao que sobrou. Cada saída lançada nesta conta desconta do saldo automaticamente e não conta como despesa da sua renda.</p>' +
          "</div>" +

          '<label class="field">Cor de destaque<input id="fCor" type="color" value="' + corAtual + '" style="height:42px;padding:4px"></label>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fSave">Salvar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);

    var tipoContaSel = document.getElementById("fTipoConta");
    function recursosMarcados() {
      return Array.prototype.slice.call(document.querySelectorAll("[data-recurso]")).filter(function (i) { return i.checked; })
        .map(function (i) { return i.getAttribute("data-recurso"); });
    }
    function syncTipoConta() {
      var alim = tipoContaSel.value === "alimentacao";
      document.getElementById("boxConta").style.display = alim ? "none" : "";
      document.getElementById("boxAlim").style.display = alim ? "" : "none";
      document.getElementById("boxCredito").style.display = (!alim && recursosMarcados().indexOf("credito") !== -1) ? "" : "none";
    }
    tipoContaSel.addEventListener("change", syncTipoConta);
    document.querySelectorAll("[data-recurso]").forEach(function (i) { i.addEventListener("change", syncTipoConta); });
    syncTipoConta();

    function lerDia(id, errId) {
      var raw = document.getElementById(id).value;
      if (raw === "") return { vazio: true, ok: true, valor: null };
      var n = parseInt(raw, 10);
      if (isNaN(n) || n < 1 || n > 31) { setFieldError(id, errId, "Dia entre 1 e 31"); return { ok: false }; }
      return { ok: true, valor: n };
    }

    document.getElementById("fSave").addEventListener("click", function () {
      var alim = tipoContaSel.value === "alimentacao";
      clearAllErrors([["fNome", "errNome"], ["fLimite", "errLimite"], ["fDiaVenc", "errDiaVenc"], ["fDiaFech", "errDiaFech"], ["fSaldo", "errSaldo"], ["fValorRen", "errValorRen"], ["fDiaRen", "errDiaRen"]]);
      document.getElementById("errRecursos").classList.remove("show");
      var nome = document.getElementById("fNome").value.trim();
      var cor = document.getElementById("fCor").value;
      var ok = true;
      if (!nome) { setFieldError("fNome", "errNome", "Dê um nome à conta"); ok = false; }

      if (alim) {
        var saldoRaw = document.getElementById("fSaldo").value, saldo = parseFloat(saldoRaw);
        var renRaw = document.getElementById("fValorRen").value, valorRen = parseFloat(renRaw);
        var diaRen = lerDia("fDiaRen", "errDiaRen");
        if (saldoRaw === "" || isNaN(saldo)) { setFieldError("fSaldo", "errSaldo", "Informe o saldo disponível"); ok = false; }
        if (renRaw === "" || isNaN(valorRen) || valorRen <= 0) { setFieldError("fValorRen", "errValorRen", "Informe o valor da renovação"); ok = false; }
        if (diaRen.vazio) { setFieldError("fDiaRen", "errDiaRen", "Informe o dia da renovação"); ok = false; }
        else if (!diaRen.ok) ok = false;
        if (!ok) return;
        var camposAlim = { nome: nome, cor: cor, valorRenovacao: valorRen, diaRenovacao: diaRen.valor, modoRenovacao: document.getElementById("fModoRen").value };
        if (editMode) {
          Object.assign(existing, camposAlim);
          if (Math.abs(saldo - data.saldoAlimentacao(existing)) > 0.004) data.definirSaldoAtual(existing, saldo);
        } else {
          var nova = Object.assign({ id: u.uid(), tipo: "alimentacao", limite: 0, saldoBase: 0, baseData: u.todayISO() }, camposAlim);
          App.state.cartoes.push(nova);
          data.definirSaldoAtual(nova, saldo);
        }
        data.aplicarRenovacoes();
        data.saveState();
        closeSheet();
        App.ui.render();
        App.ui.toastSuccess(editMode ? "Conta atualizada" : "Conta adicionada");
        return;
      }

      var recursos = recursosMarcados(), cred = recursos.indexOf("credito") !== -1;
      if (!recursos.length) { var er = document.getElementById("errRecursos"); er.textContent = "Marque ao menos uma opção"; er.classList.add("show"); ok = false; }
      var limiteNum = parseFloat(document.getElementById("fLimite").value);
      if (cred && (document.getElementById("fLimite").value === "" || isNaN(limiteNum) || limiteNum < 0)) { setFieldError("fLimite", "errLimite", "Informe um limite válido"); ok = false; }
      var diaVenc = cred ? lerDia("fDiaVenc", "errDiaVenc") : { ok: true, valor: null };
      var diaFech = cred ? lerDia("fDiaFech", "errDiaFech") : { ok: true, valor: null };
      if (!diaVenc.ok || !diaFech.ok) ok = false;
      if (!ok) return;
      var camposConta = {
        nome: nome, cor: cor, recursos: recursos,
        limite: cred ? limiteNum : 0,
        diaVencimento: cred ? diaVenc.valor : null,
        diaFechamento: cred ? diaFech.valor : null,
        beneficio: cred ? document.getElementById("fBeneficio").checked : false
      };
      if (editMode) {
        Object.assign(existing, camposConta);
        data.saveState();
        closeSheet();
        App.ui.render();
        App.ui.toastSuccess("Conta atualizada");
        return;
      }
      App.state.cartoes.push(Object.assign({ id: u.uid(), tipo: "conta" }, camposConta));
      data.saveState();
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("Conta adicionada");
    });
  }

  // ---- Lançamento ----
  // Sem `existing`: cria um lançamento novo (com opção de recorrência/parcelamento).
  // Com `existing`: edita os campos básicos daquele lançamento específico (a
  // recorrência/parcelamento em si não é alterada — só o item selecionado).
  function openLancamentoSheet(existing) {
    var editMode = !!existing;
    var root = document.getElementById("modalRoot");
    var cartaoOptions = App.state.cartoes.map(function (c) {
      return '<option value="' + c.id + '"' + (editMode && existing.cartaoId === c.id ? " selected" : "") + '>' + u.escapeHtml(c.nome) + "</option>";
    }).join("");
    var catOptions = data.categoriasTodas().map(function (c) {
      return '<option value="' + c + '"' + (editMode && existing.categoria === c ? " selected" : "") + '>' + c + "</option>";
    }).join("");
    var meioOptions = data.MEIOS.map(function (m) {
      return '<option value="' + m + '"' + (editMode && existing.meioPagamento === m ? " selected" : "") + '>' + m + "</option>";
    }).join("");

    var tipoInfo = "";
    if (editMode && existing.totalParcelas > 1) {
      tipoInfo = '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Parcela ' + existing.parcelaAtual + "/" + existing.totalParcelas + " — editar aqui altera só esta parcela.</p>";
    } else if (editMode && existing.recorrente) {
      tipoInfo = '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Lançamento recorrente — editar aqui altera só este mês.</p>';
    }

    var comprovanteAtual = editMode ? (existing.comprovante || null) : null;

    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>' + (editMode ? "Editar lançamento" : "Novo lançamento") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          (editMode ? "" : segmentoLanc("saida")) +
          tipoInfo +
          '<label class="field">Descrição<input id="fTitulo" type="text" placeholder="Ex: Supermercado" autocomplete="off" value="' + (editMode ? u.escapeHtml(existing.titulo) : "") + '">' +
            '<span class="field-error-msg" id="errTitulo"></span>' +
            '<span class="cat-suggest-hint" id="catSuggestHint" style="display:none"></span>' +
          "</label>" +
          '<div class="row2">' +
            '<label class="field">Valor<input id="fValor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="' + (editMode ? existing.valor : "") + '">' +
              '<span class="field-error-msg" id="errValor"></span></label>' +
            '<label class="field" id="dataCompraWrap" style="display:none">Data da compra<input id="fDataCompra" type="date" value="' + u.todayISO() + '"></label>' +
          "</div>" +
          '<label class="field" id="vencimentoWrap"><span id="dataLabel">Vencimento</span><input id="fData" type="date" value="' + (editMode ? existing.vencimento : u.todayISO()) + '">' +
            '<span class="field-error-msg" id="errData"></span>' +
            '<span class="fatura-hint" id="faturaHint" style="display:none"></span></label>' +
          '<label class="field">Categoria<select id="fCategoria">' + catOptions + "</select>" +
            '<button type="button" class="meta-edit-link" id="btnGerenciarCategorias" style="margin-top:6px">gerenciar categorias</button></label>' +
          '<label class="field">Pagamento<select id="fMeio">' + meioOptions + "</select></label>" +
          '<div id="cartaoWrap" style="display:none"><label class="field">Conta<select id="fCartao"><option value="">Nenhum</option>' + cartaoOptions + "</select>" +
            '<span class="field-error-msg" id="errCartao"></span><span class="saldo-hint" id="saldoHint" style="display:none"></span></label></div>' +
          (editMode ? "" :
            '<div id="repeticaoWrap"><label class="field">Repetição<select id="fTipo">' +
              '<option value="unico">Único</option>' +
              '<option value="recorrente">Recorrente (repete todo mês)</option>' +
              '<option value="parcelado">Parcelado</option>' +
            "</select></label>" +
            '<div id="recorrenteWrap" class="tipo-fields" style="display:none">' +
              '<label class="field" style="margin-bottom:0">Repetir por quantos meses<input id="fMeses" type="number" min="2" max="60" value="12"></label>' +
            "</div>" +
            '<div id="parceladoWrap" class="tipo-fields" style="display:none">' +
              '<label class="field" style="margin-bottom:0">Número de parcelas (valor acima = valor de cada parcela)<input id="fParcelas" type="number" min="2" max="60" value="2"></label>' +
            "</div></div>"
          ) +
          (editMode && existing.grupoId && App.state.lancamentos.some(function (x) { return x.grupoId === existing.grupoId && x.vencimento > existing.vencimento; })
            ? '<label class="field" style="flex-direction:row;align-items:center;gap:8px"><input id="fPropagar" type="checkbox" style="width:auto"> Aplicar também aos próximos meses deste grupo (valor, categoria, pagamento e conta)</label>'
            : "") +
          '<label class="field">Comprovante (opcional)' +
            '<div class="comprovante-box" id="comprovanteBox">' +
              (comprovanteAtual
                ? '<img src="' + comprovanteAtual + '" id="comprovantePreview" class="comprovante-thumb"><button type="button" class="meta-edit-link" id="btnRemoverComprovante" style="color:var(--red)">remover</button>'
                : '<button type="button" class="btn btn-ghost" id="btnAnexarComprovante">' + ICONS.camera.replace("<svg ", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px" ') + "Anexar foto</button>") +
              '<input type="file" id="fComprovante" accept="image/*" capture="environment" style="display:none">' +
            "</div>" +
          "</label>" +
          '<div class="btn-row"><button class="btn btn-primary" id="fSave">' + (editMode ? "Salvar alterações" : "Salvar") + "</button></div>" +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    bindSegmentoLanc(function () { openEntradaSheet(); });

    var meioSelect = document.getElementById("fMeio");
    var cartaoWrap = document.getElementById("cartaoWrap");
    var cartaoSelect = document.getElementById("fCartao");
    var dataInput = document.getElementById("fData");
    var dataCompraWrap = document.getElementById("dataCompraWrap");
    var dataCompraInput = document.getElementById("fDataCompra");
    var faturaHint = document.getElementById("faturaHint");
    var vencimentoWrap = document.getElementById("vencimentoWrap");

    // Débito, Pix e Crédito listam só as contas do tipo correspondente.
    function syncCartaoWrap() {
      var t = data.TIPO_MEIO[meioSelect.value];
      cartaoWrap.style.display = t ? "block" : "none";
      if (!t) return;
      var sel = cartaoSelect.value || (editMode && existing.cartaoId) || "";
      var alimSel = meioSelect.value === "Vale alimentação";
      var contasT = data.contasDoTipo(t);
      cartaoSelect.innerHTML = '<option value="">' + (alimSel ? "Selecione a conta" : "Nenhuma") + "</option>" + contasT.map(function (c) {
        return '<option value="' + c.id + '">' + u.escapeHtml(c.nome) + "</option>";
      }).join("");
      cartaoSelect.value = sel;
      // Vale alimentação só desconta se houver conta: já deixa a conta selecionada.
      if (alimSel && !cartaoSelect.value && contasT.length) cartaoSelect.value = contasT[0].id;
    }
    meioSelect.addEventListener("change", function () { syncCartaoWrap(); syncFechamento(); syncAlimentacao(); atualizarSaldoHint(); });
    syncCartaoWrap();

    // Alimentação: o valor sai do saldo na hora da transação — não há vencimento,
    // nem repetição, nem "conta a vencer". O campo vira "Data da transação" e
    // não aceita data futura.
    function ehAlim() { return meioSelect.value === "Vale alimentação"; }
    function syncAlimentacao() {
      var alim = ehAlim(), hoje = u.todayISO();
      document.getElementById("dataLabel").textContent = alim ? "Data da transação" : "Vencimento";
      var rep = document.getElementById("repeticaoWrap");
      if (rep) rep.style.display = alim ? "none" : "";
      if (alim) {
        dataInput.max = hoje;
        if (dataInput.value > hoje) dataInput.value = hoje;
        faturaHint.style.display = "block";
        var cAl = cartaoSelecionado();
        faturaHint.textContent = (cAl && cAl.baseData && dataInput.value && dataInput.value < cAl.baseData)
          ? "Data anterior ao último ajuste/renovação do saldo (" + u.fmtDate(cAl.baseData) + "): será descontado do saldo atual mesmo assim."
          : "O valor é descontado do saldo na hora, na data da transação.";
      } else {
        dataInput.removeAttribute("max");
        if (faturaHint.textContent.indexOf("descontado do saldo") !== -1) faturaHint.style.display = "none";
      }
    }
    // Saldo da conta escolhida (Pix/Débito/Alimentação) — separado do limite do crédito.
    function atualizarSaldoHint() {
      var hint = document.getElementById("saldoHint"), m = meioSelect.value;
      var c = cartaoSelecionado();
      if (editMode || !c || (m !== "Pix" && m !== "Débito" && m !== "Vale alimentação")) { hint.style.display = "none"; return; }
      var saldo = data.saldoConta(c), v = parseFloat(document.getElementById("fValor").value) || 0;
      var falta = v > saldo + 0.004;
      hint.className = "saldo-hint" + (falta ? " warn" : "");
      hint.style.display = "block";
      hint.textContent = "Saldo disponível em " + c.nome + ": " + u.fmtBRL.format(saldo) + (falta ? " — o valor é maior que o saldo" : "");
    }
    document.getElementById("fValor").addEventListener("input", atualizarSaldoHint);
    dataInput.addEventListener("change", function () { if (ehAlim()) syncAlimentacao(); });

    // Quando o cartão selecionado tem dia de fechamento configurado, troca
    // pro fluxo "data da compra → vencimento calculado automaticamente",
    // igual à fatura de um cartão de verdade. Sem fechamento configurado,
    // mantém o comportamento simples de antes (escolher o vencimento direto,
    // com sugestão da próxima data de vencimento do cartão).
    function cartaoSelecionado() {
      return App.state.cartoes.filter(function (c) { return c.id === cartaoSelect.value; })[0];
    }
    function syncFechamento() {
      var c = (!editMode && meioSelect.value === "Cartão de crédito") ? cartaoSelecionado() : null;
      if (c && c.diaFechamento) {
        dataCompraWrap.style.display = "block";
        vencimentoWrap.style.display = "none";
        recalcularFatura();
      } else {
        dataCompraWrap.style.display = "none";
        vencimentoWrap.style.display = "block";
        faturaHint.style.display = "none";
      }
    }
    function recalcularFatura() {
      var c = cartaoSelecionado();
      if (!c || !c.diaFechamento) return;
      var venc = data.calcularVencimentoFatura(c, dataCompraInput.value || u.todayISO());
      if (venc) {
        dataInput.value = venc;
        faturaHint.style.display = "block";
        faturaHint.textContent = "Cai na fatura que vence em " + u.fmtDate(venc) + ".";
      }
    }
    dataCompraInput.addEventListener("change", recalcularFatura);

    // Sem fechamento configurado: ao escolher um cartão com dia de
    // vencimento, preenche a data automaticamente com a próxima data de
    // vencimento dele.
    cartaoSelect.addEventListener("change", function () {
      syncFechamento();
      if (ehAlim()) syncAlimentacao();
      atualizarSaldoHint();
      if (!cartaoSelect.value) return;
      var c = cartaoSelecionado();
      if (!editMode && c && c.diaFechamento) return; // já tratado por syncFechamento/recalcularFatura
      var proxima = data.proximoVencimentoCartao(cartaoSelect.value);
      if (proxima) dataInput.value = proxima;
    });
    syncFechamento();
    syncAlimentacao();
    atualizarSaldoHint();

    var tipoSelect = document.getElementById("fTipo");
    if (tipoSelect) {
      var recorrenteWrap = document.getElementById("recorrenteWrap");
      var parceladoWrap = document.getElementById("parceladoWrap");
      var syncTipoWrap = function () {
        recorrenteWrap.style.display = tipoSelect.value === "recorrente" ? "block" : "none";
        parceladoWrap.style.display = tipoSelect.value === "parcelado" ? "block" : "none";
      };
      tipoSelect.addEventListener("change", syncTipoWrap);
      syncTipoWrap();
    }

    // ---- Categorização automática ----
    // Só sugere em lançamentos novos (editar um já existente não deveria
    // ficar "adivinhando" por cima do que o usuário já escolheu). Se o
    // usuário mexer manualmente na categoria, para de sugerir a partir daí.
    var categoriaSelect = document.getElementById("fCategoria");
    var tituloInput = document.getElementById("fTitulo");
    var catSuggestHint = document.getElementById("catSuggestHint");
    var categoriaTocadaManualmente = false;
    categoriaSelect.addEventListener("change", function () { categoriaTocadaManualmente = true; catSuggestHint.style.display = "none"; });
    if (!editMode) {
      var onTituloInput = u.debounce(function () {
        if (categoriaTocadaManualmente) return;
        var sugestao = data.sugerirCategoria(tituloInput.value);
        if (sugestao) {
          categoriaSelect.value = sugestao;
          catSuggestHint.style.display = "inline";
          catSuggestHint.textContent = "Categoria sugerida com base no histórico";
        } else {
          catSuggestHint.style.display = "none";
        }
      }, 300);
      tituloInput.addEventListener("input", onTituloInput);
    }

    // ---- Comprovante ----
    var fComprovante = document.getElementById("fComprovante");
    function bindAnexarBtn() {
      var btn = document.getElementById("btnAnexarComprovante");
      if (btn) btn.addEventListener("click", function () { fComprovante.click(); });
      var btnRemover = document.getElementById("btnRemoverComprovante");
      if (btnRemover) btnRemover.addEventListener("click", function () {
        comprovanteAtual = null;
        document.getElementById("comprovanteBox").innerHTML =
          '<button type="button" class="btn btn-ghost" id="btnAnexarComprovante">' + ICONS.camera.replace("<svg ", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px" ') + "Anexar foto</button>";
        document.getElementById("comprovanteBox").appendChild(fComprovante);
        bindAnexarBtn();
      });
    }
    bindAnexarBtn();
    fComprovante.addEventListener("change", async function () {
      var file = fComprovante.files[0];
      if (!file) return;
      try {
        var dataUrl = await u.comprimirImagem(file, 900, 0.7);
        comprovanteAtual = dataUrl;
        document.getElementById("comprovanteBox").innerHTML =
          '<img src="' + dataUrl + '" id="comprovantePreview" class="comprovante-thumb"><button type="button" class="meta-edit-link" id="btnRemoverComprovante" style="color:var(--red)">remover</button>';
        document.getElementById("comprovanteBox").appendChild(fComprovante);
        bindAnexarBtn();
      } catch (e) {
        console.warn("comprimir comprovante falhou", e);
        App.ui.toast("Não foi possível anexar essa imagem");
      }
    });

    document.getElementById("btnGerenciarCategorias").addEventListener("click", function () {
      openCategoriaManageSheet(function () { closeSheet(); openLancamentoSheet(existing); });
    });

    // Data anterior ao início do ciclo do saldo: guarda o ciclo para ainda descontar do saldo atual.
    function marcarRetroativo(l, alim) {
      var c = alim ? data.contaPorId(l.cartaoId) : null;
      if (c && c.baseData && l.vencimento < c.baseData) l.retroativoEm = c.baseData; else delete l.retroativoEm;
    }
    document.getElementById("fSave").addEventListener("click", function () {
      clearAllErrors([["fTitulo", "errTitulo"], ["fValor", "errValor"], ["fData", "errData"], ["fCartao", "errCartao"]]);
      var titulo = document.getElementById("fTitulo").value.trim();
      var valorRaw = document.getElementById("fValor").value;
      var valor = parseFloat(valorRaw);
      var vencimento = document.getElementById("fData").value;
      var ok = true;
      if (!titulo) { setFieldError("fTitulo", "errTitulo", "Dê uma descrição pro lançamento"); ok = false; }
      if (valorRaw === "" || isNaN(valor) || valor <= 0) { setFieldError("fValor", "errValor", "Informe um valor maior que zero"); ok = false; }
      var alimSave = ehAlim();
      if (!vencimento) { setFieldError("fData", "errData", alimSave ? "Escolha a data da transação" : "Escolha uma data de vencimento"); ok = false; }
      else if (alimSave && vencimento > u.todayISO()) { setFieldError("fData", "errData", "A data da transação não pode ser futura"); ok = false; }
      if (alimSave) {
        var contaAlim = data.contaPorId(document.getElementById("fCartao").value);
        if (!contaAlim) {
          setFieldError("fCartao", "errCartao", data.contasDoTipo("alimentacao").length ? "Escolha a conta de alimentação para descontar o valor" : "Cadastre uma conta do tipo Alimentação na aba Contas");
          ok = false;
        }
      }
      if (!ok) return;

      var meio = meioSelect.value;
      var cartaoId = data.TIPO_MEIO[meio] ? (document.getElementById("fCartao").value || null) : null;
      var categoria = categoriaSelect.value;

      if (editMode) {
        var eraTransacao = data.ehTransacaoImediata(existing);
        // Mudou o meio ou a conta: o lançamento passa a valer para o saldo da nova conta.
        if (existing.meioPagamento !== meio || existing.cartaoId !== cartaoId) delete existing.semSaldo;
        Object.assign(existing, {
          titulo: titulo, valor: valor, categoria: categoria,
          vencimento: vencimento, meioPagamento: meio, cartaoId: cartaoId, comprovante: comprovanteAtual
        });
        marcarRetroativo(existing, alimSave);
        if (alimSave) existing.status = "pago"; // desconta na hora, nunca fica "em aberto"
        else if (eraTransacao) existing.status = ((meio === "Pix" || meio === "Débito") && vencimento <= u.todayISO()) ? "pago" : "aberto";
        var prop = document.getElementById("fPropagar");
        if (prop && prop.checked) {
          var ref = existing.vencimento;
          App.state.lancamentos.forEach(function (x) {
            if (x === existing || x.grupoId !== existing.grupoId || x.vencimento <= ref) return;
            Object.assign(x, { valor: valor, categoria: categoria, meioPagamento: meio, cartaoId: cartaoId });
            if (existing.recorrente) x.titulo = titulo; // parcelados mantêm o "(n/N)" no título
          });
        }
        data.saveState();
        closeSheet();
        App.ui.render();
        App.ui.toastSuccess("Lançamento atualizado");
        return;
      }

      var tipo = alimSave ? "unico" : tipoSelect.value;

      function addLancamento(overrides) {
        var nl = Object.assign({
          id: u.uid(), titulo: titulo, valor: valor, categoria: categoria,
          vencimento: vencimento, meioPagamento: meio, cartaoId: cartaoId, status: "aberto",
          recorrente: false, totalParcelas: 1, parcelaAtual: 1, grupoId: null, comprovante: comprovanteAtual
        }, overrides);
        // Pix e débito saem na hora: o que já tem data de hoje ou passada nasce pago.
        if (alimSave || ((meio === "Pix" || meio === "Débito") && nl.vencimento <= u.todayISO())) nl.status = "pago";
        marcarRetroativo(nl, alimSave);
        App.state.lancamentos.push(nl);
      }

      if (tipo === "recorrente") {
        var meses = Math.max(2, Math.min(60, parseInt(document.getElementById("fMeses").value, 10) || 12));
        var grupoRec = u.uid();
        for (var i = 0; i < meses; i++) addLancamento({ vencimento: u.addMonthsToDate(vencimento, i), recorrente: true, grupoId: grupoRec });
        App.ui.toastSuccess("Lançamento recorrente criado (" + meses + " meses)");
      } else if (tipo === "parcelado") {
        var totalParc = Math.max(2, Math.min(60, parseInt(document.getElementById("fParcelas").value, 10) || 2));
        var grupoParc = u.uid();
        for (var j = 0; j < totalParc; j++) {
          addLancamento({
            titulo: titulo + " (" + (j + 1) + "/" + totalParc + ")",
            vencimento: u.addMonthsToDate(vencimento, j),
            totalParcelas: totalParc, parcelaAtual: j + 1, grupoId: grupoParc
          });
        }
        App.ui.toastSuccess("Lançamento parcelado em " + totalParc + "x");
      } else {
        addLancamento({});
        App.ui.toastSuccess("Lançamento adicionado");
      }

      data.saveState();
      closeSheet();
      App.ui.render();
      // Depois de cada novo lançamento, informa quanto ainda dá pra gastar.
      var infos = [];
      if (cartaoId && meio === "Cartão de crédito") {
        var cart = App.state.cartoes.filter(function (x) { return x.id === cartaoId; })[0];
        if (cart) infos.push("Restante no " + cart.nome + ": " + u.fmtBRL.format(cart.limite - data.usadoCartao(cartaoId)));
      }
      if (cartaoId && meio === "Vale alimentação" && vencimento <= u.todayISO()) {
        var contaAl = App.state.cartoes.filter(function (x) { return x.id === cartaoId; })[0];
        if (contaAl) {
          var saldoAl = data.saldoAlimentacao(contaAl);
          infos.push(saldoAl < 0 ? "Saldo insuficiente em " + contaAl.nome + ": " + u.fmtBRL.format(saldoAl) : "Saldo em " + contaAl.nome + ": " + u.fmtBRL.format(saldoAl));
        }
      }
      if (cartaoId && (meio === "Pix" || meio === "Débito") && vencimento <= u.todayISO()) {
        var contaPd = App.state.cartoes.filter(function (x) { return x.id === cartaoId; })[0];
        if (contaPd) {
          var saldoPd = data.saldoConta(contaPd);
          infos.push(saldoPd < 0 ? "Saldo insuficiente em " + contaPd.nome + ": " + u.fmtBRL.format(saldoPd) : "Saldo em " + contaPd.nome + ": " + u.fmtBRL.format(saldoPd));
        }
      }
      if (!data.ehBeneficio(cartaoId)) infos.push("Ainda pode gastar no mês: " + u.fmtBRL.format(data.saldoDoMes(vencimento.slice(0, 7))));
      if (infos.length) setTimeout(function () { App.ui.toast(infos.join(" · ")); }, 1400);
    });
  }

  // ---- Segmento Saída | Entrada (topo do "Novo lançamento") ----
  function segmentoLanc(ativo) {
    return '<div class="seg" id="segLanc">' +
      '<button type="button" class="seg-btn' + (ativo === "saida" ? " active" : "") + '" data-seg="saida">Saída</button>' +
      '<button type="button" class="seg-btn' + (ativo === "entrada" ? " active" : "") + '" data-seg="entrada">Entrada (saldo)</button></div>';
  }
  function bindSegmentoLanc(onEntrada, onSaida) {
    var seg = document.getElementById("segLanc");
    if (!seg) return;
    seg.querySelector('[data-seg="entrada"]').addEventListener("click", function () { if (onEntrada) onEntrada(); });
    seg.querySelector('[data-seg="saida"]').addEventListener("click", function () { if (onSaida) onSaida(); });
  }

  // ---- Entrada: adicionar saldo a uma conta ----
  // Vira um lançamento de ENTRADA (aparece na lista de Lançamentos) e fica como
  // saldo disponível da conta para Pix/Débito. Não mexe no limite do crédito.
  function openEntradaSheet(existing, contaIdPre) {
    var ed = !!existing, root = document.getElementById("modalRoot"), hoje = u.todayISO();
    var contas = data.contasComSaldo().slice();
    if (ed) { var cx = data.contaPorId(existing.contaId); if (cx && contas.indexOf(cx) === -1) contas.push(cx); }
    if (!contas.length) { App.ui.toast("Cadastre uma conta com Pix ou Débito para adicionar saldo"); return; }
    var contaSel = ed ? existing.contaId : (contaIdPre && contas.some(function (c) { return c.id === contaIdPre; }) ? contaIdPre : contas[0].id);
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop"><div class="sheet">' +
        '<div class="sheet-head"><h2>' + (ed ? "Editar entrada" : "Adicionar saldo") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
        (ed ? "" : segmentoLanc("entrada")) +
        '<label class="field">Conta<select id="eConta">' + contas.map(function (c) {
          return '<option value="' + c.id + '"' + (c.id === contaSel ? " selected" : "") + ">" + u.escapeHtml(c.nome) + "</option>";
        }).join("") + "</select>" +
          '<span class="field-error-msg" id="errEConta"></span></label>' +
        '<div class="row2">' +
          '<label class="field">Valor<input id="eValor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="' + (ed ? existing.valor : "") + '"><span class="field-error-msg" id="errEValor"></span></label>' +
          '<label class="field">Data<input id="eData" type="date" value="' + (ed ? existing.data : hoje) + '"><span class="field-error-msg" id="errEData"></span></label>' +
        "</div>" +
        '<label class="field">Descrição (opcional)<input id="eDesc" type="text" placeholder="Ex: Transferência, salário, reembolso" value="' + (ed ? u.escapeHtml(existing.descricao || "") : "") + '"></label>' +
        '<p class="saldo-hint" id="eHint" style="margin:0 0 12px"></p>' +
        '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 4px">O valor fica como <b>saldo disponível</b> da conta, para usar em Pix ou Débito. O limite do cartão de crédito não muda.</p>' +
        '<div class="btn-row"><button class="btn btn-primary" id="eSave">' + (ed ? "Salvar alterações" : "Adicionar saldo") + "</button></div></div></div>";
    bindBackdropClose(root);
    bindSegmentoLanc(null, function () { openLancamentoSheet(); });

    function contrib(e) { return e.data <= hoje ? e.valor : 0; }
    // Saldo da conta sem a própria entrada (quando está editando) e com o novo valor.
    function projetar() {
      var c = data.contaPorId(document.getElementById("eConta").value);
      if (!c) return null;
      var atual = data.saldoConta(c);
      var base = atual - ((ed && existing.contaId === c.id) ? contrib(existing) : 0);
      var v = parseFloat(document.getElementById("eValor").value) || 0, d = document.getElementById("eData").value || hoje;
      return { conta: c, atual: atual, depois: data.arred(base + (d <= hoje ? v : 0)), futuro: d > hoje, data: d };
    }
    function atualizarHint() {
      var pj = projetar(), el = document.getElementById("eHint");
      if (!pj) { el.textContent = ""; return; }
      el.textContent = "Saldo atual em " + pj.conta.nome + ": " + u.fmtBRL.format(pj.atual) +
        (pj.futuro ? " · este valor só entra no saldo em " + u.fmtDate(pj.data) : " · após: " + u.fmtBRL.format(pj.depois));
    }
    ["eConta", "eValor", "eData"].forEach(function (id) { document.getElementById(id).addEventListener("input", atualizarHint); document.getElementById(id).addEventListener("change", atualizarHint); });
    atualizarHint();

    document.getElementById("eSave").addEventListener("click", function () {
      clearAllErrors([["eConta", "errEConta"], ["eValor", "errEValor"], ["eData", "errEData"]]);
      var contaId = document.getElementById("eConta").value, valorRaw = document.getElementById("eValor").value;
      var valor = parseFloat(valorRaw), dt = document.getElementById("eData").value, ok = true;
      if (!contaId) { setFieldError("eConta", "errEConta", "Escolha a conta"); ok = false; }
      if (valorRaw === "" || isNaN(valor) || valor <= 0) { setFieldError("eValor", "errEValor", "Informe um valor maior que zero"); ok = false; }
      if (!dt) { setFieldError("eData", "errEData", "Escolha a data"); ok = false; }
      if (!ok) return;
      var desc = document.getElementById("eDesc").value.trim();
      if (ed) {
        var pj = projetar();
        if (pj && pj.depois < -0.004 && pj.depois < pj.atual && !window.confirm("O saldo de " + pj.conta.nome + " ficará negativo (" + u.fmtBRL.format(pj.depois) + "). Salvar mesmo assim?")) return;
        Object.assign(existing, { contaId: contaId, valor: valor, data: dt, descricao: desc });
      } else {
        App.state.entradas.push({ id: u.uid(), contaId: contaId, valor: valor, data: dt, descricao: desc });
      }
      data.saveState(); closeSheet(); App.ui.render();
      var cc = data.contaPorId(contaId);
      App.ui.toastSuccess(ed ? "Entrada atualizada" : "Saldo adicionado em " + (cc ? cc.nome : "conta"));
      if (!ed && cc && dt <= hoje) setTimeout(function () { App.ui.toast("Saldo disponível em " + cc.nome + ": " + u.fmtBRL.format(data.saldoConta(cc))); }, 1400);
    });
  }

  // ---- Edição em massa de lançamentos ----
  function openBulkEditSheet(ids) {
    var root = document.getElementById("modalRoot");
    var catOptions = '<option value="">Não alterar</option>' + data.categoriasTodas().map(function (c) {
      return '<option value="' + c + '">' + c + "</option>";
    }).join("");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Editar ' + ids.length + (ids.length === 1 ? " lançamento" : " lançamentos") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Categoria<select id="fBulkCategoria">' + catOptions + "</select></label>" +
          '<label class="field">Status<select id="fBulkStatus">' +
            '<option value="">Não alterar</option>' +
            '<option value="aberto">Em aberto</option>' +
            '<option value="pago">Pago</option>' +
          "</select></label>" +
          '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px">Só os campos escolhidos serão alterados nos lançamentos selecionados.</p>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fSaveBulk">Aplicar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    document.getElementById("fSaveBulk").addEventListener("click", function () {
      var cat = document.getElementById("fBulkCategoria").value;
      var status = document.getElementById("fBulkStatus").value;
      if (!cat && !status) { App.ui.toast("Escolha ao menos um campo para alterar"); return; }
      App.state.lancamentos.forEach(function (l) {
        if (ids.indexOf(l.id) === -1) return;
        if (cat) l.categoria = cat;
        if (status && !(status === "aberto" && data.ehTransacaoImediata(l))) l.status = status; // Alimentação nunca fica em aberto
      });
      data.saveState();
      closeSheet();
      App.ui.exitSelecao();
      App.ui.render();
      App.ui.toastSuccess("Lançamentos atualizados");
    });
  }

  // ---- Categorias personalizadas ----
  function openCategoriaManageSheet(onClose) {
    var root = document.getElementById("modalRoot");
    function renderLista() {
      return App.state.categoriasCustom.map(function (c) {
        return '<span class="cat-chip">' + u.escapeHtml(c) + '<button data-del-cat="' + u.escapeHtml(c) + '">' + ICONS.close + "</button></span>";
      }).join("") || '<p style="font-size:13px;color:var(--ink-soft)">Nenhuma categoria personalizada ainda.</p>';
    }
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Categorias</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 4px">Fixas: ' + data.CATEGORIAS_FIXAS.join(", ") + "</p>" +
          '<p class="card-label" style="margin-top:14px">Suas categorias</p>' +
          '<div class="cat-manage-list" id="catList">' + renderLista() + "</div>" +
          '<label class="field">Nova categoria<input id="fNovaCat" type="text" placeholder="Ex: Pets"></label>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fAddCat">Adicionar</button></div>' +
        "</div>" +
      "</div>";
    document.getElementById("closeSheet").addEventListener("click", function () { closeSheet(); if (onClose) onClose(); });
    document.getElementById("backdrop").addEventListener("click", function (e) { if (e.target.id === "backdrop") { closeSheet(); if (onClose) onClose(); } });
    function bindDelButtons() {
      document.querySelectorAll("[data-del-cat]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var cat = btn.getAttribute("data-del-cat");
          App.state.categoriasCustom = App.state.categoriasCustom.filter(function (c) { return c !== cat; });
          data.saveState();
          document.getElementById("catList").innerHTML = renderLista();
          bindDelButtons();
        });
      });
    }
    bindDelButtons();
    document.getElementById("fAddCat").addEventListener("click", function () {
      var input = document.getElementById("fNovaCat");
      var nome = input.value.trim();
      if (!nome) return;
      if (data.categoriasTodas().indexOf(nome) !== -1) { App.ui.toast("Essa categoria já existe"); return; }
      App.state.categoriasCustom.push(nome);
      data.saveState();
      input.value = "";
      document.getElementById("catList").innerHTML = renderLista();
      bindDelButtons();
    });
  }

  // ---- Meta de economia ----
  function openMetaSheet(mes) {
    var root = document.getElementById("modalRoot");
    var atual = data.metaDoMes(mes);
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Meta para ' + u.fmtMonth(mes) + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Valor máximo de gastos<input id="fMeta" type="number" inputmode="decimal" step="0.01" min="0" value="' + (atual || "") + '" placeholder="0,00">' +
            '<span class="field-error-msg" id="errMeta"></span></label>' +
          '<div class="btn-row">' +
            (atual ? '<button class="btn btn-ghost" id="fRemoveMeta">Remover meta</button>' : "") +
            '<button class="btn btn-primary" id="fSaveMeta">Salvar</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    if (document.getElementById("fRemoveMeta")) {
      document.getElementById("fRemoveMeta").addEventListener("click", function () {
        delete App.state.metas[mes];
        data.saveState(); closeSheet(); App.ui.render();
      });
    }
    document.getElementById("fSaveMeta").addEventListener("click", function () {
      clearFieldError("fMeta", "errMeta");
      var v = parseFloat(document.getElementById("fMeta").value);
      if (isNaN(v) || v <= 0) { setFieldError("fMeta", "errMeta", "Informe um valor maior que zero"); return; }
      App.state.metas[mes] = v;
      data.saveState();
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("Meta definida");
    });
  }

  // ---- Receita extra ----
  function openReceitaExtraSheet(mes) {
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Receita extra</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Descrição<input id="fTituloR" type="text" placeholder="Ex: Freelance, bônus">' +
            '<span class="field-error-msg" id="errTituloR"></span></label>' +
          '<label class="field">Valor<input id="fValorR" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00">' +
            '<span class="field-error-msg" id="errValorR"></span></label>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fSaveR">Adicionar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    document.getElementById("fSaveR").addEventListener("click", function () {
      clearAllErrors([["fTituloR", "errTituloR"], ["fValorR", "errValorR"]]);
      var titulo = document.getElementById("fTituloR").value.trim();
      var valor = parseFloat(document.getElementById("fValorR").value);
      var ok = true;
      if (!titulo) { setFieldError("fTituloR", "errTituloR", "Dê uma descrição"); ok = false; }
      if (isNaN(valor) || valor <= 0) { setFieldError("fValorR", "errValorR", "Informe um valor maior que zero"); ok = false; }
      if (!ok) return;
      App.state.receitasExtras.push({ id: u.uid(), titulo: titulo, valor: valor, mes: mes });
      data.saveState();
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("Receita extra adicionada");
    });
  }

  // ---- PIN ----
  function openPinConfigSheet() {
    var root = document.getElementById("modalRoot");
    var ativo = App.security.pinAtivo();
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>' + (ativo ? "Alterar PIN" : "Ativar PIN") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Novo PIN (4 dígitos)<input id="fPin1" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*">' +
            '<span class="field-error-msg" id="errPin1"></span></label>' +
          '<label class="field">Confirme o PIN<input id="fPin2" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*">' +
            '<span class="field-error-msg" id="errPin2"></span></label>' +
          '<div class="btn-row">' +
            (ativo ? '<button class="btn btn-ghost" id="fRemovePin">Remover PIN</button>' : "") +
            '<button class="btn btn-primary" id="fSavePin">Salvar</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    if (document.getElementById("fRemovePin")) {
      document.getElementById("fRemovePin").addEventListener("click", function () {
        App.security.removerPin(); closeSheet(); App.ui.render(); App.ui.toast("PIN removido");
      });
    }
    document.getElementById("fSavePin").addEventListener("click", function () {
      clearAllErrors([["fPin1", "errPin1"], ["fPin2", "errPin2"]]);
      var p1 = document.getElementById("fPin1").value;
      var p2 = document.getElementById("fPin2").value;
      var ok = true;
      if (!/^[0-9]{4}$/.test(p1)) { setFieldError("fPin1", "errPin1", "Use exatamente 4 números"); ok = false; }
      if (p1 !== p2) { setFieldError("fPin2", "errPin2", "Os PINs não coincidem"); ok = false; }
      if (!ok) return;
      App.security.definirPin(p1);
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("PIN salvo");
    });
  }

  // ---- Metas por categoria ----
  function openMetaCategoriaSheet(mes) {
    var root = document.getElementById("modalRoot");
    function renderLista() {
      var status = data.metasCategoriaStatus(mes);
      if (!status.length) return '<p style="font-size:13px;color:var(--ink-soft);margin:0 0 14px">Nenhuma meta por categoria ainda.</p>';
      return '<div class="cat-meta-list">' + status.map(function (m) {
        return '<div class="cat-meta-row">' +
          '<span class="chart-legend-dot" style="background:' + m.cor + '"></span>' +
          '<span class="cat-meta-nome">' + m.categoria + "</span>" +
          '<span class="cat-meta-valores num">' + u.fmtBRL.format(m.gasto) + " / " + u.fmtBRL.format(m.alvo) + "</span>" +
          '<button class="icon-btn icon-btn-del" data-del-meta-cat="' + m.categoria + '" aria-label="Remover">' + ICONS.trash + "</button>" +
        "</div>";
      }).join("") + "</div>";
    }
    var catOptions = data.categoriasTodas().map(function (c) { return '<option value="' + c + '">' + c + "</option>"; }).join("");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Metas por categoria — ' + u.fmtMonth(mes) + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<div id="metaCatList">' + renderLista() + "</div>" +
          '<div class="row2">' +
            '<label class="field">Categoria<select id="fMetaCatCategoria">' + catOptions + "</select></label>" +
            '<label class="field">Valor máximo<input id="fMetaCatValor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00"></label>' +
          "</div>" +
          '<div class="btn-row"><button class="btn btn-primary" id="fSaveMetaCat">Adicionar / atualizar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    function bindDelButtons() {
      document.querySelectorAll("[data-del-meta-cat]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          data.removerMetaCategoria(mes, btn.getAttribute("data-del-meta-cat"));
          data.saveState();
          document.getElementById("metaCatList").innerHTML = renderLista();
          bindDelButtons();
          App.ui.render();
        });
      });
    }
    bindDelButtons();
    document.getElementById("fSaveMetaCat").addEventListener("click", function () {
      var cat = document.getElementById("fMetaCatCategoria").value;
      var valor = parseFloat(document.getElementById("fMetaCatValor").value);
      if (isNaN(valor) || valor <= 0) { App.ui.toast("Informe um valor maior que zero"); return; }
      data.definirMetaCategoria(mes, cat, valor);
      data.saveState();
      document.getElementById("fMetaCatValor").value = "";
      document.getElementById("metaCatList").innerHTML = renderLista();
      bindDelButtons();
      App.ui.render();
      App.ui.toastSuccess("Meta salva");
    });
  }

  // ---- Visualizar comprovante em tela cheia ----
  function openComprovanteViewSheet(dataUrl, titulo) {
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet sheet-comprovante">' +
          '<div class="sheet-head"><h2>' + u.escapeHtml(titulo || "Comprovante") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<img src="' + dataUrl + '" class="comprovante-full">' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
  }

  // ---- Perfis (múltiplos usuários) ----
  function openPerfilSheet() {
    var root = document.getElementById("modalRoot");
    function renderLista() {
      var atual = data.perfilAtual();
      return data.listaPerfis().map(function (nome) {
        return '<div class="perfil-row' + (nome === atual ? " ativo" : "") + '" data-perfil="' + u.escapeHtml(nome) + '">' +
          '<span class="perfil-nome">' + ICONS.user.replace("<svg ", '<svg style="width:15px;height:15px;vertical-align:-3px;margin-right:6px" ') + u.escapeHtml(nome) + (nome === atual ? ' <span class="badge badge-em-breve">atual</span>' : "") + "</span>" +
          '<div>' +
            (nome === atual ? "" : '<button class="btn-bulk" data-usar-perfil="' + u.escapeHtml(nome) + '">Usar</button>') +
            '<button class="icon-btn" data-renomear-perfil="' + u.escapeHtml(nome) + '" aria-label="Renomear">' + ICONS.edit + "</button>" +
            (data.listaPerfis().length > 1 ? '<button class="icon-btn icon-btn-del" data-excluir-perfil="' + u.escapeHtml(nome) + '" aria-label="Excluir">' + ICONS.trash + "</button>" : "") +
          "</div>" +
        "</div>";
      }).join("");
    }
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Perfis</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">Cada perfil guarda seus próprios dados neste aparelho — útil pra separar contas ou dividir o app com alguém. Pra levar um perfil pra outro aparelho, use exportar/importar backup em Ajustes.</p>' +
          '<div id="perfilList">' + renderLista() + "</div>" +
          '<label class="field" style="margin-top:14px">Novo perfil<input id="fNovoPerfil" type="text" placeholder="Ex: Maria"></label>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fAddPerfil">Criar perfil</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    function bind() {
      document.querySelectorAll("[data-usar-perfil]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          data.trocarPerfil(btn.getAttribute("data-usar-perfil"));
          closeSheet();
          App.ui.render();
          App.ui.toastSuccess("Perfil alterado");
        });
      });
      document.querySelectorAll("[data-renomear-perfil]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var nome = btn.getAttribute("data-renomear-perfil");
          var novo = window.prompt("Novo nome para \"" + nome + "\":", nome);
          if (!novo || novo.trim() === nome) return;
          if (!data.renomearPerfil(nome, novo.trim())) { App.ui.toast("Já existe um perfil com esse nome"); return; }
          document.getElementById("perfilList").innerHTML = renderLista();
          bind();
          App.ui.render();
        });
      });
      document.querySelectorAll("[data-excluir-perfil]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var nome = btn.getAttribute("data-excluir-perfil");
          if (!window.confirm('Excluir o perfil "' + nome + '" e todos os seus dados? Essa ação não pode ser desfeita.')) return;
          data.excluirPerfil(nome);
          document.getElementById("perfilList").innerHTML = renderLista();
          bind();
          App.ui.render();
        });
      });
    }
    bind();
    document.getElementById("fAddPerfil").addEventListener("click", function () {
      var input = document.getElementById("fNovoPerfil");
      var nome = input.value.trim();
      if (!nome) return;
      if (!data.criarPerfil(nome)) { App.ui.toast("Já existe um perfil com esse nome"); return; }
      input.value = "";
      document.getElementById("perfilList").innerHTML = renderLista();
      bind();
      App.ui.toastSuccess("Perfil criado");
    });
  }

  // ---- Poupança ----
  function openPoupancaSheet(existing) {
    var ed = !!existing, root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop"><div class="sheet">' +
        '<div class="sheet-head"><h2>' + (ed ? "Editar poupança" : "Nova poupança") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
        '<label class="field">Nome<input id="pNome" type="text" placeholder="Ex: Reserva de emergência" value="' + (ed ? u.escapeHtml(existing.nome) : "") + '"><span class="field-error-msg" id="errPNome"></span></label>' +
        '<div class="row2"><label class="field">Meta (opcional)<input id="pMeta" type="number" inputmode="decimal" step="0.01" min="0" value="' + (ed && existing.meta ? existing.meta : "") + '"></label>' +
        '<label class="field">Cor<input id="pCor" type="color" value="' + (ed && existing.cor ? existing.cor : "#3E8A72") + '" style="height:42px;padding:4px"></label></div>' +
        '<div class="btn-row"><button class="btn btn-primary" id="pSave">Salvar</button></div></div></div>';
    bindBackdropClose(root);
    document.getElementById("pSave").addEventListener("click", function () {
      var nome = document.getElementById("pNome").value.trim();
      if (!nome) { setFieldError("pNome", "errPNome", "Dê um nome à poupança"); return; }
      var meta = parseFloat(document.getElementById("pMeta").value) || 0, cor = document.getElementById("pCor").value;
      if (ed) Object.assign(existing, { nome: nome, meta: meta, cor: cor });
      else App.state.poupancas.push({ id: u.uid(), nome: nome, meta: meta, cor: cor });
      data.saveState(); closeSheet(); App.ui.render(); App.ui.toastSuccess("Poupança salva");
    });
  }

  // Depósito = atribui valor de uma conta à poupança (sai do saldo da conta).
  // Retirada = devolve valor da poupança para uma conta (entra no saldo dela).
  // Rendimento = acrescenta à poupança, sem mexer em saldo de conta.
  function openMovPoupancaSheet(poupancaId, tipoInicial) {
    var p = App.state.poupancas.filter(function (x) { return x.id === poupancaId; })[0];
    if (!p) return;
    var root = document.getElementById("modalRoot"), hoje = u.todayISO(), SEM = "__sem__";
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop"><div class="sheet">' +
        '<div class="sheet-head"><h2>' + u.escapeHtml(p.nome) + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
        '<label class="field">Movimentação<select id="mTipo"><option value="deposito">Guardar (conta → poupança)</option><option value="retirada">Retirar (poupança → conta)</option><option value="rendimento">Rendimento</option></select></label>' +
        '<label class="field"><span id="mContaLabel">Conta</span><select id="mConta"></select><span class="saldo-hint" id="mHint"></span></label>' +
        '<div class="row2"><label class="field">Valor<input id="mValor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00"><span class="field-error-msg" id="errMValor"></span></label>' +
        '<label class="field">Data<input id="mData" type="date" value="' + hoje + '"><span class="field-error-msg" id="errMData"></span></label></div>' +
        '<label class="field">Observação (opcional)<input id="mDesc" type="text"></label>' +
        '<div class="btn-row"><button class="btn btn-primary" id="mSave">Salvar</button></div></div></div>';
    bindBackdropClose(root);
    var tipoEl = document.getElementById("mTipo"), contaEl = document.getElementById("mConta");
    tipoEl.value = tipoInicial || "deposito";

    // Opções de conta conforme o tipo, já com o valor disponível de cada uma.
    function opcoes(tipo) {
      if (tipo === "deposito") {
        return data.contasComSaldo().map(function (c) { return { id: c.id, label: c.nome + " · saldo " + u.fmtBRL.format(data.saldoConta(c)) }; });
      }
      if (tipo === "retirada") {
        var o = App.state.cartoes.filter(function (c) { return data.poupadoNaConta(p.id, c.id) > 0.004; })
          .map(function (c) { return { id: c.id, label: c.nome + " · guardado " + u.fmtBRL.format(data.poupadoNaConta(p.id, c.id)) }; });
        var sem = data.poupadoSemConta(p.id);
        if (sem > 0.004) o.push({ id: SEM, label: "Sem conta (valor antigo/rendimento) · " + u.fmtBRL.format(sem) });
        return o;
      }
      return [{ id: SEM, label: "Sem conta específica" }].concat(data.contasComSaldo().map(function (c) { return { id: c.id, label: c.nome }; }));
    }
    function montar() {
      var tipo = tipoEl.value, o = opcoes(tipo), prev = contaEl.value;
      document.getElementById("mContaLabel").textContent = tipo === "deposito" ? "Conta de origem (de onde sai o valor)" : tipo === "retirada" ? "Conta de destino (para onde vai o valor)" : "Conta do rendimento (opcional)";
      contaEl.innerHTML = o.map(function (x) { return '<option value="' + x.id + '">' + u.escapeHtml(x.label) + "</option>"; }).join("");
      if (o.some(function (x) { return x.id === prev; })) contaEl.value = prev;
      contaEl.disabled = !o.length;
      var dEl = document.getElementById("mData");
      if (tipo === "rendimento") dEl.removeAttribute("max"); else { dEl.max = hoje; if (dEl.value > hoje) dEl.value = hoje; }
      hint();
    }
    function hint() {
      var tipo = tipoEl.value, el = document.getElementById("mHint");
      el.className = "saldo-hint";
      if (tipo === "rendimento") { el.textContent = "Soma ao valor guardado da conta escolhida, sem alterar o saldo dela."; return; }
      if (!contaEl.value) {
        el.className = "saldo-hint warn";
        el.textContent = tipo === "deposito"
          ? "Nenhuma conta com saldo. Cadastre uma conta com Pix/Débito e use \"Adicionar saldo\" em Lançamentos."
          : "Esta poupança não tem valores guardados para retirar.";
        return;
      }
      if (tipo === "deposito") el.textContent = "Disponível para guardar: " + u.fmtBRL.format(data.saldoConta(data.contaPorId(contaEl.value)));
      else el.textContent = "Disponível para retirar: " + u.fmtBRL.format(contaEl.value === SEM ? data.poupadoSemConta(p.id) : data.poupadoNaConta(p.id, contaEl.value));
    }
    tipoEl.addEventListener("change", montar);
    contaEl.addEventListener("change", hint);
    montar();

    document.getElementById("mSave").addEventListener("click", function () {
      clearAllErrors([["mValor", "errMValor"], ["mData", "errMData"]]);
      var tipo = tipoEl.value, valor = parseFloat(document.getElementById("mValor").value), dt = document.getElementById("mData").value || hoje;
      if (isNaN(valor) || valor <= 0) { setFieldError("mValor", "errMValor", "Informe um valor maior que zero"); return; }
      if (tipo !== "rendimento" && dt > hoje) { setFieldError("mData", "errMData", "Para guardar ou retirar, a data não pode ser futura"); return; }
      var contaId = contaEl.value === SEM ? null : (contaEl.value || null);
      if (tipo !== "rendimento") {
        if (!contaEl.value) { setFieldError("mValor", "errMValor", tipo === "deposito" ? "Escolha uma conta com saldo" : "Não há valor para retirar"); return; }
        var erro = data.validarMovPoupanca(p.id, tipo, contaId, valor);
        if (erro) { setFieldError("mValor", "errMValor", erro); return; }
      }
      App.state.movPoupanca.push({ id: u.uid(), poupancaId: p.id, contaId: contaId, tipo: tipo, valor: valor, data: dt, descricao: document.getElementById("mDesc").value.trim() });
      data.saveState(); closeSheet(); App.ui.render();
      var cn = data.contaPorId(contaId);
      App.ui.toastSuccess(tipo === "deposito" ? "Guardado em " + p.nome + (cn ? " · saiu de " + cn.nome : "") : tipo === "retirada" ? "Retirado" + (cn ? " · voltou para " + cn.nome : "") : "Rendimento registrado");
    });
  }

  // Detalhes de uma linha do extrato (somente leitura; lançamentos têm atalho p/ editar).
  function openExtratoDetalheSheet(item) {
    var rows = [["Descrição", item.titulo], ["Data", u.fmtDate(item.data)], ["Valor", u.fmtBRL.format(Math.abs(item.valor)) + (item.valor < 0 ? " (saída)" : " (entrada)")]];
    var l = item.l;
    if (l) {
      var c = App.state.cartoes.filter(function (x) { return x.id === l.cartaoId; })[0];
      var imediata = data.ehTransacaoImediata(l); // Alimentação: sem vencimento, desconta na hora
      if (imediata) rows[1][0] = "Data da transação";
      rows.push(["Categoria", l.categoria], ["Pagamento", l.meioPagamento || "—"], ["Conta", c ? c.nome : "—"], ["Status", imediata ? "Descontado do saldo" : (l.status === "pago" ? "Pago" : "Em aberto")]);
      if (l.totalParcelas > 1) rows.push(["Parcela", l.parcelaAtual + "/" + l.totalParcelas]);
      else if (l.recorrente) rows.push(["Repetição", "Recorrente (mensal)"]);
      if (item.beneficio) rows.push(["Obs.", "Cartão de benefício — não desconta da renda"]);
    } else if (item.e) {
      rows.push(["Tipo", "Saldo adicionado"], ["Conta", item.contaNome || "—"]);
    } else if (item.mov) {
      var cm = data.contaPorId(item.mov.contaId);
      rows.push(["Conta", cm ? cm.nome : "—"]);
      if (item.mov.descricao) rows.push(["Observação", item.mov.descricao]);
    }
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop"><div class="sheet">' +
        '<div class="sheet-head"><h2>Detalhes</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
        rows.map(function (r) { return '<div class="lembrete-row"><span class="t" style="color:var(--ink-soft)">' + r[0] + '</span><span>' + u.escapeHtml(r[1]) + "</span></div>"; }).join("") +
        (l ? '<div class="btn-row" style="margin-top:14px">' + (l.comprovante ? '<button class="btn btn-ghost" id="dComp">Ver comprovante</button>' : "") + '<button class="btn btn-primary" id="dEdit">Editar</button></div>' : "") +
      "</div></div>";
    bindBackdropClose(root);
    if (l) {
      document.getElementById("dEdit").addEventListener("click", function () { openLancamentoSheet(l); });
      if (l.comprovante) document.getElementById("dComp").addEventListener("click", function () { openComprovanteViewSheet(l.comprovante, l.titulo); });
    }
  }

  // Escolha ao excluir um item de recorrente/parcelado que ainda tem meses à frente.
  function openExcluirGrupoSheet(l, qtdProximos, onConfirm) {
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop"><div class="sheet">' +
        '<div class="sheet-head"><h2>Excluir lançamento</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
        '<p style="font-size:13.5px;color:var(--ink-soft);margin:0 0 14px">"' + u.escapeHtml(l.titulo) + '" se repete em mais ' + qtdProximos + (qtdProximos === 1 ? " mês" : " meses") + ".</p>" +
        '<div class="btn-row" style="flex-direction:column;gap:8px">' +
          '<button class="btn btn-ghost" id="exUm">Só este</button>' +
          '<button class="btn btn-primary" id="exTodos" style="background:var(--red)">Este e os próximos (' + (qtdProximos + 1) + ")</button>" +
        "</div></div></div>";
    bindBackdropClose(root);
    document.getElementById("exUm").addEventListener("click", function () { closeSheet(); onConfirm(false); });
    document.getElementById("exTodos").addEventListener("click", function () { closeSheet(); onConfirm(true); });
  }

  App.sheets = {
    openExcluirGrupoSheet: openExcluirGrupoSheet,
    openPoupancaSheet: openPoupancaSheet, openMovPoupancaSheet: openMovPoupancaSheet, openExtratoDetalheSheet: openExtratoDetalheSheet,
    openCartaoSheet: openCartaoSheet, openLancamentoSheet: openLancamentoSheet, openEntradaSheet: openEntradaSheet,
    openCategoriaManageSheet: openCategoriaManageSheet, openMetaSheet: openMetaSheet,
    openReceitaExtraSheet: openReceitaExtraSheet, openPinConfigSheet: openPinConfigSheet,
    openBulkEditSheet: openBulkEditSheet, openMetaCategoriaSheet: openMetaCategoriaSheet,
    openComprovanteViewSheet: openComprovanteViewSheet, openPerfilSheet: openPerfilSheet,
    closeSheet: closeSheet
  };
})(window.App);

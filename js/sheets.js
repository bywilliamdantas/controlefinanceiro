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
          '<label class="field" id="vencimentoWrap">Vencimento<input id="fData" type="date" value="' + (editMode ? existing.vencimento : new Date().toISOString().slice(0, 10)) + '">' +
            '<span class="field-error-msg" id="errData"></span>' +
            '<span class="fatura-hint" id="faturaHint" style="display:none"></span></label>' +
          '<label class="field">Categoria<select id="fCategoria">' + catOptions + "</select>" +
            '<button type="button" class="meta-edit-link" id="btnGerenciarCategorias" style="margin-top:6px">gerenciar categorias</button></label>' +
          '<label class="field">Pagamento<select id="fMeio">' + meioOptions + "</select></label>" +
          '<div id="cartaoWrap" style="display:none"><label class="field">Conta<select id="fCartao"><option value="">Nenhum</option>' + cartaoOptions + "</select></label></div>" +
          (editMode ? "" :
            '<label class="field">Repetição<select id="fTipo">' +
              '<option value="unico">Único</option>' +
              '<option value="recorrente">Recorrente (repete todo mês)</option>' +
              '<option value="parcelado">Parcelado</option>' +
            "</select></label>" +
            '<div id="recorrenteWrap" class="tipo-fields" style="display:none">' +
              '<label class="field" style="margin-bottom:0">Repetir por quantos meses<input id="fMeses" type="number" min="2" max="60" value="12"></label>' +
            "</div>" +
            '<div id="parceladoWrap" class="tipo-fields" style="display:none">' +
              '<label class="field" style="margin-bottom:0">Número de parcelas (valor acima = valor de cada parcela)<input id="fParcelas" type="number" min="2" max="60" value="2"></label>' +
            "</div>"
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
      cartaoSelect.innerHTML = '<option value="">Nenhuma</option>' + data.contasDoTipo(t).map(function (c) {
        return '<option value="' + c.id + '">' + u.escapeHtml(c.nome) + "</option>";
      }).join("");
      cartaoSelect.value = sel;
    }
    meioSelect.addEventListener("change", function () { syncCartaoWrap(); syncFechamento(); });
    syncCartaoWrap();

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
      if (!cartaoSelect.value) return;
      var c = cartaoSelecionado();
      if (!editMode && c && c.diaFechamento) return; // já tratado por syncFechamento/recalcularFatura
      var proxima = data.proximoVencimentoCartao(cartaoSelect.value);
      if (proxima) dataInput.value = proxima;
    });
    syncFechamento();

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

    document.getElementById("fSave").addEventListener("click", function () {
      clearAllErrors([["fTitulo", "errTitulo"], ["fValor", "errValor"], ["fData", "errData"]]);
      var titulo = document.getElementById("fTitulo").value.trim();
      var valorRaw = document.getElementById("fValor").value;
      var valor = parseFloat(valorRaw);
      var vencimento = document.getElementById("fData").value;
      var ok = true;
      if (!titulo) { setFieldError("fTitulo", "errTitulo", "Dê uma descrição pro lançamento"); ok = false; }
      if (valorRaw === "" || isNaN(valor) || valor <= 0) { setFieldError("fValor", "errValor", "Informe um valor maior que zero"); ok = false; }
      if (!vencimento) { setFieldError("fData", "errData", "Escolha uma data de vencimento"); ok = false; }
      if (!ok) return;

      var meio = meioSelect.value;
      var cartaoId = data.TIPO_MEIO[meio] ? (document.getElementById("fCartao").value || null) : null;
      var categoria = categoriaSelect.value;

      if (editMode) {
        Object.assign(existing, {
          titulo: titulo, valor: valor, categoria: categoria,
          vencimento: vencimento, meioPagamento: meio, cartaoId: cartaoId, comprovante: comprovanteAtual
        });
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

      var tipo = tipoSelect.value;

      function addLancamento(overrides) {
        var nl = Object.assign({
          id: u.uid(), titulo: titulo, valor: valor, categoria: categoria,
          vencimento: vencimento, meioPagamento: meio, cartaoId: cartaoId, status: "aberto",
          recorrente: false, totalParcelas: 1, parcelaAtual: 1, grupoId: null, comprovante: comprovanteAtual
        }, overrides);
        // Pix e débito saem na hora: o que já tem data de hoje ou passada nasce pago.
        if ((meio === "Pix" || meio === "Débito" || meio === "Vale alimentação") && nl.vencimento <= u.todayISO()) nl.status = "pago";
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
      if (!data.ehBeneficio(cartaoId)) infos.push("Ainda pode gastar no mês: " + u.fmtBRL.format(data.saldoDoMes(vencimento.slice(0, 7))));
      if (infos.length) setTimeout(function () { App.ui.toast(infos.join(" · ")); }, 1400);
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
        if (status) l.status = status;
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

  function openMovPoupancaSheet(poupancaId, tipoInicial) {
    var p = App.state.poupancas.filter(function (x) { return x.id === poupancaId; })[0];
    if (!p) return;
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop"><div class="sheet">' +
        '<div class="sheet-head"><h2>' + u.escapeHtml(p.nome) + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
        '<label class="field">Movimentação<select id="mTipo"><option value="deposito">Depósito</option><option value="retirada">Retirada</option><option value="rendimento">Rendimento</option></select></label>' +
        '<div class="row2"><label class="field">Valor<input id="mValor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00"><span class="field-error-msg" id="errMValor"></span></label>' +
        '<label class="field">Data<input id="mData" type="date" value="' + u.todayISO() + '"></label></div>' +
        '<label class="field">Observação (opcional)<input id="mDesc" type="text"></label>' +
        '<div class="btn-row"><button class="btn btn-primary" id="mSave">Salvar</button></div></div></div>';
    bindBackdropClose(root);
    document.getElementById("mTipo").value = tipoInicial || "deposito";
    document.getElementById("mSave").addEventListener("click", function () {
      var valor = parseFloat(document.getElementById("mValor").value), tipo = document.getElementById("mTipo").value;
      if (isNaN(valor) || valor <= 0) { setFieldError("mValor", "errMValor", "Informe um valor maior que zero"); return; }
      if (tipo === "retirada" && valor > data.saldoPoupanca(p.id) && !window.confirm("A retirada é maior que o saldo atual. Registrar mesmo assim?")) return;
      App.state.movPoupanca.push({ id: u.uid(), poupancaId: p.id, tipo: tipo, valor: valor, data: document.getElementById("mData").value || u.todayISO(), descricao: document.getElementById("mDesc").value.trim() });
      data.saveState(); closeSheet(); App.ui.render(); App.ui.toastSuccess("Movimentação registrada");
    });
  }

  // Detalhes de uma linha do extrato (somente leitura; lançamentos têm atalho p/ editar).
  function openExtratoDetalheSheet(item) {
    var rows = [["Descrição", item.titulo], ["Data", u.fmtDate(item.data)], ["Valor", u.fmtBRL.format(Math.abs(item.valor)) + (item.valor < 0 ? " (saída)" : " (entrada)")]];
    var l = item.l;
    if (l) {
      var c = App.state.cartoes.filter(function (x) { return x.id === l.cartaoId; })[0];
      rows.push(["Categoria", l.categoria], ["Pagamento", l.meioPagamento || "—"], ["Conta", c ? c.nome : "—"], ["Status", l.status === "pago" ? "Pago" : "Em aberto"]);
      if (l.totalParcelas > 1) rows.push(["Parcela", l.parcelaAtual + "/" + l.totalParcelas]);
      else if (l.recorrente) rows.push(["Repetição", "Recorrente (mensal)"]);
      if (item.beneficio) rows.push(["Obs.", "Cartão de benefício — não desconta da renda"]);
    } else if (item.mov && item.mov.descricao) rows.push(["Observação", item.mov.descricao]);
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
    openCartaoSheet: openCartaoSheet, openLancamentoSheet: openLancamentoSheet,
    openCategoriaManageSheet: openCategoriaManageSheet, openMetaSheet: openMetaSheet,
    openReceitaExtraSheet: openReceitaExtraSheet, openPinConfigSheet: openPinConfigSheet,
    openBulkEditSheet: openBulkEditSheet, openMetaCategoriaSheet: openMetaCategoriaSheet,
    openComprovanteViewSheet: openComprovanteViewSheet, openPerfilSheet: openPerfilSheet,
    closeSheet: closeSheet
  };
})(window.App);
